const crypto = require("crypto");
const { clean, isValidEmail, isValidPhone, normalizePhone, sendEmail, buildBrandedEmail, personalizeEmail } = require("./helpers");
const { assertLocationAccess } = require("./v2-auth");

const LEAD_STATUSES = new Set(["new", "contacted", "tour_scheduled", "move_in", "archived"]);
const USER_ROLES = new Set(["super_admin", "regional_manager", "location_admin", "staff"]);
const TASK_STATUSES = new Set(["todo", "in_progress", "done", "archived"]);
const FOLLOW_UP_STATUSES = new Set(["open", "completed", "missed", "archived"]);
const TOUR_STATUSES = new Set(["scheduled", "completed", "no_show", "cancelled"]);
const DOCUMENT_BUCKET = "operations-documents";

async function getLocations(db, user) {
  if (user.isSuperAdmin) {
    const { data, error } = await db.from("locations").select("*").eq("active", true).order("name");
    if (error) throw error;
    return data || [];
  }
  return user.locations.filter((location) => location.active !== false).sort((a, b) => a.name.localeCompare(b.name));
}

async function getDashboard(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, locationId);
  const [leads, tours, followUps, tasks, activity] = await Promise.all([
    selectByLocations(db.from("leads_v2").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("staff_tasks").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("activity_logs").select("*, profiles:actor_id(full_name,email)").order("created_at", { ascending: false }).limit(80), locationIds, "location_id")
  ]);
  throwFirstError(leads, tours, followUps, tasks, activity);

  const leadRows = leads.data || [];
  const tourRows = tours.data || [];
  const followRows = followUps.data || [];
  const taskRows = tasks.data || [];
  const now = Date.now();
  const overdue = followRows.filter((row) => row.status === "open" && new Date(row.due_at).getTime() < now).length;
  const moveIns = leadRows.filter((lead) => lead.status === "move_in").length;
  const conversionRate = leadRows.length ? Math.round((moveIns / leadRows.length) * 100) : 0;

  return {
    scope: { locationId: locationId || "", locationIds },
    metrics: {
      totalLeads: leadRows.length,
      toursScheduled: tourRows.filter((tour) => tour.status === "scheduled").length,
      moveIns,
      conversionRate,
      overdueFollowUps: overdue,
      openTasks: taskRows.filter((task) => !["done", "archived"].includes(task.status)).length
    },
    locationComparison: locations
      .filter((location) => locationIds.includes(location.id))
      .map((location) => {
        const localLeads = leadRows.filter((lead) => lead.location_id === location.id);
        const localMoveIns = localLeads.filter((lead) => lead.status === "move_in").length;
        return {
          locationId: location.id,
          name: location.name,
          leads: localLeads.length,
          tours: tourRows.filter((tour) => tour.location_id === location.id).length,
          moveIns: localMoveIns,
          conversionRate: localLeads.length ? Math.round((localMoveIns / localLeads.length) * 100) : 0,
          overdueFollowUps: followRows.filter((follow) => follow.location_id === location.id && follow.status === "open" && new Date(follow.due_at).getTime() < now).length
        };
      }),
    recentActivity: activity.data || []
  };
}

async function listLeads(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || ""));
  let query = db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(500);
  query = scopeQuery(query, locationIds, "location_id");
  if (params.status && LEAD_STATUSES.has(params.status)) query = query.eq("status", params.status);
  if (params.search) {
    const search = clean(params.search).toLowerCase();
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getLeadDetail(db, user, id) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const [activity, notes, emails, tours, followUps] = await Promise.all([
    db.from("activity_logs").select("*, profiles:actor_id(full_name,email)").eq("entity_type", "lead").eq("entity_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("notes").select("*").eq("entity_type", "lead").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("email_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("tours").select("*").eq("lead_id", id).order("scheduled_at", { ascending: false }).limit(50),
    db.from("follow_ups").select("*").eq("lead_id", id).order("due_at", { ascending: false }).limit(50)
  ]);
  throwFirstError(activity, notes, emails, tours, followUps);
  return {
    lead,
    activity: activity.data || [],
    notes: notes.data || [],
    emailHistory: emails.data || [],
    tours: tours.data || [],
    followUps: followUps.data || []
  };
}

async function updateLeadNotes(db, user, id, notes) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const body = clean(notes);
  const { data, error } = await db
    .from("leads_v2")
    .update({ notes_summary: body })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await db.from("notes").insert({
    location_id: lead.location_id,
    entity_type: "lead",
    entity_id: id,
    body: body || "Notes cleared.",
    visibility: "internal",
    created_by: user.id
  });
  await logActivity(db, user, lead.location_id, "lead", id, "notes_updated", {});
  return data;
}

async function generateLeadEmailDraft(db, user, id) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const location = await getLocationById(db, lead.location_id);
  let subject = `Checking in from ${location?.name || "Comfort Care Senior Living"}`;
  let body = `Hi {{first_name}},

Thank you for reaching out to Comfort Care Senior Living. I wanted to personally follow up about {{care_type}} at {{community}} and see how we can help your family think through next steps.

If it would be helpful, we can answer questions about care, availability, pricing, and tour options.

Warmly,
The Comfort Care Team`;
  let ai = false;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (OPENAI_API_KEY) {
    try {
      const prompt = `Write a short, warm, human-reviewed follow-up email for a senior living inquiry.

Company: Comfort Care Senior Living
Community: ${location?.name || ""}
Lead name: ${lead.full_name}
Care type: ${lead.care_type || ""}
Timeline: ${lead.move_timeline || ""}
Payment: ${lead.payment_type || ""}
Situation/notes: ${lead.current_situation || lead.notes_summary || ""}

Rules:
- Be compassionate and professional.
- Do not invent offers, discounts, availability, or medical claims.
- Keep it under 170 words.
- Use {{first_name}}, {{community}}, and {{care_type}} placeholders where useful.
- Return exactly:
Subject: ...
Body:
...`;
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.45
        })
      });
      const json = await aiRes.json();
      const text = json.choices?.[0]?.message?.content || "";
      const subjectMatch = text.match(/Subject:\s*(.+)/i);
      const bodyMatch = text.match(/Body:\s*([\s\S]+)/i);
      if (subjectMatch && bodyMatch) {
        subject = clean(subjectMatch[1]);
        body = bodyMatch[1].trim();
        ai = true;
      }
    } catch (err) {
      console.error("V2 email draft error:", err.message);
    }
  }

  await logActivity(db, user, lead.location_id, "lead", lead.id, "email_draft_generated", { ai });
  return { subject, body, ai };
}

async function sendLeadEmail(db, user, id, body = {}) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  if (!isValidEmail(lead.email || "")) validationError("This lead does not have a valid email address.");
  const location = await getLocationById(db, lead.location_id);
  const subject = clean(body.subject);
  const draftBody = String(body.body || "").trim();
  if (!subject || !draftBody) validationError("Subject and email body are required.");
  const leadForTemplate = {
    ...lead,
    name: lead.full_name,
    location: location?.name || "",
    preferred_community: location?.name || ""
  };
  const personalizedSubject = personalizeEmail(subject, leadForTemplate);
  const personalizedBody = personalizeEmail(draftBody, leadForTemplate);
  const result = await sendEmail({
    to: lead.email,
    subject: personalizedSubject,
    body: personalizedBody,
    html: buildBrandedEmail(personalizedBody)
  });
  const { data, error } = await db.from("email_history").insert({
    location_id: lead.location_id,
    lead_id: lead.id,
    recipient_email: lead.email,
    subject: personalizedSubject,
    body: personalizedBody,
    status: clean(result.status || "sent").toLowerCase(),
    provider: result.mode || "gmail",
    sent_by: user.id,
    sent_at: new Date().toISOString(),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, lead.location_id, "lead", lead.id, "email_sent", { subject: personalizedSubject, status: result.status, emailHistoryId: data.id });
  return { email: data, result };
}

async function exportLeadsCsv(db, user, params = {}) {
  const leads = await listLeads(db, user, params);
  const headers = ["Full name", "Phone number", "Email", "Location ID", "Source", "Care type", "Status", "Move timeline", "Payment type", "Priority tags", "Notes", "Date submitted"];
  const rows = leads.map((lead) => [
    lead.full_name,
    lead.phone,
    lead.email || "",
    lead.location_id,
    lead.source,
    lead.care_type,
    lead.status,
    lead.move_timeline || "",
    lead.payment_type || "",
    (lead.priority_tags || []).join(", "),
    lead.notes_summary || "",
    lead.created_at
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

async function createLead(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const payload = buildLeadPayload(body, locationId, user.id);
  const duplicate = await findDuplicateLead(db, payload);
  if (duplicate) {
    payload.duplicate_of = duplicate.id;
    payload.duplicate_reason = "Matching phone or email";
  }
  const { data, error } = await db.from("leads_v2").insert(payload).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "lead", data.id, "lead_created", { source: data.source, duplicateOf: data.duplicate_of });
  return { lead: data, duplicate };
}

async function updateLeadStatus(db, user, id, status) {
  if (!LEAD_STATUSES.has(status)) {
    const error = new Error("Invalid lead status.");
    error.statusCode = 422;
    throw error;
  }
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const { data, error } = await db
    .from("leads_v2")
    .update({ status, archived_at: status === "archived" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, lead.location_id, "lead", id, "status_changed", { status });
  if (status === "move_in" && lead.status !== "move_in") {
    await seedMoveInTasks(db, user, data).catch((err) => console.error("seedMoveInTasks failed:", err.message));
  }
  return data;
}

async function bulkUpdateLeads(db, user, body = {}) {
  const ids = Array.isArray(body.ids) ? body.ids.map(clean).filter(Boolean) : [];
  const status = clean(body.status);
  if (!ids.length) validationError("No leads selected.");
  if (!LEAD_STATUSES.has(status)) validationError("Invalid status.");
  const { data: leads, error: fetchErr } = await db.from("leads_v2").select("id, location_id, status").in("id", ids);
  if (fetchErr) throw fetchErr;
  (leads || []).forEach((row) => assertLocationAccess(user, row.location_id));
  const patch = { status, archived_at: status === "archived" ? new Date().toISOString() : null };
  const { data: updated, error } = await db.from("leads_v2").update(patch).in("id", ids).select("id, location_id, status");
  if (error) throw error;
  await Promise.all((updated || []).map((row) =>
    logActivity(db, user, row.location_id, "lead", row.id, "status_changed", { status, bulk: true })
  ));
  return { updated: updated?.length || 0, status };
}

const MOVE_IN_TEMPLATE = {
  default: [
    { title: "Welcome packet prepared", days: 0 },
    { title: "Room setup and inspection", days: 0 },
    { title: "Family orientation scheduled", days: 1 },
    { title: "Move-in day point-of-contact assigned", days: 0 },
    { title: "Initial care plan review", days: 3 }
  ],
  "Memory Care": [
    { title: "Memory care safety assessment", days: 0 },
    { title: "Wandering risk evaluation", days: 1 },
    { title: "Behavioral baseline documented", days: 3 }
  ],
  "Assisted Living": [
    { title: "Medication setup with pharmacy", days: 1 },
    { title: "ADL assessment scheduled", days: 2 }
  ],
  "Independent Living": [
    { title: "Amenity tour with resident", days: 1 }
  ]
};

async function seedMoveInTasks(db, user, lead) {
  const careType = clean(lead.care_type);
  const baseTemplate = MOVE_IN_TEMPLATE.default;
  const careTemplate = MOVE_IN_TEMPLATE[careType] || [];
  const allTasks = [...baseTemplate, ...careTemplate];
  const now = Date.now();
  const rows = allTasks.map((task) => ({
    location_id: lead.location_id,
    lead_id: lead.id,
    title: `[Move-in] ${task.title} — ${lead.full_name || "resident"}`,
    task_type: "move_in",
    status: "todo",
    due_at: new Date(now + task.days * 24 * 60 * 60 * 1000).toISOString(),
    created_by: user.id || null
  }));
  if (!rows.length) return;
  const { error } = await db.from("staff_tasks").insert(rows);
  if (error) throw error;
}

function tourSecret() {
  return process.env.TOUR_LINK_SECRET || process.env.CRON_SECRET || "";
}

function signTourToken(tourId) {
  const secret = tourSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(String(tourId)).digest("hex").slice(0, 24);
}

async function getTourPublicLink(db, user, tourId) {
  const tour = await getEntityById(db, "tours", tourId);
  assertLocationAccess(user, tour.location_id);
  const token = signTourToken(tour.id);
  if (!token) {
    const error = new Error("Server is missing TOUR_LINK_SECRET (or CRON_SECRET).");
    error.statusCode = 500;
    throw error;
  }
  return { tourId: tour.id, token, path: `/tour/${tour.id}?t=${token}` };
}

async function getPublicTour(db, tourId, token) {
  if (!token || token !== signTourToken(tourId)) {
    const error = new Error("Invalid or expired tour link.");
    error.statusCode = 401;
    throw error;
  }
  const { data: tour, error } = await db.from("tours").select("*").eq("id", tourId).maybeSingle();
  if (error) throw error;
  if (!tour) {
    const err = new Error("Tour not found.");
    err.statusCode = 404;
    throw err;
  }
  const [{ data: lead }, { data: location }] = await Promise.all([
    tour.lead_id ? db.from("leads_v2").select("full_name").eq("id", tour.lead_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("locations").select("name, address, phone").eq("id", tour.location_id).maybeSingle()
  ]);
  return {
    tour: { id: tour.id, scheduled_at: tour.scheduled_at, status: tour.status, notes: tour.notes },
    lead: lead ? { full_name: lead.full_name } : null,
    location: location || null
  };
}

async function callLLM(prompt, { json = false, maxTokens = 800, system = "" } = {}) {
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages,
          temperature: 0.4,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: "json_object" } } : {})
        })
      });
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content || "";
      if (text) return { text, provider: "openai" };
    } catch (err) { console.error("OpenAI failed:", err.message); }
  }
  if (geminiKey) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (system ? `${system}\n\n` : "") + prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) }
        })
      });
      const j = await res.json();
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) return { text, provider: "gemini" };
    } catch (err) { console.error("Gemini failed:", err.message); }
  }
  return { text: "", provider: "none" };
}

function safeParseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) {} }
  return null;
}

async function generateMorningBrief(db, user, locationId = "") {
  const dashboard = await getDashboard(db, user, locationId);
  const ops = await listOperations(db, user, locationId);
  const now = Date.now();
  const upcomingTours = (ops.tours || []).filter((t) => t.status === "scheduled" && new Date(t.scheduled_at).getTime() > now).slice(0, 8);
  const overdueFollowUps = (ops.followUps || []).filter((f) => f.status === "open" && new Date(f.due_at).getTime() < now).slice(0, 8);
  const recentLeads = (await listLeads(db, user, { locationId })).slice(0, 10);
  const context = {
    metrics: dashboard.metrics,
    locationComparison: dashboard.locationComparison,
    upcomingTours: upcomingTours.map((t) => ({ when: t.scheduled_at, lead: t.lead_id, notes: t.notes })),
    overdueFollowUps: overdueFollowUps.map((f) => ({ due: f.due_at, lead: f.lead_id, note: f.note })),
    recentLeads: recentLeads.map((l) => ({ name: l.full_name, status: l.status, careType: l.care_type, source: l.source, createdAt: l.created_at }))
  };
  const prompt = `You are an admissions operations chief-of-staff for a senior-living community. Based on this snapshot, produce the morning briefing.

Snapshot:
${JSON.stringify(context, null, 2)}

Return JSON with this shape:
{
  "headline": "one sentence on the state of admissions",
  "overnight": ["3 short bullets on what changed or needs attention from yesterday/overnight"],
  "today": ["4-6 prioritized actions for today, each starting with a verb"],
  "watch": ["2-3 things to keep an eye on this week"],
  "celebrate": "one short sentence on a positive signal (or empty string)"
}
Only output JSON.`;
  const { text, provider } = await callLLM(prompt, { json: true, maxTokens: 700 });
  const parsed = safeParseJson(text) || { headline: "Operations are stable.", overnight: [], today: [], watch: [], celebrate: "" };
  return { brief: parsed, provider, generatedAt: new Date().toISOString() };
}

async function generateTourPrepBrief(db, user, tourId) {
  const tour = await getEntityById(db, "tours", tourId);
  assertLocationAccess(user, tour.location_id);
  if (!tour.lead_id) return { brief: { talkingPoints: [], sensitivities: [], questionsToAsk: [] }, provider: "none" };
  const detail = await getLeadDetail(db, user, tour.lead_id);
  const lead = detail.lead;
  const recentEmails = (detail.emailHistory || []).slice(0, 5).map((e) => ({ subject: e.subject, snippet: String(e.body || "").slice(0, 240), at: e.created_at }));
  const recentNotes = (detail.notes || []).slice(0, 8).map((n) => ({ body: n.body, at: n.created_at }));
  const activity = (detail.activity || []).slice(0, 12).map((a) => ({ action: a.action, at: a.created_at }));
  const prompt = `You are briefing an admissions counselor 15 minutes before a senior-living tour.

Lead profile:
${JSON.stringify({
  name: lead.full_name,
  careType: lead.care_type,
  moveTimeline: lead.move_timeline,
  paymentType: lead.payment_type,
  source: lead.source,
  notes: lead.notes_summary,
  currentSituation: lead.current_situation
}, null, 2)}

Recent emails: ${JSON.stringify(recentEmails)}
Recent internal notes: ${JSON.stringify(recentNotes)}
Recent activity: ${JSON.stringify(activity)}

Return JSON:
{
  "summary": "2-3 sentence sketch of who is touring and where they are emotionally/logistically",
  "talkingPoints": ["4-6 specific points to mention, tailored to this family"],
  "sensitivities": ["2-4 things to be careful about (emotional triggers, prior frustrations, unspoken concerns)"],
  "questionsToAsk": ["3-4 open-ended questions that move the decision forward"],
  "redFlags": ["any urgent risks (or empty array)"]
}
Be specific to THIS family, not generic. Avoid medical claims. Only output JSON.`;
  const { text, provider } = await callLLM(prompt, { json: true, maxTokens: 700 });
  const parsed = safeParseJson(text) || { summary: "Limited context available.", talkingPoints: [], sensitivities: [], questionsToAsk: [], redFlags: [] };
  return { brief: parsed, provider, lead: { id: lead.id, name: lead.full_name }, generatedAt: new Date().toISOString() };
}

async function triageInboundMessage(db, user, body = {}) {
  const rawText = clean(body.text || body.message || "");
  if (!rawText) validationError("Paste the inbound message.");
  const leadId = clean(body.leadId || "");
  let leadContext = null;
  if (leadId) {
    try {
      const detail = await getLeadDetail(db, user, leadId);
      leadContext = { name: detail.lead.full_name, careType: detail.lead.care_type, status: detail.lead.status };
    } catch (_) {}
  }
  const prompt = `Triage this inbound family message for a senior-living admissions team.

Inbound message:
"""
${rawText}
"""

${leadContext ? `Existing lead context: ${JSON.stringify(leadContext)}` : "No existing lead context."}

Return JSON:
{
  "summary": "1 sentence summary",
  "intent": "tour_request|info_request|reschedule|complaint|pricing|move_in|other",
  "urgency": "low|medium|high|critical",
  "sentiment": "positive|neutral|concerned|frustrated|angry",
  "extractedFields": {
    "careType": "Memory Care|Assisted Living|Independent Living|Unknown",
    "moveTimeline": "ASAP|1-3 months|3-6 months|6+ months|Unknown",
    "decisionMaker": "self|spouse|adult_child|other|Unknown",
    "budgetSignal": "any wording about budget or empty"
  },
  "suggestedReply": {
    "subject": "short subject line",
    "body": "warm, professional reply (under 150 words). Use {{first_name}} placeholder. No medical claims, no pricing promises."
  },
  "internalNotes": "1-2 sentence note for the activity log"
}
Only output JSON.`;
  const { text, provider } = await callLLM(prompt, { json: true, maxTokens: 800 });
  const parsed = safeParseJson(text) || { summary: rawText.slice(0, 120), intent: "other", urgency: "medium", sentiment: "neutral", extractedFields: {}, suggestedReply: { subject: "", body: "" }, internalNotes: "" };
  return { triage: parsed, provider, generatedAt: new Date().toISOString() };
}

async function respondToPublicTour(db, tourId, token, action) {
  if (!token || token !== signTourToken(tourId)) {
    const error = new Error("Invalid or expired tour link.");
    error.statusCode = 401;
    throw error;
  }
  const valid = new Set(["confirmed", "cancelled"]);
  if (!valid.has(action)) {
    const error = new Error("Invalid response.");
    error.statusCode = 422;
    throw error;
  }
  const { data: tour, error: fetchErr } = await db.from("tours").select("*").eq("id", tourId).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!tour) {
    const err = new Error("Tour not found.");
    err.statusCode = 404;
    throw err;
  }
  const patch = action === "confirmed"
    ? { family_confirmed_at: new Date().toISOString() }
    : { status: "cancelled" };
  const { error: updateErr } = await db.from("tours").update(patch).eq("id", tour.id);
  if (updateErr && !String(updateErr.message || "").includes("family_confirmed_at")) throw updateErr;
  await db.from("activity_logs").insert({
    location_id: tour.location_id,
    actor_id: null,
    entity_type: "tour",
    entity_id: tour.id,
    action: `tour_family_${action}`,
    metadata: { source: "public_link" }
  }).catch(() => {});
  return { ok: true, action };
}

async function scheduleTour(db, user, body = {}) {
  const lead = await getEntityById(db, "leads_v2", clean(body.leadId || body.lead_id));
  assertLocationAccess(user, lead.location_id);
  const scheduledAt = parseRequiredDate(body.scheduledAt || body.scheduled_at, "Choose a valid tour time.");
  const { data, error } = await db.from("tours").insert({
    location_id: lead.location_id,
    lead_id: lead.id,
    scheduled_at: scheduledAt.toISOString(),
    status: "scheduled",
    notes: clean(body.notes),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await db.from("leads_v2").update({ status: "tour_scheduled" }).eq("id", lead.id);
  await logActivity(db, user, lead.location_id, "tour", data.id, "tour_scheduled", { leadId: lead.id, scheduledAt: scheduledAt.toISOString() });
  return data;
}

async function updateTourStatus(db, user, id, status) {
  if (!TOUR_STATUSES.has(status)) {
    const error = new Error("Invalid tour status.");
    error.statusCode = 422;
    throw error;
  }
  const tour = await getEntityById(db, "tours", id);
  assertLocationAccess(user, tour.location_id);
  const now = new Date().toISOString();
  const patch = {
    status,
    completed_at: status === "completed" ? now : null,
    no_show_at: status === "no_show" ? now : null
  };
  const { data, error } = await db.from("tours").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  if (tour.lead_id && status === "completed") {
    await db.from("leads_v2").update({ status: "contacted" }).eq("id", tour.lead_id).neq("status", "move_in");
  }
  await logActivity(db, user, tour.location_id, "tour", id, "tour_status_changed", { status, leadId: tour.lead_id });
  return data;
}

async function createFollowUp(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const dueAt = parseRequiredDate(body.dueAt || body.due_at, "Choose a valid follow-up time.");
  const status = FOLLOW_UP_STATUSES.has(body.status) ? body.status : "open";
  const { data, error } = await db.from("follow_ups").insert({
    location_id: locationId,
    lead_id: clean(body.leadId || body.lead_id) || null,
    resident_id: clean(body.residentId || body.resident_id) || null,
    assigned_to: clean(body.assignedTo || body.assigned_to) || null,
    due_at: dueAt.toISOString(),
    status,
    note: clean(body.note),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "follow_up", data.id, "follow_up_created", { dueAt: dueAt.toISOString() });
  return data;
}

async function updateFollowUpStatus(db, user, id, status) {
  if (!FOLLOW_UP_STATUSES.has(status)) {
    const error = new Error("Invalid follow-up status.");
    error.statusCode = 422;
    throw error;
  }
  const followUp = await getEntityById(db, "follow_ups", id);
  assertLocationAccess(user, followUp.location_id);
  const { data, error } = await db
    .from("follow_ups")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, followUp.location_id, "follow_up", id, "follow_up_status_changed", { status, leadId: followUp.lead_id, residentId: followUp.resident_id });
  return data;
}

async function createTask(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const title = clean(body.title);
  if (!title) {
    const error = new Error("Task title is required.");
    error.statusCode = 422;
    throw error;
  }
  const status = TASK_STATUSES.has(body.status) ? body.status : "todo";
  const { data, error } = await db.from("staff_tasks").insert({
    location_id: locationId,
    lead_id: clean(body.leadId || body.lead_id) || null,
    resident_id: clean(body.residentId || body.resident_id) || null,
    assigned_to: clean(body.assignedTo || body.assigned_to) || null,
    title,
    task_type: clean(body.taskType || body.task_type || "Other"),
    status,
    due_at: body.dueAt ? new Date(body.dueAt).toISOString() : null,
    notes: clean(body.notes),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "staff_task", data.id, "task_created", { title });
  return data;
}

async function updateTaskStatus(db, user, id, status) {
  if (!TASK_STATUSES.has(status)) {
    const error = new Error("Invalid task status.");
    error.statusCode = 422;
    throw error;
  }
  const task = await getEntityById(db, "staff_tasks", id);
  assertLocationAccess(user, task.location_id);
  const { data, error } = await db
    .from("staff_tasks")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, task.location_id, "staff_task", id, "task_status_changed", { status });
  return data;
}

async function listOperations(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(locationId));
  const [residents, tours, followUps, tasks, notes, documents, emails] = await Promise.all([
    selectByLocations(db.from("residents_v2").select("*").order("created_at", { ascending: false }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("*").order("scheduled_at", { ascending: true }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*").order("due_at", { ascending: true }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("staff_tasks").select("*").order("created_at", { ascending: false }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("notes").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id"),
    selectByLocations(db.from("documents").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id"),
    selectByLocations(db.from("email_history").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id")
  ]);
  throwFirstError(residents, tours, followUps, tasks, notes, documents, emails);
  return {
    residents: residents.data || [],
    tours: tours.data || [],
    followUps: followUps.data || [],
    tasks: tasks.data || [],
    notes: notes.data || [],
    documents: documents.data || [],
    emailHistory: emails.data || []
  };
}

async function listCheckIns(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(locationId));
  const allowedLocations = locations.filter((location) => locationIds.includes(location.id));
  const { data, error } = await db
    .from("facility_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (String(error.message || "").toLowerCase().includes("does not exist")) return [];
    throw error;
  }
  if (user.isSuperAdmin && !clean(locationId)) return data || [];
  return (data || []).filter((row) => {
    const community = normalizeLocationName(row.community || row.location || "");
    return allowedLocations.some((location) => {
      const name = normalizeLocationName(location.name);
      const city = normalizeLocationName(location.city);
      return community === name || community.includes(name) || name.includes(community) || (city && community.includes(city));
    });
  });
}

async function createResident(db, user, body = {}) {
  let locationId = clean(body.locationId || body.location_id);
  const leadId = clean(body.leadId || body.lead_id);
  if (leadId) {
    const lead = await getEntityById(db, "leads_v2", leadId);
    assertLocationAccess(user, lead.location_id);
    locationId = lead.location_id;
  }
  assertLocationAccess(user, locationId);
  const fullName = clean(body.fullName || body.full_name || body.name);
  if (!fullName) {
    const error = new Error("Resident name is required.");
    error.statusCode = 422;
    throw error;
  }
  const { data, error } = await db.from("residents_v2").insert({
    location_id: locationId,
    lead_id: leadId || null,
    full_name: fullName,
    room_number: clean(body.roomNumber || body.room_number),
    care_level: clean(body.careLevel || body.care_level || "Assisted Living"),
    move_in_date: clean(body.moveInDate || body.move_in_date) || null,
    emergency_contact_name: clean(body.emergencyContactName || body.emergency_contact_name),
    emergency_contact_phone: clean(body.emergencyContactPhone || body.emergency_contact_phone),
    notes: clean(body.notes),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  if (data.lead_id) await db.from("leads_v2").update({ status: "move_in" }).eq("id", data.lead_id);
  await logActivity(db, user, locationId, "resident", data.id, "resident_created", { leadId: data.lead_id });
  return data;
}

async function createNote(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const note = clean(body.body || body.note);
  if (!note) {
    const error = new Error("Note is required.");
    error.statusCode = 422;
    throw error;
  }
  const { data, error } = await db.from("notes").insert({
    location_id: locationId,
    entity_type: clean(body.entityType || body.entity_type || "location"),
    entity_id: clean(body.entityId || body.entity_id) || locationId,
    body: note,
    visibility: clean(body.visibility || "internal"),
    mentioned_user_ids: Array.isArray(body.mentionedUserIds) ? body.mentionedUserIds : [],
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, data.entity_type, data.entity_id, "note_added", {});
  return data;
}

async function createDocumentRecord(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const fileName = clean(body.fileName || body.file_name);
  const storagePath = clean(body.storagePath || body.storage_path);
  if (!fileName || !storagePath) {
    const error = new Error("Document filename and storage path are required.");
    error.statusCode = 422;
    throw error;
  }
  const { data, error } = await db.from("documents").insert({
    location_id: locationId,
    entity_type: clean(body.entityType || body.entity_type || "location"),
    entity_id: clean(body.entityId || body.entity_id) || null,
    bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    file_name: fileName,
    file_type: clean(body.fileType || body.file_type),
    file_size: Number(body.fileSize || body.file_size || 0),
    document_type: clean(body.documentType || body.document_type || "Other"),
    notes: clean(body.notes),
    uploaded_by: user.id,
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "document", data.id, "document_uploaded", { fileName });
  return data;
}

async function createSignedUpload(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const fileName = safeFileName(clean(body.fileName || body.file_name || "document"));
  const entityType = clean(body.entityType || body.entity_type || "location");
  const entityId = clean(body.entityId || body.entity_id || "general");
  const storagePath = `${locationId}/${entityType}/${entityId}/${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${fileName}`;
  const { data, error } = await db.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(storagePath);
  if (error) throw error;
  return { bucket: DOCUMENT_BUCKET, storagePath, ...data };
}

async function getSignedDocumentUrl(db, user, documentId) {
  const doc = await getEntityById(db, "documents", documentId);
  assertLocationAccess(user, doc.location_id);
  const { data, error } = await db.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 60 * 10);
  if (error) throw error;
  return { url: data.signedUrl };
}

async function listUsers(db, user) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can manage users.");
    error.statusCode = 403;
    throw error;
  }
  const { data, error } = await db
    .from("profiles")
    .select("*, user_location_access(location_id, access_level, locations(name, slug))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createUserWithAccess(db, user, body = {}) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can create users.");
    error.statusCode = 403;
    throw error;
  }
  const email = clean(body.email).toLowerCase();
  const password = String(body.password || "");
  const fullName = clean(body.fullName || body.full_name || body.name);
  const role = USER_ROLES.has(body.role) ? body.role : "staff";
  const requestedLocations = Array.isArray(body.locationIds)
    ? body.locationIds.map(clean).filter(Boolean)
    : [clean(body.locationId || body.location_id)].filter(Boolean);
  if (!fullName) validationError("Full name is required.");
  if (!isValidEmail(email)) validationError("Enter a valid email address.");
  if (password.length < 8) validationError("Password must be at least 8 characters.");

  const allLocations = await getLocations(db, user);
  const allowedLocationIds = new Set(allLocations.map((location) => location.id));
  const locationIds = role === "super_admin" && !requestedLocations.length
    ? allLocations.map((location) => location.id)
    : requestedLocations.filter((id) => allowedLocationIds.has(id));
  if (!locationIds.length) validationError("Choose at least one valid location.");

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (createError) throw createError;
  const newUserId = created.user.id;

  const { error: profileError } = await db.from("profiles").upsert({
    id: newUserId,
    full_name: fullName,
    email,
    role,
    active: true,
    created_by: user.id
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  const accessRows = locationIds.map((locationId) => ({
    user_id: newUserId,
    location_id: locationId,
    access_level: role,
    created_by: user.id
  }));
  const { error: accessError } = await db.from("user_location_access").upsert(accessRows, { onConflict: "user_id,location_id" });
  if (accessError) throw accessError;

  await logActivity(db, user, locationIds[0], "profile", newUserId, "user_created", { email, role, locationCount: locationIds.length });
  return { id: newUserId, full_name: fullName, email, role, active: true, locationIds };
}

async function setUserActive(db, user, profileId, active) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can manage users.");
    error.statusCode = 403;
    throw error;
  }
  if (profileId === user.id && active === false) validationError("You cannot deactivate your own account.");
  const { data, error } = await db
    .from("profiles")
    .update({ active: Boolean(active) })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  const firstLocation = appFirstLocationIdForUser(db, profileId).catch(() => null);
  const locationId = await firstLocation;
  if (locationId) await logActivity(db, user, locationId, "profile", profileId, active ? "user_reactivated" : "user_deactivated", {});
  return data;
}

async function appFirstLocationIdForUser(db, profileId) {
  const { data } = await db.from("user_location_access").select("location_id").eq("user_id", profileId).limit(1).maybeSingle();
  return data?.location_id || null;
}

async function migrateLegacyData(db, user) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can sync legacy data.");
    error.statusCode = 403;
    throw error;
  }

  const locations = await getLocations(db, user);
  const locationMap = buildLocationMatcher(locations);
  const { data: oldLeads, error: oldLeadsError } = await db.from("leads").select("*").order("created_at", { ascending: true });
  if (oldLeadsError) throw oldLeadsError;

  const { data: existingV2, error: existingError } = await db
    .from("leads_v2")
    .select("id, normalized_phone, normalized_email, created_at, location_id");
  if (existingError) throw existingError;

  const existingKeys = new Set((existingV2 || []).map((lead) => legacyKey({
    phone: lead.normalized_phone,
    email: lead.normalized_email,
    created_at: lead.created_at,
    location_id: lead.location_id
  })));
  const legacyIdToV2 = new Map();
  const insertedLeadRows = [];
  let skippedNoLocation = 0;
  let skippedDuplicate = 0;

  for (const oldLead of oldLeads || []) {
    const locationName = clean(oldLead.location || oldLead.preferred_community || oldLead.preferredCommunity || "");
    const location = matchLocation(locationMap, locationName);
    if (!location) {
      skippedNoLocation += 1;
      continue;
    }

    const normalizedPhone = normalizeDigits(oldLead.phone);
    const normalizedEmail = clean(oldLead.email).toLowerCase() || null;
    const key = legacyKey({ phone: normalizedPhone, email: normalizedEmail, created_at: oldLead.created_at, location_id: location.id });
    const existing = (existingV2 || []).find((lead) => legacyKey({
      phone: lead.normalized_phone,
      email: lead.normalized_email,
      created_at: lead.created_at,
      location_id: lead.location_id
    }) === key);
    if (existing) {
      legacyIdToV2.set(oldLead.id, { id: existing.id, location_id: existing.location_id });
      skippedDuplicate += 1;
      continue;
    }
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }

    const payload = legacyLeadPayload(oldLead, location.id, user.id);
    const { data: inserted, error } = await db.from("leads_v2").insert(payload).select("id, location_id").single();
    if (error) throw error;
    legacyIdToV2.set(oldLead.id, inserted);
    insertedLeadRows.push({ legacyId: oldLead.id, id: inserted.id, locationId: inserted.location_id });
    existingKeys.add(key);
  }

  const tourCount = await migrateLegacyTours(db, oldLeads || [], legacyIdToV2, user.id);
  const followUpCount = await migrateLegacyFollowUps(db, oldLeads || [], legacyIdToV2, user.id);
  const activityCount = await migrateLegacyEvents(db, legacyIdToV2, user.id);
  const emailCount = await migrateLegacyEmails(db, legacyIdToV2, user.id);

  await logActivity(db, user, locations[0]?.id || insertedLeadRows[0]?.locationId, "system", null, "legacy_sync_completed", {
    insertedLeads: insertedLeadRows.length,
    skippedDuplicate,
    skippedNoLocation,
    tourCount,
    followUpCount,
    activityCount,
    emailCount
  });

  return {
    insertedLeads: insertedLeadRows.length,
    skippedDuplicate,
    skippedNoLocation,
    tourCount,
    followUpCount,
    activityCount,
    emailCount
  };
}

async function logActivity(db, user, locationId, entityType, entityId, action, metadata = {}) {
  await db.from("activity_logs").insert({
    location_id: locationId,
    actor_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    metadata,
    created_by: user.id
  });
}

function buildLeadPayload(body, locationId, userId = null) {
  const fullName = clean(body.fullName || body.full_name || body.name);
  const phone = clean(body.phone);
  const email = clean(body.email).toLowerCase();
  if (!fullName) validationError("Full name is required.");
  if (!isValidPhone(phone)) validationError("Enter a valid 10-digit phone number.");
  if (email && !isValidEmail(email)) validationError("Enter a valid email address.");
  return {
    location_id: locationId,
    full_name: fullName,
    phone: normalizePhone(phone),
    email: email || null,
    normalized_phone: normalizeDigits(phone),
    normalized_email: email || null,
    care_type: clean(body.careType || body.care_type || "Not sure yet"),
    source: clean(body.source || "Admin"),
    status: LEAD_STATUSES.has(body.status) ? body.status : "new",
    relationship_to_resident: clean(body.relationshipToResident || body.relationship_to_resident),
    move_timeline: clean(body.moveTimeline || body.move_timeline),
    payment_type: clean(body.paymentType || body.payment_type),
    current_situation: clean(body.currentSituation || body.current_situation),
    preferred_contact_method: clean(body.preferredContactMethod || body.preferred_contact_method),
    best_contact_time: clean(body.bestContactTime || body.best_contact_time),
    priority_tags: Array.isArray(body.priorityTags) ? body.priorityTags.map(clean).filter(Boolean) : [],
    lead_score: Number(body.leadScore || body.lead_score || 0),
    lead_temperature: clean(body.leadTemperature || body.lead_temperature || "cold"),
    notes_summary: clean(body.notes || body.message),
    created_by: userId
  };
}

function legacyLeadPayload(oldLead, locationId, userId) {
  const fullName = clean(oldLead.name || oldLead.full_name || oldLead.fullName || "Unknown");
  const phone = clean(oldLead.phone);
  const email = clean(oldLead.email).toLowerCase();
  return {
    location_id: locationId,
    full_name: fullName,
    phone: normalizePhone(phone) || phone,
    email: email || null,
    normalized_phone: normalizeDigits(phone),
    normalized_email: email || null,
    care_type: clean(oldLead.care_type || oldLead.careType || "Not sure yet"),
    source: clean(oldLead.source || "Website"),
    status: legacyStatus(oldLead.status),
    relationship_to_resident: clean(oldLead.relationship_to_resident || oldLead.relationshipToResident),
    move_timeline: clean(oldLead.move_timeline || oldLead.moveTimeline),
    payment_type: clean(oldLead.payment_type || oldLead.paymentType),
    current_situation: clean(oldLead.current_situation || oldLead.currentSituation),
    preferred_contact_method: clean(oldLead.preferred_contact_method || oldLead.preferredContactMethod),
    best_contact_time: clean(oldLead.best_contact_time || oldLead.bestContactTime),
    priority_tags: clean(oldLead.priority_tags || oldLead.priorityTags).split(/[,|]/).map((tag) => clean(tag)).filter(Boolean),
    lead_score: Number(oldLead.activity_score || oldLead.lead_score || 0),
    lead_temperature: clean(oldLead.activity_label || oldLead.lead_temperature || "cold").toLowerCase(),
    notes_summary: clean(oldLead.notes || oldLead.message),
    archived_at: legacyStatus(oldLead.status) === "archived" ? (oldLead.updated_at || oldLead.created_at || new Date().toISOString()) : null,
    created_at: oldLead.created_at || new Date().toISOString(),
    updated_at: oldLead.updated_at || oldLead.created_at || new Date().toISOString(),
    created_by: userId
  };
}

async function migrateLegacyTours(db, oldLeads, legacyIdToV2, userId) {
  let count = 0;
  for (const oldLead of oldLeads) {
    if (!oldLead.tour_scheduled_at) continue;
    const mapped = legacyIdToV2.get(oldLead.id);
    if (!mapped) continue;
    const { data: existing, error: existingError } = await db
      .from("tours")
      .select("id")
      .eq("lead_id", mapped.id)
      .eq("scheduled_at", oldLead.tour_scheduled_at)
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) continue;
    const { error } = await db.from("tours").insert({
      location_id: mapped.location_id,
      lead_id: mapped.id,
      scheduled_at: oldLead.tour_scheduled_at,
      status: "scheduled",
      notes: "Migrated from legacy tour date.",
      created_at: oldLead.tour_scheduled_at,
      updated_at: oldLead.updated_at || oldLead.tour_scheduled_at,
      created_by: userId
    });
    if (error) throw error;
    count += 1;
  }
  return count;
}

async function migrateLegacyFollowUps(db, oldLeads, legacyIdToV2, userId) {
  let count = 0;
  for (const oldLead of oldLeads) {
    if (!oldLead.follow_up_at) continue;
    const mapped = legacyIdToV2.get(oldLead.id);
    if (!mapped) continue;
    const { data: existing, error: existingError } = await db
      .from("follow_ups")
      .select("id")
      .eq("lead_id", mapped.id)
      .eq("due_at", oldLead.follow_up_at)
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) continue;
    const { error } = await db.from("follow_ups").insert({
      location_id: mapped.location_id,
      lead_id: mapped.id,
      due_at: oldLead.follow_up_at,
      status: "open",
      note: clean(oldLead.follow_up_note || "Migrated legacy follow-up."),
      created_at: oldLead.follow_up_at,
      updated_at: oldLead.updated_at || oldLead.follow_up_at,
      created_by: userId
    });
    if (error) throw error;
    count += 1;
  }
  return count;
}

async function migrateLegacyEvents(db, legacyIdToV2, userId) {
  const { data: rows, error } = await db.from("lead_events").select("*").order("created_at", { ascending: true }).limit(5000);
  if (error) return 0;
  const { data: existing, error: existingError } = await db
    .from("activity_logs")
    .select("entity_id, action, created_at")
    .limit(5000);
  if (existingError) throw existingError;
  const existingKeys = new Set((existing || []).map((row) => `${row.entity_id}:${row.action}:${row.created_at}`));
  const payload = [];
  for (const row of rows || []) {
    const mapped = legacyIdToV2.get(row.lead_id);
    if (!mapped) continue;
    const action = clean(row.event_type || "legacy_activity");
    const createdAt = row.created_at || new Date().toISOString();
    const key = `${mapped.id}:${action}:${createdAt}`;
    if (existingKeys.has(key)) continue;
    payload.push({
      location_id: mapped.location_id,
      actor_id: null,
      entity_type: "lead",
      entity_id: mapped.id,
      action,
      metadata: { detail: row.detail || "", legacyLeadId: row.lead_id, migrated: true },
      created_at: createdAt,
      updated_at: createdAt,
      created_by: userId
    });
    existingKeys.add(key);
  }
  if (!payload.length) return 0;
  const { error: insertError } = await db.from("activity_logs").insert(payload);
  if (insertError) throw insertError;
  return payload.length;
}

async function migrateLegacyEmails(db, legacyIdToV2, userId) {
  const { data: rows, error } = await db.from("email_outreach").select("*").order("created_at", { ascending: true }).limit(5000);
  if (error) return 0;
  const { data: existing, error: existingError } = await db
    .from("email_history")
    .select("lead_id, subject, created_at")
    .limit(5000);
  if (existingError) throw existingError;
  const existingKeys = new Set((existing || []).map((row) => `${row.lead_id}:${row.subject}:${row.created_at}`));
  const payload = [];
  for (const row of rows || []) {
    const mapped = legacyIdToV2.get(row.lead_id);
    if (!mapped) continue;
    const createdAt = row.created_at || new Date().toISOString();
    const key = `${mapped.id}:${row.subject}:${createdAt}`;
    if (existingKeys.has(key)) continue;
    payload.push({
      location_id: mapped.location_id,
      lead_id: mapped.id,
      recipient_email: clean(row.recipient_email || row.to || ""),
      subject: clean(row.subject || "Legacy email"),
      body: clean(row.body || row.message || ""),
      status: clean(row.status || "sent").toLowerCase(),
      provider: "legacy",
      sent_at: createdAt,
      created_at: createdAt,
      updated_at: row.updated_at || createdAt,
      created_by: userId
    });
    existingKeys.add(key);
  }
  if (!payload.length) return 0;
  const { error: insertError } = await db.from("email_history").insert(payload);
  if (insertError) throw insertError;
  return payload.length;
}

function legacyStatus(status) {
  const value = clean(status).toLowerCase();
  if (value === "tour scheduled") return "tour_scheduled";
  if (value === "moved in") return "move_in";
  if (value === "closed") return "archived";
  if (value === "contacted" || value === "tour completed" || value === "decision pending") return "contacted";
  return "new";
}

function buildLocationMatcher(locations) {
  const exact = new Map();
  for (const location of locations) {
    exact.set(normalizeLocationName(location.name), location);
    exact.set(normalizeLocationName(location.slug), location);
    if (location.city) exact.set(normalizeLocationName(location.city), location);
  }
  return { locations, exact };
}

function matchLocation(map, value) {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;
  if (map.exact.has(normalized)) return map.exact.get(normalized);
  return map.locations.find((location) => {
    const name = normalizeLocationName(location.name);
    const city = normalizeLocationName(location.city);
    return name.includes(normalized) || normalized.includes(name) || (city && normalized.includes(city));
  }) || null;
}

function normalizeLocationName(value) {
  return clean(value).toLowerCase().replace(/comfort care|senior living|community|fields/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function legacyKey({ phone, email, created_at, location_id }) {
  return [normalizeDigits(phone), clean(email).toLowerCase(), created_at ? new Date(created_at).toISOString() : "", location_id || ""].join("|");
}

async function findDuplicateLead(db, payload) {
  let query = db.from("leads_v2").select("id, full_name, phone, email, created_at").eq("location_id", payload.location_id).limit(1);
  if (payload.normalized_email) {
    query = query.or(`normalized_phone.eq.${payload.normalized_phone},normalized_email.eq.${payload.normalized_email}`);
  } else {
    query = query.eq("normalized_phone", payload.normalized_phone);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

async function getEntityById(db, table, id) {
  const { data, error } = await db.from(table).select("*").eq("id", id).single();
  if (error || !data) {
    const notFound = new Error("Record not found.");
    notFound.statusCode = 404;
    throw notFound;
  }
  return data;
}

async function getLocationById(db, id) {
  const { data, error } = await db.from("locations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function resolveLocationIds(user, locations, requestedLocationId = "") {
  if (requestedLocationId) {
    assertLocationAccess(user, requestedLocationId);
    return [requestedLocationId];
  }
  return locations.map((location) => location.id);
}

function scopeQuery(query, locationIds, column) {
  if (locationIds.length === 1) return query.eq(column, locationIds[0]);
  return query.in(column, locationIds);
}

function selectByLocations(query, locationIds, column) {
  return scopeQuery(query, locationIds, column);
}

function throwFirstError(...responses) {
  const failed = responses.find((response) => response?.error);
  if (failed) throw failed.error;
}

function parseRequiredDate(value, message) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) validationError(message);
  return date;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  throw error;
}

function normalizeDigits(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function safeFileName(value) {
  return String(value || "document")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "document";
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

module.exports = {
  DOCUMENT_BUCKET,
  getLocations,
  getDashboard,
  listLeads,
  getLeadDetail,
  createLead,
  updateLeadNotes,
  generateLeadEmailDraft,
  sendLeadEmail,
  exportLeadsCsv,
  updateLeadStatus,
  scheduleTour,
  updateTourStatus,
  createFollowUp,
  updateFollowUpStatus,
  createTask,
  updateTaskStatus,
  listOperations,
  listCheckIns,
  createResident,
  createNote,
  createDocumentRecord,
  createSignedUpload,
  getSignedDocumentUrl,
  listUsers,
  createUserWithAccess,
  setUserActive,
  migrateLegacyData,
  bulkUpdateLeads,
  getTourPublicLink,
  getPublicTour,
  respondToPublicTour,
  generateMorningBrief,
  generateTourPrepBrief,
  triageInboundMessage
};
