const { createClient } = require("@supabase/supabase-js");

let _client;

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY.");
    }
    _client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return _client;
}

module.exports = { getClient };
