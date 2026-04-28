const nodemailer = require("nodemailer");

function clean(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

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

const VALID_STATUSES = new Set(["New", "Contacted", "Tour Scheduled", "Closed"]);
const CARE_TYPES = new Set(["Assisted Living", "Memory Care", "Independent Living", "Continuum of Care", "Not sure yet"]);

function validateLead(body) {
  const errors = [];
  ["fullName", "phone", "email", "preferredCommunity", "careType"].forEach((f) => {
    if (!clean(body[f] || "")) errors.push(`${f} is required.`);
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(body.email || ""))) errors.push("A valid email is required.");
  if (!/^[0-9+().\-\s]{7,20}$/.test(clean(body.phone || ""))) errors.push("A valid phone number is required.");
  if (!CARE_TYPES.has(clean(body.careType || ""))) errors.push("A valid care type is required.");
  return errors;
}

function sanitizeLead(body) {
  return {
    fullName: clean(body.fullName),
    phone: clean(body.phone),
    email: clean(body.email).toLowerCase(),
    preferredCommunity: clean(body.preferredCommunity),
    careType: clean(body.careType),
    message: clean(body.message || body.tourPreference || "")
  };
}

function personalizeEmail(template, lead) {
  const firstName = clean(lead.full_name || lead.fullName || "").split(" ")[0] || "there";
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{full_name}}", lead.full_name || lead.fullName || "")
    .replaceAll("{{community}}", lead.preferred_community || lead.preferredCommunity || "")
    .replaceAll("{{care_type}}", lead.care_type || lead.careType || "");
}

async function sendEmail({ to, subject, body }) {
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
    if (EMAIL_REPLY_TO) mail.replyTo = EMAIL_REPLY_TO;
    await transporter.sendMail(mail);
    return { mode: "live", status: "Sent", message: `Email sent to ${to}.` };
  } catch (err) {
    return { mode: "live", status: "Send Failed", message: err.message || "Failed to send email." };
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toLeadCsv(leads) {
  const headers = ["Full name","Phone number","Email","Preferred community","Care type","Message","Status","Date submitted"];
  const rows = leads.map((l) => [l.full_name, l.phone, l.email, l.preferred_community, l.care_type, l.message, l.status, l.created_at]);
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
  personalizeEmail, sendEmail, csvCell, toLeadCsv,
  parseDateFilter, mostCommon, VALID_STATUSES, CARE_TYPES
};
