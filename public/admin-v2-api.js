// @ts-check

async function fetchJson(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (!options.skipAuth) {
    const session = await getActiveSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  const method = (options.method || "GET").toUpperCase();
  let response;
  try {
    response = await fetch(url, {
    method,
    headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Request timed out: ${url}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  if (!options.skipAutoRefresh && ["PATCH", "PUT", "DELETE"].includes(method)) scheduleAutoRefresh();
  else if (!options.skipAutoRefresh && method === "POST" && shouldAutoRefreshOnPost(url)) scheduleAutoRefresh();
  return data;
}

let _autoRefreshTimer = null;
let _autoRefreshing = false;
function scheduleAutoRefresh() {
  if (_autoRefreshing) return;
  clearTimeout(_autoRefreshTimer);
  _autoRefreshTimer = setTimeout(async () => {
    if (_autoRefreshing) return;
    _autoRefreshing = true;
    try { await refreshAll(); } catch (_) {} finally { _autoRefreshing = false; }
  }, 350);
}

function shouldAutoRefreshOnPost(url) {
  // Read-like POSTs (compute/draft/scan) — skip auto refresh
  const readish = ["/morning-brief", "/prep-brief", "/triage", "/intelligence/scan", "/intelligence/digest", "/recovery-draft", "/calendar/pull", "/gmail/pull", "/google-calendar/connect", "/google-gmail/connect", "/leads/draft", "/email/draft", "/outreach/draft", "/outreach/test", "/calendar/resync"];
  return !readish.some((s) => url.includes(s));
}
