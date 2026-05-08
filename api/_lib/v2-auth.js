const { createClient } = require("@supabase/supabase-js");
const { getClient } = require("./db");

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

async function requireV2User(req) {
  const token = readBearerToken(req);
  if (!token) {
    const error = new Error("Missing Supabase session.");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await getAuthClient().auth.getUser(token);
  if (error || !data?.user) {
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
  canAccessLocation,
  assertLocationAccess,
  isManager
};
