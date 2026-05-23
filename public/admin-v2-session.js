// @ts-check

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const SESSION_REFRESH_SKEW_MS = 2 * 60 * 1000;

async function restoreStoredSession(preferBrowserSession = false) {
  let stored = readStoredSession();
  let browserSession = null;
  if (app.supabase) {
    try {
      if (stored?.access_token && stored?.refresh_token) {
        await app.supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token
        });
      }
      if (preferBrowserSession || stored) {
        browserSession = (await app.supabase.auth.getSession())?.data?.session || null;
      }
    } catch (_) {}
  }
  const session = browserSession || stored;
  if (!session) return null;
  if (sessionExpiresSoon(session, 0)) return refreshStoredSession(session);
  if (browserSession) storeSession(browserSession);
  return session;
}

async function getActiveSession() {
  let session = app.session || readStoredSession();
  if (!session && app.supabase) session = (await app.supabase.auth.getSession().catch(() => ({ data: {} })))?.data?.session || null;
  if (!session) return null;
  if (sessionExpiresSoon(session)) {
    session = await refreshStoredSession(session);
  }
  app.session = session;
  return session;
}

function sessionExpiresSoon(session, skewMs = SESSION_REFRESH_SKEW_MS) {
  const expiresAt = Number(session?.expires_at || 0);
  if (!expiresAt) return false;
  return expiresAt * 1000 <= Date.now() + skewMs;
}

async function refreshStoredSession(session) {
  if (!app.supabase || !session?.refresh_token) {
    storeSession(null);
    return null;
  }
  try {
    const { data, error } = await app.supabase.auth.refreshSession({ refresh_token: session.refresh_token });
    if (error || !data?.session?.access_token) throw error || new Error("Session refresh failed.");
    storeSession(data.session);
    return data.session;
  } catch (_) {
    storeSession(null);
    return null;
  }
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem("ccsl:v2-session") || sessionStorage.getItem("ccsl:v2-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Honor stored expiry timestamp; fall back to access_token's exp if present
    const storedAt = parsed?.__storedAt || 0;
    if (storedAt && Date.now() - storedAt > SESSION_TTL_MS) {
      localStorage.removeItem("ccsl:v2-session");
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function storeSession(session) {
  if (!session) {
    localStorage.removeItem("ccsl:v2-session");
    sessionStorage.removeItem("ccsl:v2-session");
  } else {
    const payload = { ...session, __storedAt: Date.now() };
    localStorage.setItem("ccsl:v2-session", JSON.stringify(payload));
    sessionStorage.setItem("ccsl:v2-session", JSON.stringify(payload));
  }
}
