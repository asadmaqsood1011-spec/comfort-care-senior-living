const { createClient } = require("@supabase/supabase-js");
const { getClient } = require("./db");

const SESSION_COOKIE = "ccsl_v2_session";
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

function getAnonClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase anon config is missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function getAuthClient() {
  try {
    return getAnonClient();
  } catch (_) {
    return getClient();
  }
}

async function requireV2User(req, res = null) {
  const cookieSession = readSessionCookie(req);
  let token = readBearerToken(req) || cookieSession?.access_token || "";
  if (!token) {
    const error = new Error("Missing Supabase session.");
    error.statusCode = 401;
    throw error;
  }

  let { data, error } = await getAuthClient().auth.getUser(token);
  if ((error || !data?.user) && cookieSession?.refresh_token) {
    const refreshed = await refreshCookieSession(cookieSession.refresh_token).catch(() => null);
    if (refreshed?.access_token) {
      token = refreshed.access_token;
      if (res) setSessionCookie(res, refreshed);
      ({ data, error } = await getAuthClient().auth.getUser(token));
    }
  }
  if (error || !data?.user) {
    if (res) clearSessionCookie(res);
    const authError = new Error("Invalid Supabase session.");
    authError.statusCode = 401;
    throw authError;
  }

  const db = getClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .eq("active", true)
    .single();

  if (profileError || !profile) {
    const forbidden = new Error("Your admin profile is not active.");
    forbidden.statusCode = 403;
    throw forbidden;
  }

  const { data: accessRows, error: accessError } = await db
    .from("user_location_access")
    .select("location_id, access_level, locations(id, name, slug, city, state, phone, active)")
    .eq("user_id", data.user.id);
  if (accessError) throw accessError;

  const isSuperAdmin = profile.role === "super_admin";
  return {
    id: data.user.id,
    email: data.user.email,
    profile,
    role: profile.role,
    isSuperAdmin,
    locations: (accessRows || []).map((row) => ({
      id: row.location_id,
      accessLevel: row.access_level,
      ...(row.locations || {})
    }))
  };
}

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function refreshCookieSession(refreshToken) {
  const { data, error } = await getAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) throw error || new Error("Session refresh failed.");
  return data.session;
}

function readSessionCookie(req) {
  const raw = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch (_) {
    return null;
  }
}

function setSessionCookie(res, session) {
  if (!session?.access_token) return;
  const payload = Buffer.from(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token || "",
    expires_at: session.expires_at || null
  })).toString("base64url");
  appendSetCookie(res, `${SESSION_COOKIE}=${payload}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Secure`);
}

function clearSessionCookie(res) {
  appendSetCookie(res, `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader?.("Set-Cookie");
  if (!existing) return res.setHeader("Set-Cookie", cookie);
  res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]);
}

function parseCookies(header) {
  return Object.fromEntries(String(header).split(";").filter(Boolean).map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
}

function canAccessLocation(user, locationId) {
  if (!locationId) return false;
  return user.isSuperAdmin || user.locations.some((location) => location.id === locationId);
}

function assertLocationAccess(user, locationId) {
  if (!canAccessLocation(user, locationId)) {
    const error = new Error("You do not have access to this location.");
    error.statusCode = 403;
    throw error;
  }
}

function isManager(user, locationId) {
  if (user.isSuperAdmin) return true;
  const location = user.locations.find((item) => item.id === locationId);
  return ["regional_manager", "location_admin"].includes(location?.accessLevel);
}

module.exports = {
  requireV2User,
  setSessionCookie,
  clearSessionCookie,
  canAccessLocation,
  assertLocationAccess,
  isManager
};
