const { getClient } = require("./_lib/db");
const { clean, readBody, sendJson } = require("./_lib/helpers");
const { createClient } = require("@supabase/supabase-js");
const { requireV2User } = require("./_lib/v2-auth");
const {
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
  migrateLegacyData
} = require("./_lib/v2-services");
const {
  listIntelligence,
  runIntelligenceScan,
  updateOperationalEventStatus,
  getPriorityQueues,
  generateIntelligenceDigest,
  generateRecoveryDraft,
  generateLeadSummary
} = require("./_lib/intelligence");

module.exports = async (req, res) => {
  try {
    const path = getPath(req);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    if (req.method === "GET" && path === "/config") {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      if (!url) return sendJson(res, 500, { error: "Supabase URL is missing." });
      return sendJson(res, 200, { supabaseUrl: url, supabaseAnonKey: anonKey, authMode: "server" });
    }

    if (req.method === "POST" && path === "/login") {
      const body = await readBody(req);
      const email = clean(body.email).toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) return sendJson(res, 422, { error: "Email and password are required." });
      const { data, error } = await getLoginClient().auth.signInWithPassword({ email, password });
      if (error || !data?.session) return sendJson(res, 401, { error: error?.message || "Invalid login." });
      return sendJson(res, 200, { session: data.session, user: data.user });
    }

    if (req.method === "POST" && path === "/intake") {
      return handlePublicIntake(req, res);
    }

    if ((req.method === "GET" || req.method === "POST") && path === "/cron/intelligence-scan") {
      return handleCronIntelligenceScan(req, res);
    }

    const user = await requireV2User(req);
    const db = getClient();
    const body = ["POST", "PATCH", "PUT"].includes(req.method) ? await readBody(req) : {};
    const url = new URL(req.url || "/api/v2", "http://localhost");
    const locationId = clean(url.searchParams.get("locationId") || "");

    if (req.method === "GET" && path === "/session") {
      return sendJson(res, 200, { user, locations: await getLocations(db, user) });
    }

    if (req.method === "GET" && path === "/locations") {
      return sendJson(res, 200, { locations: await getLocations(db, user) });
    }

    if (req.method === "GET" && path === "/dashboard") {
      return sendJson(res, 200, await getDashboard(db, user, locationId));
    }

    if (req.method === "GET" && path === "/intelligence") {
      return sendJson(res, 200, await listIntelligence(db, user, locationId));
    }

    if (req.method === "POST" && path === "/intelligence/scan") {
      return sendJson(res, 200, await runIntelligenceScan(db, user, locationId, "manual"));
    }

    if (req.method === "GET" && path === "/intelligence/queues") {
      return sendJson(res, 200, await getPriorityQueues(db, user, locationId));
    }

    if (req.method === "POST" && path === "/intelligence/digest") {
      return sendJson(res, 200, await generateIntelligenceDigest(db, user, locationId));
    }

    const eventStatusMatch = path.match(/^\/intelligence\/events\/([^/]+)\/status$/);
    if (req.method === "PATCH" && eventStatusMatch) {
      return sendJson(res, 200, { event: await updateOperationalEventStatus(db, user, eventStatusMatch[1], body.status) });
    }

    const recoveryDraftMatch = path.match(/^\/intelligence\/events\/([^/]+)\/recovery-draft$/);
    if (req.method === "POST" && recoveryDraftMatch) {
      return sendJson(res, 200, await generateRecoveryDraft(db, user, recoveryDraftMatch[1]));
    }

    if (req.method === "GET" && path === "/leads") {
      return sendJson(res, 200, { leads: await listLeads(db, user, Object.fromEntries(url.searchParams.entries())) });
    }

    if (req.method === "GET" && path === "/leads/export") {
      const csv = await exportLeadsCsv(db, user, Object.fromEntries(url.searchParams.entries()));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"comfort-care-v2-leads.csv\"");
      return res.status(200).send(csv);
    }

    if (req.method === "POST" && path === "/leads") {
      return sendJson(res, 201, await createLead(db, user, body));
    }

    const detailMatch = path.match(/^\/leads\/([^/]+)$/);
    if (req.method === "GET" && detailMatch) {
      return sendJson(res, 200, await getLeadDetail(db, user, detailMatch[1]));
    }

    const notesMatch = path.match(/^\/leads\/([^/]+)\/notes$/);
    if (req.method === "PATCH" && notesMatch) {
      return sendJson(res, 200, { lead: await updateLeadNotes(db, user, notesMatch[1], body.notes || body.notes_summary || "") });
    }

    const emailDraftMatch = path.match(/^\/leads\/([^/]+)\/email-draft$/);
    if (req.method === "POST" && emailDraftMatch) {
      return sendJson(res, 200, await generateLeadEmailDraft(db, user, emailDraftMatch[1]));
    }

    const emailSendMatch = path.match(/^\/leads\/([^/]+)\/email$/);
    if (req.method === "POST" && emailSendMatch) {
      return sendJson(res, 200, await sendLeadEmail(db, user, emailSendMatch[1], body));
    }

    const leadSummaryMatch = path.match(/^\/leads\/([^/]+)\/summary$/);
    if (req.method === "POST" && leadSummaryMatch) {
      return sendJson(res, 200, await generateLeadSummary(db, user, leadSummaryMatch[1]));
    }

    const statusMatch = path.match(/^\/leads\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      return sendJson(res, 200, { lead: await updateLeadStatus(db, user, statusMatch[1], clean(body.status)) });
    }

    if (req.method === "POST" && path === "/tours") {
      return sendJson(res, 201, { tour: await scheduleTour(db, user, body) });
    }

    const tourStatusMatch = path.match(/^\/tours\/([^/]+)\/status$/);
    if (req.method === "PATCH" && tourStatusMatch) {
      return sendJson(res, 200, { tour: await updateTourStatus(db, user, tourStatusMatch[1], clean(body.status)) });
    }

    if (req.method === "POST" && path === "/follow-ups") {
      return sendJson(res, 201, { followUp: await createFollowUp(db, user, body) });
    }

    const followUpStatusMatch = path.match(/^\/follow-ups\/([^/]+)\/status$/);
    if (req.method === "PATCH" && followUpStatusMatch) {
      return sendJson(res, 200, { followUp: await updateFollowUpStatus(db, user, followUpStatusMatch[1], clean(body.status)) });
    }

    if (req.method === "POST" && path === "/tasks") {
      return sendJson(res, 201, { task: await createTask(db, user, body) });
    }

    const taskStatusMatch = path.match(/^\/tasks\/([^/]+)\/status$/);
    if (req.method === "PATCH" && taskStatusMatch) {
      return sendJson(res, 200, { task: await updateTaskStatus(db, user, taskStatusMatch[1], clean(body.status)) });
    }

    if (req.method === "GET" && path === "/operations") {
      return sendJson(res, 200, await listOperations(db, user, locationId));
    }

    if (req.method === "GET" && path === "/check-ins") {
      return sendJson(res, 200, { checkIns: await listCheckIns(db, user, locationId) });
    }

    if (req.method === "POST" && path === "/residents") {
      return sendJson(res, 201, { resident: await createResident(db, user, body) });
    }

    if (req.method === "POST" && path === "/notes") {
      return sendJson(res, 201, { note: await createNote(db, user, body) });
    }

    if (req.method === "POST" && path === "/documents/upload-url") {
      return sendJson(res, 201, await createSignedUpload(db, user, body));
    }

    if (req.method === "POST" && path === "/documents") {
      return sendJson(res, 201, { document: await createDocumentRecord(db, user, body) });
    }

    const docUrlMatch = path.match(/^\/documents\/([^/]+)\/signed-url$/);
    if (req.method === "GET" && docUrlMatch) {
      return sendJson(res, 200, await getSignedDocumentUrl(db, user, docUrlMatch[1]));
    }

    if (req.method === "GET" && path === "/users") {
      return sendJson(res, 200, { users: await listUsers(db, user) });
    }

    if (req.method === "POST" && path === "/users") {
      return sendJson(res, 201, { user: await createUserWithAccess(db, user, body) });
    }

    const userActiveMatch = path.match(/^\/users\/([^/]+)\/active$/);
    if (req.method === "PATCH" && userActiveMatch) {
      return sendJson(res, 200, { user: await setUserActive(db, user, userActiveMatch[1], body.active !== false) });
    }

    if (req.method === "POST" && path === "/migrate-legacy") {
      return sendJson(res, 200, await migrateLegacyData(db, user));
    }

    return sendJson(res, 404, { error: "V2 route not found." });
  } catch (err) {
    console.error("api/v2", err);
    return sendJson(res, err.statusCode || 500, { error: err.message || "Something went wrong." });
  }
};

async function handleCronIntelligenceScan(req, res) {
  const expected = process.env.CRON_SECRET || "";
  const bearer = String(req.headers.authorization || req.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const headerSecret = String(req.headers["x-cron-secret"] || "");
  if (!expected) return sendJson(res, 503, { error: "CRON_SECRET is not configured." });
  if (bearer !== expected && headerSecret !== expected) return sendJson(res, 401, { error: "Unauthorized cron request." });
  const systemUser = {
    id: null,
    email: "system@comfortcarecrm.com",
    role: "super_admin",
    isSuperAdmin: true,
    locations: [],
    profile: { full_name: "Operational Intelligence Engine", role: "super_admin" }
  };
  const db = getClient();
  return sendJson(res, 200, await runIntelligenceScan(db, systemUser, "", "vercel-cron"));
}

async function handlePublicIntake(req, res) {
  const db = getClient();
  const body = await readBody(req);
  const locationSlug = clean(body.locationSlug || body.location_slug || body.location || "");
  const { data: locations, error: locationError } = await db
    .from("locations")
    .select("id, name, slug")
    .or(`slug.eq.${locationSlug},name.eq.${locationSlug}`)
    .eq("active", true)
    .limit(1);
  if (locationError) throw locationError;
  const location = locations?.[0];
  if (!location) {
    const error = new Error("Choose a valid location.");
    error.statusCode = 422;
    throw error;
  }

  const systemUser = {
    id: null,
    isSuperAdmin: true,
    locations: [],
    profile: { full_name: "Public Intake" },
    role: "public"
  };
  const result = await createLead(db, systemUser, {
    ...body,
    locationId: location.id,
    source: ["Website", "Tablet"].includes(clean(body.source)) ? clean(body.source) : "Website"
  });
  await db.from("intake_submissions").insert({
    location_id: location.id,
    lead_id: result.lead.id,
    source: clean(body.source || "Website"),
    payload: body,
    user_agent: clean(req.headers["user-agent"] || "")
  });
  return sendJson(res, 201, { ok: true, leadId: result.lead.id, duplicate: Boolean(result.duplicate) });
}

function getPath(req) {
  const raw = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
  if (raw) return `/${String(raw).replace(/^\/+/, "")}`.replace(/\/$/, "") || "/";
  const url = new URL(req.url || "/api/v2", "http://localhost");
  return url.pathname.replace(/^\/api\/v2/, "") || "/";
}

function getLoginClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public auth config is missing.");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
