const { getClient } = require("../_lib/db");
const { isAuthenticated, cookieHeader } = require("../_lib/auth");
const crypto = require("crypto");

const SETTING_KEY = "auto_email_leads";
const CALENDAR_KEY = "google_calendar_connection";
const OCCUPANCY_KEY = "occupancy_tracker";
const OPERATIONS_KEYS = {
  tasks: "operations_tasks",
  moveInChecklists: "operations_movein_checklists",
  shiftNotes: "operations_shift_notes",
  documents: "operations_documents"
};
const EVENT_TYPE = "setting";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events"
];

async function getSetting(db, key) {
  const { data } = await db
    .from("lead_events")
    .select("detail")
    .eq("event_type", EVENT_TYPE)
    .eq("lead_id", 0)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data || !data.length) return null;
  // Find the most recent entry for this key
  for (const row of data) {
    try {
      const parsed = JSON.parse(row.detail || "{}");
      if (parsed.key === key) return parsed.value;
    } catch {}
  }
  return null;
}

async function setSetting(db, key, value) {
  const { error } = await db.from("lead_events").insert({
    lead_id: 0,
    event_type: EVENT_TYPE,
    detail: JSON.stringify({ key, value, updatedAt: new Date().toISOString() })
  });
  if (error) throw error;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getClient();
  const params = req.query || {};
  const action = params.action || calendarActionFromUrl(req.url || "");

  try {
    if (action === "calendar-status" && req.method === "GET") {
      return res.status(200).json(await calendarStatus(db));
    }

    if (action === "calendar-connect" && req.method === "GET") {
      const authUrl = buildGoogleAuthUrl(req);
      res.setHeader("Set-Cookie", cookieHeader("ccsl_calendar_state", authUrl.state, {
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
        maxAge: 10 * 60
      }));
      res.writeHead(302, { Location: authUrl.url });
      return res.end();
    }

    if (action === "calendar-callback" && req.method === "GET") {
      await handleGoogleCallback(db, req);
      res.setHeader("Set-Cookie", cookieHeader("ccsl_calendar_state", "", {
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
        maxAge: 0
      }));
      res.writeHead(302, { Location: "/admin#settings" });
      return res.end();
    }

    if (action === "calendar-disconnect" && req.method === "POST") {
      await setSetting(db, CALENDAR_KEY, null);
      return res.status(200).json({ ok: true, connected: false });
    }

    if (action === "occupancy" && req.method === "GET") {
      return res.status(200).json({ occupancy: await getOccupancyData(db) });
    }

    if (action === "occupancy" && req.method === "POST") {
      const occupancy = normalizeOccupancyPayload(req.body?.occupancy || []);
      await setSetting(db, OCCUPANCY_KEY, occupancy);
      return res.status(200).json({ ok: true, occupancy, message: "Occupancy saved." });
    }

    if (action === "operations" && req.method === "GET") {
      return res.status(200).json(await getOperationsData(db));
    }

    if (action === "operations" && req.method === "POST") {
      const section = String(req.body?.section || "").trim();
      if (!OPERATIONS_KEYS[section]) return res.status(422).json({ error: "Invalid operations section." });
      const data = normalizeOperationsSection(section, req.body?.data || []);
      await setSetting(db, OPERATIONS_KEYS[section], data);
      return res.status(200).json({ ok: true, section, data, message: "Saved." });
    }

    if (req.method === "GET") {
      const value = await getSetting(db, SETTING_KEY);
      // Default to true if never set
      return res.status(200).json({ auto_email_leads: value !== false });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const enabled = body.auto_email_leads !== false && body.auto_email_leads !== "false";
      await setSetting(db, SETTING_KEY, enabled);
      return res.status(200).json({ ok: true, auto_email_leads: enabled });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Something went wrong." });
  }
};

// Export helper for use in other endpoints
module.exports.getAutoEmailSetting = async (db) => {
  const value = await getSetting(db, SETTING_KEY);
  return value !== false; // default true
};

module.exports.createCalendarTourEvent = createCalendarTourEvent;
module.exports.deleteCalendarTourEvent = deleteCalendarTourEvent;

function calendarActionFromUrl(urlPath) {
  if (urlPath.includes("/calendar/status")) return "calendar-status";
  if (urlPath.includes("/calendar/connect")) return "calendar-connect";
  if (urlPath.includes("/calendar/callback")) return "calendar-callback";
  if (urlPath.includes("/calendar/disconnect")) return "calendar-disconnect";
  if (urlPath.includes("/occupancy")) return "occupancy";
  if (urlPath.includes("/operations")) return "operations";
  return "";
}

async function getOperationsData(db) {
  const result = {};
  for (const [section, key] of Object.entries(OPERATIONS_KEYS)) {
    const value = await getSetting(db, key);
    result[section] = normalizeOperationsSection(section, Array.isArray(value) ? value : []);
  }
  return result;
}

function normalizeOperationsSection(section, rows) {
  if (section === "tasks") return normalizeTasks(rows);
  if (section === "moveInChecklists") return normalizeMoveInChecklists(rows);
  if (section === "shiftNotes") return normalizeShiftNotes(rows);
  if (section === "documents") return normalizeDocuments(rows);
  return [];
}

function normalizeId(value) {
  const raw = String(value || "").trim();
  return raw || crypto.randomBytes(8).toString("hex");
}

function normalizeTasks(rows) {
  const validStatuses = new Set(["To Do", "In Progress", "Done"]);
  const validTypes = new Set(["Call family", "Prepare tour room", "Send pricing packet", "Medicaid paperwork", "Post-tour follow-up", "Other"]);
  return rows.slice(0, 500).map((row) => ({
    id: normalizeId(row.id),
    title: String(row.title || "").trim().slice(0, 180),
    community: String(row.community || "").trim().slice(0, 160),
    type: validTypes.has(row.type) ? row.type : "Other",
    assignedTo: String(row.assignedTo || row.assigned_to || "").trim().slice(0, 90),
    dueDate: String(row.dueDate || row.due_date || "").trim().slice(0, 40),
    status: validStatuses.has(row.status) ? row.status : "To Do",
    notes: String(row.notes || "").trim().slice(0, 600),
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()).slice(0, 40)
  })).filter((row) => row.title && row.community);
}

function normalizeMoveInChecklists(rows) {
  return rows.slice(0, 500).map((row) => ({
    id: normalizeId(row.id || row.leadId || row.lead_id),
    leadId: String(row.leadId || row.lead_id || row.id || "").trim().slice(0, 80),
    leadName: String(row.leadName || row.lead_name || "").trim().slice(0, 160),
    community: String(row.community || "").trim().slice(0, 160),
    targetDate: String(row.targetDate || row.target_date || "").trim().slice(0, 40),
    notes: String(row.notes || "").trim().slice(0, 700),
    items: {
      roomReady: Boolean(row.items?.roomReady || row.roomReady),
      medList: Boolean(row.items?.medList || row.medList),
      physicianForms: Boolean(row.items?.physicianForms || row.physicianForms),
      paymentPaperwork: Boolean(row.items?.paymentPaperwork || row.paymentPaperwork),
      familyContact: Boolean(row.items?.familyContact || row.familyContact),
      carePlanMeeting: Boolean(row.items?.carePlanMeeting || row.carePlanMeeting)
    },
    updatedAt: String(row.updatedAt || row.updated_at || new Date().toISOString()).slice(0, 40)
  })).filter((row) => row.leadId || row.leadName);
}

function normalizeShiftNotes(rows) {
  const validCategories = new Set(["Daily note", "Maintenance", "Family concern", "Dining/activity", "Manager review"]);
  return rows.slice(0, 500).map((row) => ({
    id: normalizeId(row.id),
    community: String(row.community || "").trim().slice(0, 160),
    shiftDate: String(row.shiftDate || row.shift_date || "").trim().slice(0, 40),
    category: validCategories.has(row.category) ? row.category : "Daily note",
    author: String(row.author || "").trim().slice(0, 90),
    note: String(row.note || "").trim().slice(0, 1200),
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()).slice(0, 40)
  })).filter((row) => row.community && row.note);
}

function normalizeDocuments(rows) {
  const validTypes = new Set(["Brochure", "Pricing", "Floor plan", "Medicaid form", "Tour packet", "Other"]);
  return rows.slice(0, 500).map((row) => ({
    id: normalizeId(row.id),
    title: String(row.title || "").trim().slice(0, 180),
    community: String(row.community || "").trim().slice(0, 160),
    type: validTypes.has(row.type) ? row.type : "Other",
    url: String(row.url || "").trim().slice(0, 600),
    notes: String(row.notes || "").trim().slice(0, 500),
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()).slice(0, 40)
  })).filter((row) => row.title && row.url);
}

async function getOccupancyData(db) {
  const value = await getSetting(db, OCCUPANCY_KEY);
  return normalizeOccupancyPayload(Array.isArray(value) ? value : []);
}

function normalizeOccupancyPayload(rows) {
  return rows
    .map((row) => {
      const community = String(row.community || "").trim().slice(0, 160);
      if (!community) return null;
      const totalRooms = clampWholeNumber(row.totalRooms ?? row.total_rooms);
      const occupiedRooms = Math.min(totalRooms, clampWholeNumber(row.occupiedRooms ?? row.occupied_rooms));
      const waitlist = clampWholeNumber(row.waitlist);
      return {
        community,
        totalRooms,
        occupiedRooms,
        waitlist,
        nextMoveIn: String(row.nextMoveIn || row.next_move_in || "").trim().slice(0, 40),
        notes: String(row.notes || "").trim().slice(0, 500)
      };
    })
    .filter(Boolean);
}

function clampWholeNumber(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, 999);
}

function getBaseUrl(req) {
  const configured = process.env.PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
  if (configured) return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function getRedirectUri(req) {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${getBaseUrl(req)}/api/admin/calendar/callback`;
}

function googleConfig(req) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
  const redirectUri = getRedirectUri(req);
  if (!clientId || !clientSecret) {
    const error = new Error("Google Calendar is not configured yet. Add GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI in Vercel.");
    error.statusCode = 503;
    throw error;
  }
  return { clientId, clientSecret, redirectUri };
}

function buildGoogleAuthUrl(req) {
  const { clientId, redirectUri } = googleConfig(req);
  const state = signState(crypto.randomBytes(18).toString("base64url"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

function signState(value) {
  const secret = process.env.SESSION_SECRET || process.env.CALENDAR_TOKEN_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET is required for calendar OAuth.");
  const payload = `${value}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyState(req) {
  const cookieHeaderValue = req.headers.cookie || "";
  const cookies = Object.fromEntries(cookieHeaderValue.split(";").filter(Boolean).map((part) => {
    const idx = part.indexOf("=");
    return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1))];
  }));
  const expected = cookies.ccsl_calendar_state || "";
  const received = String(req.query?.state || "");
  if (!expected || expected !== received) throw new Error("Calendar connection expired. Try connecting again.");
  const parts = received.split(".");
  if (parts.length !== 3) throw new Error("Invalid calendar connection state.");
  const [value, timestamp, sig] = parts;
  const payload = `${value}.${timestamp}`;
  const secret = process.env.SESSION_SECRET || process.env.CALENDAR_TOKEN_SECRET || "";
  const actual = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(actual))) {
    throw new Error("Invalid calendar connection state.");
  }
  if (Date.now() - Number(timestamp) > 10 * 60 * 1000) throw new Error("Calendar connection expired. Try connecting again.");
}

async function handleGoogleCallback(db, req) {
  verifyState(req);
  const code = String(req.query?.code || "");
  if (!code) throw new Error("Google did not return an authorization code.");
  const { clientId, clientSecret, redirectUri } = googleConfig(req);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error_description || "Could not connect Google Calendar.");
  const profile = await fetchGoogleProfile(tokenData.access_token);
  const connection = {
    provider: "google",
    email: profile.email || "",
    calendarId: "primary",
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
    scope: tokenData.scope || GOOGLE_SCOPES.join(" "),
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await setSetting(db, CALENDAR_KEY, encryptConnection(connection));
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return {};
  return response.json();
}

async function calendarStatus(db) {
  const missingConfig = !process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const connection = await getCalendarConnection(db);
  return {
    configured: !missingConfig,
    connected: Boolean(connection?.refreshToken || connection?.accessToken),
    provider: connection?.provider || "google",
    email: connection?.email || "",
    connectedAt: connection?.connectedAt || "",
    message: missingConfig ? "Google OAuth credentials are not configured in Vercel yet." : ""
  };
}

async function getCalendarConnection(db) {
  const encrypted = await getSetting(db, CALENDAR_KEY);
  if (!encrypted) return null;
  try {
    return decryptConnection(encrypted);
  } catch (error) {
    console.error("Calendar decrypt error:", error.message);
    return null;
  }
}

function encryptionKey() {
  const secret = process.env.CALENDAR_TOKEN_SECRET || process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("CALENDAR_TOKEN_SECRET or SESSION_SECRET is required for calendar token encryption.");
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptConnection(connection) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(connection), "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url")
  };
}

function decryptConnection(payload) {
  if (!payload?.iv || !payload?.tag || !payload?.data) return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(payload.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64url")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function getValidGoogleAccessToken(db, connection) {
  if (!connection) return null;
  if (connection.accessToken && Number(connection.expiresAt || 0) > Date.now() + 90_000) return connection.accessToken;
  if (!connection.refreshToken) return connection.accessToken || null;
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(data.error_description || "Could not refresh Google Calendar access.");
  const nextConnection = {
    ...connection,
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    updatedAt: new Date().toISOString()
  };
  await setSetting(db, CALENDAR_KEY, encryptConnection(nextConnection));
  return nextConnection.accessToken;
}

async function createCalendarTourEvent(db, lead, tourScheduledAt) {
  const connection = await getCalendarConnection(db);
  if (!connection) return { skipped: true, reason: "Calendar not connected." };
  const accessToken = await getValidGoogleAccessToken(db, connection);
  if (!accessToken) return { skipped: true, reason: "Calendar not connected." };

  const eventId = await getLatestCalendarEventId(db, lead.id);
  const event = buildCalendarEvent(lead, tourScheduledAt);
  const calendarId = encodeURIComponent(connection.calendarId || "primary");
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  const method = eventId ? "PATCH" : "POST";
  const url = eventId ? `${baseUrl}/${encodeURIComponent(eventId)}?sendUpdates=none` : `${baseUrl}?sendUpdates=none`;
  let response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });
  if (response.status === 404 && eventId) {
    response = await fetch(`${baseUrl}?sendUpdates=none`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Could not create Google Calendar event.");
  await logCalendarEvent(db, lead.id, {
    eventId: data.id,
    htmlLink: data.htmlLink,
    provider: "google",
    start: tourScheduledAt.toISOString()
  });
  return { ok: true, provider: "google", eventId: data.id, htmlLink: data.htmlLink, updated: Boolean(eventId) };
}

async function deleteCalendarTourEvent(db, leadId) {
  const connection = await getCalendarConnection(db);
  const eventId = await getLatestCalendarEventId(db, leadId);
  if (!connection || !eventId) return { skipped: true };
  const accessToken = await getValidGoogleAccessToken(db, connection);
  if (!accessToken) return { skipped: true };
  const calendarId = encodeURIComponent(connection.calendarId || "primary");
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || "Could not delete Google Calendar event.");
  }
  await setCalendarEventArchived(db, leadId, eventId);
  return { ok: true, deleted: true };
}

function buildCalendarEvent(lead, startDate) {
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const timezone = process.env.CALENDAR_TIMEZONE || "America/Detroit";
  const name = lead.fullName || lead.name || "Lead";
  const community = lead.location || lead.preferredCommunity || "Comfort Care";
  return {
    summary: `Tour: ${name} - ${community}`,
    location: community,
    description: [
      `Lead: ${name}`,
      `Phone: ${lead.phone || "Not provided"}`,
      `Email: ${lead.email || "Not provided"}`,
      `Care type: ${lead.careType || "Not sure yet"}`,
      "",
      lead.notes || lead.message || "No notes"
    ].join("\n"),
    start: { dateTime: startDate.toISOString(), timeZone: timezone },
    end: { dateTime: endDate.toISOString(), timeZone: timezone },
    extendedProperties: {
      private: {
        app: "comfort-care-admin",
        leadId: String(lead.id || "")
      }
    }
  };
}

async function getLatestCalendarEventId(db, leadId) {
  const { data } = await db
    .from("lead_events")
    .select("detail")
    .eq("lead_id", leadId)
    .eq("event_type", "calendar_event_created")
    .order("created_at", { ascending: false })
    .limit(10);
  const deletedIds = new Set();
  for (const row of data || []) {
    try {
      const parsed = JSON.parse(row.detail || "{}");
      if (parsed.eventId && parsed.deleted) deletedIds.add(parsed.eventId);
      if (parsed.eventId && !parsed.deleted && !deletedIds.has(parsed.eventId)) return parsed.eventId;
    } catch {}
  }
  return "";
}

async function logCalendarEvent(db, leadId, detail) {
  await db.from("lead_events").insert({
    lead_id: leadId,
    event_type: "calendar_event_created",
    detail: JSON.stringify(detail)
  });
}

async function setCalendarEventArchived(db, leadId, eventId) {
  await db.from("lead_events").insert({
    lead_id: leadId,
    event_type: "calendar_event_created",
    detail: JSON.stringify({ eventId, deleted: true, provider: "google", updatedAt: new Date().toISOString() })
  });
}
