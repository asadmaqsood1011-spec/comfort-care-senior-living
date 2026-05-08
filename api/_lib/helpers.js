const nodemailer = require("nodemailer");

function clean(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_200_000) { req.destroy(); reject(new Error("Payload too large")); }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

const VALID_STATUSES = new Set(["New", "Contacted", "Tour Scheduled", "Tour Completed", "Decision Pending", "Moved In", "Closed"]);
const VALID_SOURCES = new Set(["Website", "Tablet", "Upload", "Admin"]);
const CARE_TYPES = new Set(["Assisted Living", "Memory Care", "Independent Living", "Continuum of Care", "Not sure yet"]);
const PRIORITY_TAGS = new Set(["Urgent", "Medicaid", "Memory Care", "Tour Ready", "Needs Pricing"]);

function validateLead(body) {
  const errors = [];
  const lead = sanitizeLead(body);
  const rawPhone = clean(body.phone || "");
  if (!lead.fullName) errors.push("Full name is required.");
  if (!rawPhone) errors.push("Phone is required.");
  else if (!isValidPhone(rawPhone)) errors.push("Enter a valid 10-digit phone number.");
  if (lead.email && !isValidEmail(lead.email)) errors.push("A valid email is required.");
  if (lead.careType && !CARE_TYPES.has(lead.careType)) errors.push("A valid care type is required.");
  return errors;
}

function sanitizeLead(body) {
  const source = clean(body.source || (body.kind ? "Website" : ""));
  const location = clean(body.location || body.preferredCommunity || body.community || "");
  const details = {
    relationshipToResident: clean(body.relationshipToResident || body.relationship_to_resident || body.relationship || ""),
    moveTimeline: clean(body.moveTimeline || body.move_timeline || body.timeline || ""),
    paymentType: clean(body.paymentType || body.payment_type || body.budgetType || ""),
    currentSituation: clean(body.currentSituation || body.current_situation || ""),
    preferredContactMethod: clean(body.preferredContactMethod || body.preferred_contact_method || ""),
    bestContactTime: clean(body.bestContactTime || body.best_contact_time || "")
  };
  const notes = buildLeadNotes(body.notes || body.message || body.tourPreference || "", details);
  const lead = {
    fullName: clean(body.fullName || body.name),
    name: clean(body.name || body.fullName),
    phone: normalizePhone(body.phone),
    email: clean(body.email).toLowerCase(),
    preferredCommunity: location,
    location,
    careType: clean(body.careType || body.care_type || "Not sure yet"),
    message: notes,
    notes,
    ...details,
    source: VALID_SOURCES.has(source) ? source : "Website",
    status: VALID_STATUSES.has(clean(body.status || "")) ? clean(body.status) : "New"
  };
  lead.priorityTags = normalizePriorityTags(body.priorityTags || body.priority_tags || "", lead);
  return lead;
}

function phoneDigits(value) {
  return clean(value).replace(/\D/g, "");
}

function isValidPhone(value) {
  const digits = phoneDigits(value);
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function normalizePhone(value) {
  const digits = phoneDigits(value);
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return "";
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function isValidEmail(value) {
  const email = clean(value).toLowerCase();
  return EMAIL_REGEX.test(email) && !email.includes("..");
}

function leadInsertPayload(body, defaults = {}, options = {}) {
  const lead = sanitizeLead({ ...defaults, ...body });
  const payload = {
    name: lead.fullName,
    phone: lead.phone,
    email: lead.email || null,
    care_type: lead.careType,
    notes: lead.notes,
    location: lead.location,
    source: lead.source,
    status: lead.status
  };
  if (options.includeOptional === false) return payload;
  return {
    ...payload,
    relationship_to_resident: lead.relationshipToResident || null,
    move_timeline: lead.moveTimeline || null,
    payment_type: lead.paymentType || null,
    current_situation: lead.currentSituation || null,
    preferred_contact_method: lead.preferredContactMethod || null,
    best_contact_time: lead.bestContactTime || null,
    priority_tags: lead.priorityTags.join(", ")
  };
}

function normalizeLeadRow(row = {}) {
  const name = row.name || row.full_name || row.fullName || "";
  const location = row.location || row.preferred_community || row.preferredCommunity || "";
  const notes = row.notes || row.message || "";
  const parsedReminder = parseReminderFromNotes(notes);
  const parsedTour = parseTourFromNotes(notes);
  const source = normalizeLeadSource(row.source, notes);
  const lead = {
    id: row.id,
    name,
    fullName: name,
    phone: row.phone || "",
    email: row.email || "",
    location,
    preferredCommunity: location,
    careType: row.care_type || row.careType || "",
    notes,
    message: notes,
    source,
    status: row.status || "New",
    relationshipToResident: row.relationship_to_resident || row.relationshipToResident || parseDetailFromNotes(notes, "Relationship") || "",
    moveTimeline: row.move_timeline || row.moveTimeline || parseDetailFromNotes(notes, "Timeline") || "",
    paymentType: row.payment_type || row.paymentType || parseDetailFromNotes(notes, "Payment") || "",
    currentSituation: row.current_situation || row.currentSituation || parseDetailFromNotes(notes, "Current situation") || "",
    preferredContactMethod: row.preferred_contact_method || row.preferredContactMethod || parseDetailFromNotes(notes, "Preferred contact") || "",
    bestContactTime: row.best_contact_time || row.bestContactTime || parseDetailFromNotes(notes, "Best time") || "",
    followUpAt: row.follow_up_at || row.followUpAt || parsedReminder.followUpAt || "",
    followUpNote: row.follow_up_note || row.followUpNote || parsedReminder.followUpNote || "",
    tourScheduledAt: row.tour_scheduled_at || row.tourScheduledAt || parsedTour.tourScheduledAt || "",
    submittedAt: row.created_at || row.submittedAt || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
  lead.priorityTags = normalizePriorityTags(row.priority_tags || row.priorityTags || "", lead);
  const activity = calculateLeadScoreDetails(lead);
  lead.activityScore = activity.score;
  lead.activityLabel = activity.label;
  lead.activityReasons = activity.reasons;
  lead.activityAction = activity.action;
  return lead;
}

function buildLeadNotes(notes, details = {}) {
  const base = clean(notes);
  const detailText = [
    ["Relationship", details.relationshipToResident],
    ["Timeline", details.moveTimeline],
    ["Payment", details.paymentType],
    ["Current situation", details.currentSituation],
    ["Preferred contact", details.preferredContactMethod],
    ["Best time", details.bestContactTime]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
  return [base, detailText ? `Inquiry Details: ${detailText}` : ""].filter(Boolean).join(" | ");
}

function normalizePriorityTags(value, lead = {}) {
  const explicit = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\|]/);
  const tags = new Set(explicit.map((item) => clean(item)).filter((item) => PRIORITY_TAGS.has(item)));
  const text = [
    lead.notes,
    lead.paymentType,
    lead.moveTimeline,
    lead.careType,
    lead.currentSituation
  ].join(" ").toLowerCase();
  if (text.includes("urgent") || text.includes("asap") || text.includes("immediate") || text.includes("now")) tags.add("Urgent");
  if (text.includes("medicaid") || text.includes("waiver")) tags.add("Medicaid");
  if ((lead.careType || "").toLowerCase().includes("memory") || text.includes("memory care")) tags.add("Memory Care");
  if (text.includes("tour") || text.includes("visit")) tags.add("Tour Ready");
  if (text.includes("pricing") || text.includes("price") || text.includes("cost") || text.includes("rate")) tags.add("Needs Pricing");
  return [...tags].filter((tag) => PRIORITY_TAGS.has(tag));
}

function parseDetailFromNotes(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(notes || "").match(new RegExp(`${escaped}:\\s*([^|]+)`, "i"));
  return clean(match?.[1] || "");
}

function normalizeLeadSource(source, notes) {
  const cleaned = clean(source || "");
  const inferred = inferSourceFromNotes(notes);
  if (!cleaned || !VALID_SOURCES.has(cleaned)) return inferred || "Website";
  if (cleaned === "Website" && inferred && inferred !== "Website") return inferred;
  return cleaned;
}

function inferSourceFromNotes(notes) {
  const text = String(notes || "");
  const match = text.match(/\bsource\s*:\s*(website|tablet|upload|admin)\b/i);
  if (!match) return "";
  const value = match[1].toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseReminderFromNotes(notes) {
  const match = String(notes || "").match(/\[Follow-up due:\s*([^\]]+)\]\s*([^\n]*)/i);
  return {
    followUpAt: match?.[1]?.trim() || "",
    followUpNote: match?.[2]?.trim() || ""
  };
}

function parseTourFromNotes(notes) {
  const match = String(notes || "").match(/\[Tour scheduled:\s*([^\]]+)\]/i);
  return {
    tourScheduledAt: match?.[1]?.trim() || ""
  };
}

function calculateLeadScore(lead = {}) {
  return calculateLeadScoreDetails(lead).score;
}

function calculateLeadScoreDetails(lead = {}) {
  let score = 0;
  const reasons = [];
  const text = [
    lead.notes,
    lead.currentSituation,
    lead.moveTimeline,
    lead.paymentType,
    lead.careType,
    ...(lead.priorityTags || [])
  ].join(" ").toLowerCase();

  const add = (points, reason) => {
    score += points;
    if (reason) reasons.push(reason);
  };

  // Negation helpers — detect "not X" / "no X" patterns to cancel false positives
  const negated = (keyword) => {
    const patterns = [`not ${keyword}`, `no ${keyword}`, `isn't ${keyword}`, `not yet ${keyword}`, `don't need ${keyword}`];
    return patterns.some((p) => text.includes(p));
  };

  if (!negated("urgent") && (text.includes("urgent") || text.includes("asap") || text.includes("immediate"))) add(34, "Urgent timeline");
  if (text.includes("within 30") || text.includes("within thirty")) add(24, "Move within 30 days");
  if (text.includes("30-60") || text.includes("30 to 60")) add(14, "Move within 60 days");
  if (text.includes("researching") || text.includes("just looking") || text.includes("just researching") || text.includes("not ready")) {
    score -= 8;
    reasons.push("Early research stage");
  }
  if ((lead.careType || "").toLowerCase().includes("memory") || text.includes("memory care")) add(15, "Memory care need");
  if (!negated("medicaid") && (text.includes("medicaid") || text.includes("waiver"))) add(8, "Medicaid/waiver question");

  // Skip text-based tour signal if status already handles it — avoids double-counting
  const tourHandledByStatus = ["Tour Scheduled", "Tour Completed", "Decision Pending"].includes(lead.status);
  if (!tourHandledByStatus && (text.includes("tour") || text.includes("visit"))) add(16, "Tour interest");

  if (text.includes("pricing") || text.includes("price") || text.includes("cost") || text.includes("rate")) add(10, "Pricing question");
  if (!negated("hospital") && (text.includes("hospital") || text.includes("discharge"))) add(18, "Hospital/discharge situation");
  if (text.includes("fall") || text.includes("unsafe") || text.includes("wandering")) add(18, "Safety concern");
  if ((lead.source || "").toLowerCase() === "tablet") add(8, "In-person/tablet lead");
  if ((lead.source || "").toLowerCase() === "admin" || (lead.source || "").toLowerCase() === "upload") add(3, "External lead");
  if (lead.phone) add(6, "Phone provided");
  if (lead.email) add(4, "Email provided");
  if (lead.followUpAt) add(5, "Follow-up set");
  if (lead.status === "Tour Scheduled" && lead.tourScheduledAt) add(26, "Tour scheduled");
  if (lead.status === "Tour Completed") add(30, "Tour completed");
  if (lead.status === "Decision Pending") add(38, "Decision pending");
  if (lead.status === "Moved In") add(32, "Moved in");
  if (lead.status === "Closed") {
    score = Math.min(score, 20);
    reasons.unshift("Closed lead");
  }

  // Time decay — -1 point per day past 14 days of inactivity, capped at -20
  const lastActivity = lead.updatedAt || lead.submittedAt;
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
    : 0;
  if (daysSinceActivity > 14 && lead.status !== "Closed" && lead.status !== "Moved In") {
    const decay = Math.min(daysSinceActivity - 14, 20);
    score -= decay;
    reasons.push(`Inactive ${daysSinceActivity}d`);
  }

  score = Math.max(0, Math.min(100, score));

  // Stale override — 30+ days no activity, regardless of score
  const isStale = daysSinceActivity >= 30 && lead.status !== "Closed" && lead.status !== "Moved In";
  const label = isStale ? "Stale" : leadScoreLabel(score);

  return {
    score,
    label,
    reasons: [...new Set(reasons)].slice(0, 6),
    action: leadSuggestedAction({ ...lead, activityScore: score, activityLabel: label })
  };
}

function leadScoreLabel(score) {
  if (score >= 70) return "Hot";
  if (score >= 35) return "Warm";
  return "Cold";
}

function leadSuggestedAction(lead = {}) {
  if (lead.status === "Closed") return "No action needed";
  if (lead.status === "Moved In") return "Move-in completed";
  if (lead.status === "Decision Pending") return "This family is deciding — address objections now";
  if (lead.status === "Tour Completed") return "Follow up within 24hrs while the tour is fresh";
  if (lead.status === "Tour Scheduled" && lead.tourScheduledAt) return "Confirm tour details and send a reminder";
  if ((lead.activityLabel || leadScoreLabel(lead.activityScore || 0)) === "Stale") return "Re-engage — no activity in 30+ days";
  if ((lead.activityLabel || leadScoreLabel(lead.activityScore || 0)) === "Hot") return "Call today and offer tour times";
  if ((lead.activityLabel || leadScoreLabel(lead.activityScore || 0)) === "Warm") return "Follow up soon with care and pricing answers";
  return "Nurture with helpful information";
}

function personalizeEmail(template, lead) {
  const normalized = normalizeLeadRow(lead);
  const firstName = clean(normalized.fullName || "").split(" ")[0] || "there";
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{full_name}}", normalized.fullName || "")
    .replaceAll("{{community}}", normalized.location || "")
    .replaceAll("{{location}}", normalized.location || "")
    .replaceAll("{{care_type}}", normalized.careType || "")
    .replaceAll("{{lead_message}}", normalized.notes || "");
}

async function sendEmail({ to, subject, body, html }) {
  const GMAIL_USER = process.env.GMAIL_USER || "";
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
  const EMAIL_FROM = process.env.EMAIL_FROM || `Comfort Care Senior Living <${GMAIL_USER}>`;
  const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return { mode: "demo", status: "Demo Sent", message: "Demo mode: add GMAIL_USER and GMAIL_APP_PASSWORD to send real emails." };
  }
  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
    const mail = { from: EMAIL_FROM, to, subject, text: body };
    if (html) mail.html = html;
    if (EMAIL_REPLY_TO) mail.replyTo = EMAIL_REPLY_TO;
    await transporter.sendMail(mail);
    return { mode: "live", status: "Sent", message: `Email sent to ${to}.` };
  } catch (err) {
    return { mode: "live", status: "Send Failed", message: err.message || "Failed to send email." };
  }
}

function buildWelcomeEmailContent({ firstName, community, careType, notes }) {
  const notesLower = (notes || "").toLowerCase();
  const isUrgent = /urgent|asap|immediate|right away|as soon as/.test(notesLower);

  // Extract who they're looking for
  const forMatch = notes.match(/(?:for (?:his|her|my|our|their)\s+(\w+)|for (?:my )?(dad|mom|mother|father|grandfather|grandmother|grandpa|grandma|husband|wife|parent|parents|loved one))/i);
  const forWhom = forMatch ? forMatch[2] || forMatch[1] : null;

  let opening = "";
  if (isUrgent && forWhom) {
    opening = `We understand you're urgently looking for ${careType} support for your ${forWhom}, and we want to help make this as smooth as possible.`;
  } else if (isUrgent) {
    opening = `We understand this is an urgent situation and we're here to help. Your inquiry has been received and our team will prioritize your case.`;
  } else if (forWhom) {
    opening = `We'd be honored to help you find the right care for your ${forWhom} at ${community}.`;
  } else {
    opening = `We've received your inquiry about ${careType} at ${community} and we're glad you reached out.`;
  }

  const subject = isUrgent
    ? `We're here to help — Comfort Care Senior Living`
    : `Thank you for reaching out, ${firstName}`;

  const body = `Hi ${firstName},\n\n${opening}\n\nAt Comfort Care Senior Living, we're committed to helping families find compassionate, personalized care. One of our advisors will be in touch with you shortly.\n\nWarm regards,\nThe Comfort Care Team`;

  return { subject, body };
}

function buildBrandedEmail(bodyText) {
  const paragraphs = bodyText
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px 0;color:#2d3748;font-size:15px;line-height:1.65;">${p}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#11233a;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#e7d2a5;font-family:Georgia,serif;">Comfort Care</p>
            <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;letter-spacing:0.5px;">Senior Living</h1>
            <div style="width:40px;height:2px;background:#e7d2a5;margin:12px auto 0;"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            ${paragraphs}
          </td>
        </tr>
        <!-- Divider -->
        <tr>
          <td style="padding:0 40px;">
            <div style="height:1px;background:#e7d2a5;opacity:0.5;"></div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;font-family:Georgia,serif;">Comfort Care Senior Living &mdash; Where Every Day Matters</p>
            <p style="margin:6px 0 0;font-size:11px;color:#c4b89a;">Compassionate Care &bull; Trusted Advisors &bull; Family First</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toLeadCsv(leads) {
  const headers = ["Full name","Phone number","Email","Location","Source","Care type","Activity score","Activity label","Activity reasons","Suggested action","Priority tags","Timeline","Payment","Relationship","Preferred contact","Best time","Tour scheduled","Notes","Status","Date submitted"];
  const rows = leads.map((row) => {
    const l = normalizeLeadRow(row);
    return [l.fullName, l.phone, l.email, l.location, l.source, l.careType, l.activityScore, l.activityLabel, l.activityReasons.join(", "), l.activityAction, l.priorityTags.join(", "), l.moveTimeline, l.paymentType, l.relationshipToResident, l.preferredContactMethod, l.bestContactTime, l.tourScheduledAt, l.notes, l.status, l.submittedAt];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function parseDateFilter(value, endOfDay) {
  const cleaned = clean(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${cleaned}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

module.exports = {
  clean, readBody, sendJson, validateLead, sanitizeLead,
  leadInsertPayload, normalizeLeadRow, personalizeEmail, sendEmail, buildBrandedEmail, buildWelcomeEmailContent, csvCell, toLeadCsv,
  parseDateFilter, mostCommon, calculateLeadScore, normalizePhone, isValidPhone, isValidEmail,
  VALID_STATUSES, VALID_SOURCES, CARE_TYPES, PRIORITY_TAGS
};
