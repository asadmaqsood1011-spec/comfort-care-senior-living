const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { clean, normalizeLeadRow, mostCommon } = require("../_lib/helpers");

const REPORT_TIME_ZONE = "America/Detroit";

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });

  const db = getClient();
  const action = clean(req.query?.action || "");

  try {
    if (action === "forecast") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const averageMonthlyRate = normalizeAverageRate(req.body?.averageMonthlyRate);
      const forecast = await buildRevenueForecast(db, averageMonthlyRate);
      const generated = await generateForecastSummary(forecast);
      forecast.summary = generated.summary;
      forecast.ai = generated.ai;
      return res.status(200).json(forecast);
    }

    const report = await buildDailyReport(db);
    if (req.method === "POST") {
      report.summary = await generateDailySummary(report);
      report.ai = Boolean(process.env.OPENAI_API_KEY);
    }
    return res.status(200).json(report);
  } catch (error) {
    console.error("Daily report error:", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
};

async function buildDailyReport(db) {
  const [{ data: leadRows, error: leadError }, { data: emailRows }, { data: eventRows }] = await Promise.all([
    db.from("leads").select("*").order("created_at", { ascending: false }).limit(1000),
    db.from("email_outreach").select("*").order("created_at", { ascending: false }).limit(1000),
    db.from("lead_events").select("*").order("created_at", { ascending: false }).limit(1000)
  ]);
  if (leadError) throw leadError;

  const todayKey = dayKey(new Date());
  const leads = (leadRows || []).map(normalizeLeadRow);
  const newToday = leads.filter((lead) => dayKey(lead.submittedAt) === todayKey);
  const hotToday = newToday.filter((lead) => lead.activityLabel === "Hot");
  const hotOpen = leads.filter((lead) => lead.activityLabel === "Hot" && isOpenLead(lead));
  const toursToday = leads.filter((lead) => lead.status === "Tour Scheduled" && lead.tourScheduledAt && dayKey(lead.tourScheduledAt) === todayKey);
  const followUpsDue = leads.filter((lead) => isFollowUpDue(lead, todayKey));
  const emailsToday = (emailRows || []).filter((email) => {
    const recipient = String(email.recipient_email || "");
    return !recipient.startsWith("campaign:") && dayKey(email.created_at || email.sent_at) === todayKey;
  });
  const eventsToday = (eventRows || []).filter((event) => dayKey(event.created_at) === todayKey);

  const sourceBreakdown = ["Website", "Tablet", "Upload"].map((source) => ({
    source,
    count: newToday.filter((lead) => (lead.source || "Website") === source).length
  }));
  const topCommunity = mostCommon([
    ...newToday.map((lead) => lead.location || lead.preferredCommunity),
    ...toursToday.map((lead) => lead.location || lead.preferredCommunity)
  ]) || "No clear leader yet";

  const urgentLeads = leads
    .filter((lead) => isOpenLead(lead) && ((lead.priorityTags || []).includes("Urgent") || lead.activityLabel === "Hot"))
    .slice(0, 5)
    .map((lead) => ({
      id: lead.id,
      name: lead.fullName,
      community: lead.location || lead.preferredCommunity || "Unknown",
      score: lead.activityScore,
      label: lead.activityLabel,
      status: lead.status
    }));

  return {
    date: todayKey,
    generatedAt: new Date().toISOString(),
    metrics: {
      newLeadsToday: newToday.length,
      hotLeadsToday: hotToday.length,
      hotOpenLeads: hotOpen.length,
      followUpsDue: followUpsDue.length,
      toursToday: toursToday.length,
      emailsSentToday: emailsToday.length,
      activityEventsToday: eventsToday.length
    },
    sourceBreakdown,
    topCommunity,
    urgentLeads,
    summary: fallbackSummary({ newToday, hotToday, followUpsDue, toursToday, emailsToday, topCommunity }),
    ai: false
  };
}

async function buildRevenueForecast(db, averageMonthlyRate) {
  const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;

  const now = new Date();
  const monthKey = dayKey(now).slice(0, 7);
  const next45 = addDays(now, 45);
  const leads = (data || []).map(normalizeLeadRow);
  const openLeads = leads.filter(isOpenLead);
  const newThisMonth = openLeads.filter((lead) => dayKey(lead.submittedAt).slice(0, 7) === monthKey);
  const movedInThisMonth = leads.filter((lead) => lead.status === "Moved In" && dayKey(lead.updatedAt || lead.submittedAt).slice(0, 7) === monthKey).length;
  const activeTours = openLeads.filter((lead) => {
    if (lead.status !== "Tour Scheduled" || !lead.tourScheduledAt) return false;
    const date = new Date(lead.tourScheduledAt);
    return !Number.isNaN(date.getTime()) && date >= now && date <= next45;
  });
  const decisionPending = openLeads.filter((lead) => lead.status === "Decision Pending");
  const tourCompleted = openLeads.filter((lead) => lead.status === "Tour Completed");
  const hotOpen = openLeads.filter((lead) => lead.activityLabel === "Hot" && lead.status !== "Tour Scheduled" && lead.status !== "Tour Completed" && lead.status !== "Decision Pending");
  const warmOpen = openLeads.filter((lead) => lead.activityLabel === "Warm" && lead.status !== "Tour Scheduled" && lead.status !== "Tour Completed" && lead.status !== "Decision Pending");
  const urgentOpen = openLeads.filter((lead) => (lead.priorityTags || []).includes("Urgent"));
  const followUpsDue = openLeads.filter((lead) => isFollowUpDue(lead, dayKey(now)));

  const expected = (decisionPending.length * 0.60)
    + (tourCompleted.length * 0.35)
    + (activeTours.length * 0.42)
    + (hotOpen.length * 0.18)
    + (warmOpen.length * 0.06)
    + (urgentOpen.length * 0.07)
    + (followUpsDue.length * 0.04);
  const low = Math.max(0, Math.floor(expected * 0.75));
  const high = Math.max(low, Math.ceil(expected * 1.3));
  const confidence = forecastConfidence({ activeTours, hotOpen, newThisMonth, followUpsDue, decisionPending, tourCompleted });
  const topCommunity = mostCommon([
    ...decisionPending.map((lead) => lead.location || lead.preferredCommunity),
    ...activeTours.map((lead) => lead.location || lead.preferredCommunity),
    ...hotOpen.map((lead) => lead.location || lead.preferredCommunity)
  ]) || "No clear leader yet";

  return {
    generatedAt: new Date().toISOString(),
    averageMonthlyRate,
    moveIns: { low, high, expected: Number(expected.toFixed(2)) },
    movedInThisMonth,
    totalExpected: { low: low + movedInThisMonth, high: high + movedInThisMonth },
    projectedMonthlyRevenue: {
      low: low * averageMonthlyRate,
      high: high * averageMonthlyRate
    },
    totalMonthlyRevenue: {
      low: (low + movedInThisMonth) * averageMonthlyRate,
      high: (high + movedInThisMonth) * averageMonthlyRate
    },
    confidence,
    topCommunity,
    drivers: {
      openLeads: openLeads.length,
      newThisMonth: newThisMonth.length,
      decisionPending: decisionPending.length,
      tourCompleted: tourCompleted.length,
      activeTours: activeTours.length,
      hotOpen: hotOpen.length,
      warmOpen: warmOpen.length,
      urgentOpen: urgentOpen.length,
      followUpsDue: followUpsDue.length
    },
    summary: fallbackForecastSummary({ low, high, averageMonthlyRate, movedInThisMonth, decisionPending, tourCompleted, activeTours, hotOpen, followUpsDue, topCommunity, confidence }),
    ai: false
  };
}

async function generateForecastSummary(forecast) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (!OPENAI_API_KEY) return { summary: forecast.summary, ai: false };

  const prompt = `Write an executive move-in and revenue forecast for a senior living admissions dashboard.

Data:
- Estimated move-ins this month: ${forecast.moveIns.low}-${forecast.moveIns.high}
- Average monthly rate: $${forecast.averageMonthlyRate}
- Already moved in this month: ${forecast.movedInThisMonth}
- Projected monthly revenue (total): $${forecast.totalMonthlyRevenue.low}-$${forecast.totalMonthlyRevenue.high}
- Confidence: ${forecast.confidence}
- Top community: ${forecast.topCommunity}
- Open leads: ${forecast.drivers.openLeads}
- Decision pending: ${forecast.drivers.decisionPending}
- Tour completed (awaiting decision): ${forecast.drivers.tourCompleted}
- Active tours scheduled: ${forecast.drivers.activeTours}
- Hot open leads: ${forecast.drivers.hotOpen}
- Warm open leads: ${forecast.drivers.warmOpen}
- Urgent open leads: ${forecast.drivers.urgentOpen}
- Follow-ups due: ${forecast.drivers.followUpsDue}

Return 2 concise sentences. Be clear that this is an estimate, and mention the main driver and the next action.`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 160
      })
    });
    const aiData = await aiRes.json();
    return { summary: clean(aiData.choices?.[0]?.message?.content || forecast.summary), ai: true };
  } catch (error) {
    console.error("Forecast AI error:", error.message);
    return { summary: forecast.summary, ai: false };
  }
}

function fallbackForecastSummary({ low, high, averageMonthlyRate, movedInThisMonth, decisionPending, tourCompleted, activeTours, hotOpen, followUpsDue, topCommunity, confidence }) {
  const revenueLow = (low + movedInThisMonth) * averageMonthlyRate;
  const revenueHigh = (high + movedInThisMonth) * averageMonthlyRate;
  const drivers = [
    decisionPending.length && `${decisionPending.length} deciding`,
    tourCompleted.length && `${tourCompleted.length} post-tour`,
    activeTours.length && `${activeTours.length} active tour${activeTours.length === 1 ? "" : "s"}`,
    hotOpen.length && `${hotOpen.length} hot lead${hotOpen.length === 1 ? "" : "s"}`,
    followUpsDue.length && `${followUpsDue.length} follow-up${followUpsDue.length === 1 ? "" : "s"} due`
  ].filter(Boolean).join(", ");
  return `Estimated ${low}-${high} move-ins this month, or about ${formatMoney(revenueLow)}-${formatMoney(revenueHigh)} in monthly revenue at the current rate. Confidence is ${confidence.toLowerCase()}, driven by ${drivers || "current pipeline activity"}, with ${topCommunity} showing the strongest signal.`;
}

function forecastConfidence({ activeTours, hotOpen, newThisMonth, followUpsDue, decisionPending, tourCompleted }) {
  if (decisionPending.length >= 2 || (decisionPending.length >= 1 && activeTours.length >= 1)) return "High";
  if (activeTours.length >= 3 || (activeTours.length >= 1 && hotOpen.length >= 4) || tourCompleted.length >= 2) return "High";
  if (activeTours.length >= 1 || hotOpen.length >= 2 || newThisMonth.length >= 6 || followUpsDue.length >= 4 || decisionPending.length >= 1 || tourCompleted.length >= 1) return "Medium";
  return "Low";
}

function normalizeAverageRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5000;
  return Math.min(25000, Math.max(1000, Math.round(parsed)));
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

async function generateDailySummary(report) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (!OPENAI_API_KEY) return report.summary;

  const prompt = `Write a concise daily CRM report for Comfort Care Senior Living.

Metrics:
- New leads today: ${report.metrics.newLeadsToday}
- Hot leads today: ${report.metrics.hotLeadsToday}
- Open hot leads: ${report.metrics.hotOpenLeads}
- Follow-ups due/overdue: ${report.metrics.followUpsDue}
- Tours scheduled today: ${report.metrics.toursToday}
- Emails sent/logged today: ${report.metrics.emailsSentToday}
- Top community: ${report.topCommunity}
- Source breakdown: ${report.sourceBreakdown.map((item) => `${item.source}: ${item.count}`).join(", ")}

Important leads:
${report.urgentLeads.map((lead) => `- ${lead.name} at ${lead.community}: ${lead.label} Lead ${lead.score}, ${lead.status}`).join("\n") || "- None"}

Return 3 short bullets:
1. What happened today
2. What needs attention
3. Recommended next action
Keep it warm, executive, and under 90 words.`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 220
      })
    });
    const aiData = await aiRes.json();
    return clean(aiData.choices?.[0]?.message?.content || report.summary);
  } catch (error) {
    console.error("Daily report AI error:", error.message);
    return report.summary;
  }
}

function fallbackSummary({ newToday, hotToday, followUpsDue, toursToday, emailsToday, topCommunity }) {
  return [
    `Today brought ${newToday.length} new lead${newToday.length === 1 ? "" : "s"}, with ${topCommunity} showing the strongest activity.`,
    `${hotToday.length} new hot lead${hotToday.length === 1 ? "" : "s"} came in, and ${followUpsDue.length} follow-up${followUpsDue.length === 1 ? "" : "s"} need attention.`,
    `${toursToday.length} tour${toursToday.length === 1 ? " is" : "s are"} scheduled today, and ${emailsToday.length} email${emailsToday.length === 1 ? " was" : "s were"} sent or logged.`
  ].join("\n");
}

function isFollowUpDue(lead, todayKey) {
  if (!lead.followUpAt || !isOpenLead(lead)) return false;
  return dayKey(lead.followUpAt) <= todayKey;
}

function isOpenLead(lead = {}) {
  return lead.status !== "Closed" && lead.status !== "Moved In";
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
