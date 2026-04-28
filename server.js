const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { Sequelize, DataTypes, Op } = require("sequelize");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

loadEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 4173);
const SESSION_SECRET = requiredEnv("SESSION_SECRET");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@comfortcaresl.local").toLowerCase();
const ADMIN_PASSWORD_HASH = requiredEnv("ADMIN_PASSWORD_HASH");
const DATABASE_URL = requiredEnv("DATABASE_URL");
const USE_EMBEDDED_POSTGRES = process.env.USE_EMBEDDED_POSTGRES === "true";
const EMAIL_SEND_MODE = (process.env.EMAIL_SEND_MODE || "demo").toLowerCase();
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const EMAIL_FROM = process.env.EMAIL_FROM || `Comfort Care Senior Living <${GMAIL_USER}>`;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: process.env.DATABASE_SSL === "true" ? {
    ssl: { require: true, rejectUnauthorized: false }
  } : {}
});

const Lead = sequelize.define("Lead", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fullName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: "full_name"
  },
  phone: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  preferredCommunity: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: "preferred_community"
  },
  careType: {
    type: DataTypes.STRING(80),
    allowNull: false,
    field: "care_type"
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ""
  },
  status: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: "New"
  }
}, {
  tableName: "leads",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at"
});

const EmailOutreach = sequelize.define("EmailOutreach", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: "lead_id"
  },
  recipientEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: "recipient_email"
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: "Demo Sent"
  }
}, {
  tableName: "email_outreach",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at"
});

const sessions = new Map();
const VALID_STATUSES = new Set(["New", "Contacted", "Tour Scheduled", "Closed"]);
const CARE_TYPES = new Set(["Assisted Living", "Memory Care", "Independent Living", "Continuum of Care", "Not sure yet"]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/leads") {
      return handleLeadCreate(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      return handleAdminLogin(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      return handleAdminLogout(req, res);
    }

    if (url.pathname === "/api/admin/leads" && req.method === "GET") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return sendJson(res, 200, { leads: await getLeadsFromDb(url.searchParams) });
    }

    if (url.pathname === "/api/admin/leads/export" && req.method === "GET") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleLeadExport(req, res, url);
    }

    if (url.pathname === "/api/admin/leads/import" && req.method === "POST") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleLeadImport(req, res);
    }

    if (url.pathname === "/api/admin/outreach/draft" && req.method === "POST") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleOutreachDraft(req, res);
    }

    if (url.pathname === "/api/admin/outreach/send" && req.method === "POST") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleOutreachSend(req, res);
    }

    if (url.pathname === "/api/admin/outreach/send-live" && req.method === "POST") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleOutreachSendLive(req, res);
    }

    const statusMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/status$/);
    if (statusMatch && req.method === "PATCH") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleLeadStatusUpdate(req, res, Number(statusMatch[1]));
    }

    const deleteMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)$/);
    if (deleteMatch && req.method === "DELETE") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      await Lead.destroy({ where: { id: Number(deleteMatch[1]) } });
      return sendJson(res, 200, { ok: true });
    }

    const emailLeadMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/email$/);
    if (emailLeadMatch && req.method === "POST") {
      if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Unauthorized" });
      return handleSingleLeadEmail(req, res, Number(emailLeadMatch[1]));
    }

    if (req.method === "GET" && url.pathname === "/admin") {
      return serveFile(res, path.join(PUBLIC_DIR, "admin.html"));
    }

    if (req.method === "GET" && url.pathname === "/robots.txt") {
      return sendText(res, 200, [
        "User-agent: *",
        "Allow: /",
        `Sitemap: http://${req.headers.host}/sitemap.xml`
      ].join("\n"));
    }

    if (req.method === "GET" && url.pathname === "/sitemap.xml") {
      return sendXml(res, sitemapXml(req));
    }

    if (req.method === "GET" && (
      /^\/communities\/[a-z0-9-]+\/?$/.test(url.pathname) ||
      ["/privacy", "/privacy/", "/terms", "/terms/"].includes(url.pathname)
    )) {
      return serveFile(res, path.join(PUBLIC_DIR, "index.html"));
    }

    if (req.method === "GET") {
      const filePath = safePublicPath(url.pathname === "/" ? "/index.html" : url.pathname);
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return serveFile(res, filePath);
      }
    }

    sendText(res, 404, "Not found");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong." });
  }
});

let embeddedPostgres;

startServer().catch((error) => {
  console.error("Unable to start Comfort Care app. Check DATABASE_URL and PostgreSQL availability.");
  console.error(error.message);
  process.exit(1);
});

async function startServer() {
  if (USE_EMBEDDED_POSTGRES) {
    embeddedPostgres = await startEmbeddedPostgres();
  }
  await sequelize.authenticate();
  await Lead.sync();
  await EmailOutreach.sync();
  server.listen(PORT, () => {
    console.log(`Comfort Care redesign running at http://localhost:${PORT}`);
  });
}

async function startEmbeddedPostgres() {
  if (await canConnectToPostgres(DATABASE_URL)) return null;

  const EmbeddedPostgres = require("embedded-postgres").default;
  const dbUrl = new URL(DATABASE_URL);
  const databaseName = dbUrl.pathname.replace(/^\//, "") || "comfortcare";
  const databaseDir = path.join(ROOT, ".local-postgres");
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: decodeURIComponent(dbUrl.username || "postgres"),
    password: decodeURIComponent(dbUrl.password || "password"),
    port: Number(dbUrl.port || 5432),
    persistent: true,
    onLog: () => {},
    onError: (message) => {
      const text = String(message || "");
      if (text && !text.includes("already exists")) console.error(text);
    }
  });

  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(databaseName);
  } catch (error) {
    if (!String(error.message || error).includes("already exists")) throw error;
  }
  return pg;
}

async function canConnectToPostgres(connectionString) {
  const { Client } = require("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function shutdown() {
  server.close();
  await sequelize.close().catch(() => {});
  if (embeddedPostgres) await embeddedPostgres.stop().catch(() => {});
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

async function handleLeadCreate(req, res) {
  const body = await readJson(req);
  const errors = validateLead(body);
  if (errors.length) return sendJson(res, 422, { errors });

  const lead = sanitizeLead(body);
  await Lead.create({
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    preferredCommunity: lead.preferredCommunity,
    careType: lead.careType,
    message: lead.message || lead.tourPreference || "",
    status: "New"
  });
  sendJson(res, 201, {
    ok: true,
    message: "Thank you. Your information is securely stored. We never share your data."
  });
}

async function handleAdminLogin(req, res) {
  const body = await readJson(req);
  const email = clean(body.email || "").toLowerCase();
  const password = String(body.password || "");

  if (email !== ADMIN_EMAIL || !(await verifyPassword(password, ADMIN_PASSWORD_HASH))) {
    return sendJson(res, 401, { error: "Invalid email or password." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { email, createdAt: Date.now() });
  res.setHeader("Set-Cookie", cookie("ccsl_session", signToken(token), {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
    maxAge: 60 * 60 * 8
  }));
  sendJson(res, 200, { ok: true });
}

function handleAdminLogout(req, res) {
  const token = readSignedSession(req);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", cookie("ccsl_session", "", {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
    maxAge: 0
  }));
  sendJson(res, 200, { ok: true });
}

async function handleLeadStatusUpdate(req, res, id) {
  const body = await readJson(req);
  const status = clean(body.status || "");
  if (!VALID_STATUSES.has(status)) return sendJson(res, 422, { error: "Invalid status." });
  await Lead.update({ status }, { where: { id } });
  sendJson(res, 200, { ok: true });
}

async function handleLeadExport(req, res, url) {
  const leads = await getLeadsFromDb(url.searchParams);
  const csv = toLeadCsv(leads);
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"comfort-care-leads.csv\"",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  res.end(csv);
}

async function handleLeadImport(req, res) {
  const body = await readJson(req);
  const rows = parseCsv(cleanCsv(body.csv || ""));
  if (!rows.length) return sendJson(res, 422, { error: "No CSV rows found." });

  const imported = [];
  const skipped = [];
  for (const [index, row] of rows.entries()) {
    const lead = normalizeImportedLead(row);
    const errors = validateLead(lead);
    if (errors.length) {
      skipped.push({ row: index + 2, reason: errors[0] });
      continue;
    }
    const duplicate = await Lead.findOne({ where: { email: clean(lead.email).toLowerCase() } });
    if (duplicate) {
      skipped.push({ row: index + 2, reason: "Duplicate email." });
      continue;
    }
    imported.push(await Lead.create({
      fullName: lead.fullName,
      phone: lead.phone,
      email: clean(lead.email).toLowerCase(),
      preferredCommunity: lead.preferredCommunity,
      careType: lead.careType,
      message: lead.message || "Imported lead",
      status: VALID_STATUSES.has(clean(lead.status || "")) ? clean(lead.status) : "New"
    }));
  }

  sendJson(res, 200, {
    ok: true,
    imported: imported.length,
    skipped,
    message: `Imported ${imported.length} lead${imported.length === 1 ? "" : "s"}.`
  });
}

async function handleOutreachDraft(req, res) {
  const body = await readJson(req);
  const filters = body.filters || {};
  const leads = await getLeadsFromDb(filtersToParams(filters));
  const community = clean(filters.community || "");
  const careType = mostCommon(leads.map((lead) => lead.careType)) || "senior living";
  const targetCommunity = community || mostCommon(leads.map((lead) => lead.preferredCommunity)) || "Comfort Care";

  // If OpenAI key available, generate real AI draft
  if (OPENAI_API_KEY) {
    try {
      const prompt = `Write a short, warm outreach email for a senior living community called "${targetCommunity}". 
The email is for leads interested in "${careType}". 
Use {{first_name}} as the placeholder for their first name.
Keep it under 150 words. Friendly, empathetic, not salesy. Sign off as "The Comfort Care Team".
Return JSON with keys: subject (string) and body (string).`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 400
        })
      });
      const aiData = await aiRes.json();
      const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
      if (parsed.subject && parsed.body) {
        return sendJson(res, 200, {
          subject: parsed.subject,
          body: parsed.body,
          recipients: leads.length,
          ai: true
        });
      }
    } catch (err) {
      console.error("OpenAI draft error:", err.message);
      // fall through to template
    }
  }

  // Fallback template
  const subject = community
    ? `A personal note from ${targetCommunity}`
    : "A personal note from Comfort Care Senior Living";
  const bodyText = [
    "Hi {{first_name}},",
    "",
    `I wanted to personally follow up from Comfort Care Senior Living. Based on your interest in ${careType}, our team can help answer questions about care options, transparent pricing, availability, and scheduling a private tour.`,
    "",
    community
      ? `${targetCommunity} is designed to feel warm, safe, and home-like while still providing dependable support from a caring team.`
      : "Our Michigan communities are designed to feel warm, safe, and home-like while still providing dependable support from a caring team.",
    "",
    "Would you like us to help schedule a time to talk or tour?",
    "",
    "Warmly,",
    "The Comfort Care Team",
    "",
    "You are receiving this because you contacted Comfort Care or were added by an authorized administrator. Reply STOP to opt out."
  ].join("\n");

  sendJson(res, 200, {
    subject,
    body: bodyText,
    recipients: leads.length,
    ai: false
  });
}

async function handleOutreachSendLive(req, res) {
  const body = await readJson(req);
  const subject = clean(body.subject || "");
  const emailBody = clean(body.body || "");
  if (!subject || !emailBody) return sendJson(res, 422, { error: "Subject and body are required." });
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return sendJson(res, 422, { error: "Gmail credentials not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env" });
  }

  const leads = await getLeadsFromDb(filtersToParams(body.filters || {}));
  const validLeads = leads.filter((lead) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email));

  if (!validLeads.length) return sendJson(res, 200, { ok: true, sent: 0, message: "No valid leads to email." });

  let sent = 0;
  let failed = 0;

  for (const lead of validLeads) {
    const personalizedBody = personalizeEmail(emailBody, lead);
    const result = await sendEmail({ to: lead.email, subject, body: personalizedBody });
    await EmailOutreach.create({
      leadId: lead.id,
      recipientEmail: lead.email,
      subject,
      body: personalizedBody,
      status: result.status
    });
    await Lead.update({ status: "Contacted" }, { where: { id: lead.id } });
    if (result.status === "Sent") sent++;
    else failed++;
  }

  sendJson(res, 200, {
    ok: true,
    sent,
    failed,
    message: `Live emails sent: ${sent}${failed ? `, ${failed} failed` : ""}.`
  });
}

async function handleOutreachSend(req, res) {
  const body = await readJson(req);
  const subject = clean(body.subject || "");
  const emailBody = clean(body.body || "");
  if (!subject || !emailBody) return sendJson(res, 422, { error: "Subject and body are required." });

  const leads = await getLeadsFromDb(filtersToParams(body.filters || {}));
  const validLeads = leads.filter((lead) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email));
  const testRecipient = clean(body.testRecipient || "").toLowerCase();
  const liveMode = EMAIL_SEND_MODE === "live" && Boolean(GMAIL_USER) && Boolean(GMAIL_APP_PASSWORD);

  if (testRecipient) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) {
      return sendJson(res, 422, { error: "Enter a valid test recipient email." });
    }
    const sampleLead = validLeads[0] || {
      id: 0,
      fullName: "Test Recipient",
      email: testRecipient,
      preferredCommunity: "Comfort Care Senior Living",
      careType: "Senior Living"
    };
    const personalizedBody = personalizeEmail(emailBody, { ...sampleLead, email: testRecipient });
    const sendResult = await sendEmail({
      to: testRecipient,
      subject: `[TEST] ${subject}`,
      body: personalizedBody
    });
    await EmailOutreach.create({
      leadId: sampleLead.id || 0,
      recipientEmail: testRecipient,
      subject: `[TEST] ${subject}`,
      body: personalizedBody,
      status: sendResult.status
    });
    return sendJson(res, 200, {
      ok: true,
      sent: 1,
      mode: sendResult.mode,
      message: sendResult.message
    });
  }

  if (liveMode && body.confirmLiveBulk !== true) {
    return sendJson(res, 422, { error: "Live bulk email requires confirmation." });
  }

  const recipients = liveMode ? validLeads.slice(0, 50) : validLeads;
  for (const lead of recipients) {
    const personalizedBody = personalizeEmail(emailBody, lead);
    const sendResult = body.demoOnly === true ? {
      mode: "demo",
      status: "Demo Sent",
      message: "Demo outreach logged."
    } : await sendEmail({
      to: lead.email,
      subject,
      body: personalizedBody
    });
    await EmailOutreach.create({
      leadId: lead.id,
      recipientEmail: lead.email,
      subject,
      body: personalizedBody,
      status: sendResult.status
    });
    await Lead.update({ status: "Contacted" }, { where: { id: lead.id } });
  }

  sendJson(res, 200, {
    ok: true,
    sent: recipients.length,
    mode: liveMode && body.demoOnly !== true ? "live" : "demo",
    message: `${liveMode && body.demoOnly !== true ? "Live email sent to" : "Demo outreach logged for"} ${recipients.length} lead${recipients.length === 1 ? "" : "s"}.`
  });
}

async function handleSingleLeadEmail(req, res, id) {
  const lead = await Lead.findOne({ where: { id } });
  if (!lead) return sendJson(res, 404, { error: "Lead not found." });
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return sendJson(res, 422, { error: "Gmail credentials not configured." });
  }

  const firstName = lead.fullName.split(" ")[0] || "there";

  let subject, bodyText;

  if (OPENAI_API_KEY) {
    try {
      const prompt = `Write a short, warm, personalized follow-up email for a senior living lead with the following details:
- Name: ${lead.fullName}
- Care interest: ${lead.careType}
- Preferred community: ${lead.preferredCommunity}
- Their message: "${lead.message || "No message provided"}"

Address them by first name (${firstName}). Keep it under 120 words. Empathetic, not salesy. Sign off as "The Comfort Care Team".
Return JSON with keys: subject (string) and body (string).`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 300
        })
      });
      const aiData = await aiRes.json();
      const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
      if (parsed.subject && parsed.body) {
        subject = parsed.subject;
        bodyText = parsed.body;
      }
    } catch (err) {
      console.error("OpenAI single lead error:", err.message);
    }
  }

  // Fallback
  if (!subject || !bodyText) {
    subject = `Following up on your interest in ${lead.preferredCommunity}`;
    bodyText = `Hi ${firstName},\n\nThank you for reaching out to Comfort Care Senior Living about ${lead.careType}. We'd love to help you find the right fit at ${lead.preferredCommunity}.\n\nWould you be open to a quick call or tour? We're here to answer any questions.\n\nWarmly,\nThe Comfort Care Team`;
  }

  const result = await sendEmail({ to: lead.email, subject, body: bodyText });
  await EmailOutreach.create({
    leadId: lead.id,
    recipientEmail: lead.email,
    subject,
    body: bodyText,
    status: result.status
  });
  if (result.status === "Sent") {
    await Lead.update({ status: "Contacted" }, { where: { id } });
  }

  sendJson(res, 200, { ok: result.status === "Sent", message: result.message, subject, body: bodyText });
}

async function sendEmail({ to, subject, body }) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return {
      mode: "demo",
      status: "Demo Sent",
      message: "Demo mode: email logged but not sent. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env to send real email."
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      text: body
    };
    if (EMAIL_REPLY_TO) mailOptions.replyTo = EMAIL_REPLY_TO;

    await transporter.sendMail(mailOptions);
    return {
      mode: "live",
      status: "Sent",
      message: `Email sent to ${to}.`
    };
  } catch (err) {
    console.error("sendEmail error:", err.message);
    return {
      mode: "live",
      status: "Send Failed",
      message: err.message || "Failed to send email."
    };
  }
}

async function getLeadsFromDb(params = new URLSearchParams()) {
  const where = buildLeadWhere(params);
  const rows = await Lead.findAll({
    where,
    order: [["created_at", "DESC"]]
  });
  return rows.map((lead) => ({
    id: lead.id,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    preferredCommunity: lead.preferredCommunity,
    careType: lead.careType,
    message: lead.message,
    status: lead.status,
    submittedAt: lead.created_at instanceof Date ? lead.created_at.toISOString() : new Date(lead.created_at).toISOString()
  }));
}

function buildLeadWhere(params) {
  const status = clean(params.get("status") || "");
  const community = clean(params.get("community") || "");
  const dateFrom = parseDateFilter(params.get("dateFrom"), false);
  const dateTo = parseDateFilter(params.get("dateTo"), true);
  const where = {};

  if (status && VALID_STATUSES.has(status)) where.status = status;
  if (community) where.preferredCommunity = community;
  if (dateFrom || dateTo) {
    where.created_at = {};
    if (dateFrom) where.created_at[Op.gte] = dateFrom;
    if (dateTo) where.created_at[Op.lte] = dateTo;
  }

  return where;
}

function filtersToParams(filters) {
  const params = new URLSearchParams();
  ["community", "status", "dateFrom", "dateTo"].forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  return params;
}

function parseDateFilter(value, endOfDay) {
  const cleaned = clean(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${cleaned}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLeadCsv(leads) {
  const headers = [
    "Full name",
    "Phone number",
    "Email",
    "Preferred community",
    "Care type",
    "Message",
    "Status",
    "Date submitted"
  ];
  const rows = leads.map((lead) => [
    lead.fullName,
    lead.phone,
    lead.email,
    lead.preferredCommunity,
    lead.careType,
    lead.message,
    lead.status,
    lead.submittedAt
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

function validateLead(body) {
  const errors = [];
  const required = ["fullName", "phone", "email", "preferredCommunity", "careType"];
  required.forEach((field) => {
    if (!clean(body[field] || "")) errors.push(`${field} is required.`);
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(body.email || ""))) errors.push("A valid email is required.");
  if (!/^[0-9+().\-\s]{7,20}$/.test(clean(body.phone || ""))) errors.push("A valid phone number is required.");
  if (!CARE_TYPES.has(clean(body.careType || ""))) errors.push("A valid care type is required.");
  return errors;
}

function sanitizeLead(body) {
  return {
    kind: ["tour", "contact", "community"].includes(body.kind) ? body.kind : "contact",
    fullName: clean(body.fullName),
    phone: clean(body.phone),
    email: clean(body.email).toLowerCase(),
    preferredCommunity: clean(body.preferredCommunity),
    careType: clean(body.careType),
    message: clean(body.message || ""),
    tourPreference: clean(body.tourPreference || "")
  };
}

function cleanCsv(value) {
  return String(value || "").replace(/^\uFEFF/, "").slice(0, 1_000_000);
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      i++;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map((header) => normalizeHeader(header));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function normalizeHeader(header) {
  return clean(header).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeImportedLead(row) {
  return {
    fullName: row.full_name || row.name || row.fullname || "",
    phone: row.phone_number || row.phone || "",
    email: row.email || "",
    preferredCommunity: row.preferred_community || row.community || "",
    careType: row.care_type || row.care_needed || row.care || "Not sure yet",
    message: row.message || row.notes || row.source || "Imported lead",
    status: row.status || "New"
  };
}

function personalizeEmail(template, lead) {
  const firstName = clean(lead.fullName).split(" ")[0] || "there";
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{full_name}}", lead.fullName)
    .replaceAll("{{community}}", lead.preferredCommunity)
    .replaceAll("{{care_type}}", lead.careType);
}

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function clean(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024
  });
  return crypto.timingSafeEqual(actual, expected);
}

function scrypt(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function signToken(token) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("base64url");
  return `${token}.${sig}`;
}

function readSignedSession(req) {
  const raw = parseCookies(req.headers.cookie || "").ccsl_session;
  if (!raw || !raw.includes(".")) return null;
  const [token, sig] = raw.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return token;
}

function isAuthenticated(req) {
  const token = readSignedSession(req);
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > 8 * 60 * 60 * 1000) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is required. Add it to .env.`);
  return process.env[name];
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_200_000) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function safePublicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const filePath = path.normalize(path.join(PUBLIC_DIR, decoded));
  return filePath.startsWith(PUBLIC_DIR) ? filePath : null;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendXml(res, xml) {
  res.writeHead(200, {
    "Content-Type": "application/xml; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(xml);
}

function sitemapXml(req) {
  const origin = `http://${req.headers.host}`;
  const paths = [
    "/",
    "/communities/august-haus-comfort-care",
    "/communities/bavarian-comfort-care",
    "/communities/bay-city-comfort-care",
    "/communities/big-rapids-fields-comfort-care",
    "/communities/brighton-comfort-care",
    "/communities/chesaning-comfort-care",
    "/communities/livonia-comfort-care",
    "/communities/marshall-comfort-care",
    "/communities/mount-pleasant-comfort-care",
    "/communities/reed-city-fields-comfort-care",
    "/communities/shields-comfort-care",
    "/communities/shelby-comfort-care",
    "/communities/vassar-comfort-care",
    "/privacy",
    "/terms"
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((item) => `  <url><loc>${origin}${item}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}
