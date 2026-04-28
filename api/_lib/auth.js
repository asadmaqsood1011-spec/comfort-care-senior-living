const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET || "";

function signToken(token) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("base64url");
  return `${token}.${sig}`;
}

function readSignedSession(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").filter(Boolean).map((part) => {
      const idx = part.indexOf("=");
      return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1))];
    })
  );
  const raw = cookies.ccsl_session;
  if (!raw || !raw.includes(".")) return null;
  const dotIdx = raw.lastIndexOf(".");
  const token = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return token;
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(salt, "base64"), expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
      (err, key) => err ? reject(err) : resolve(key)
    );
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Stateless sessions — email + expiry encoded in the token, no in-memory store needed
function createSession(email) {
  const payload = JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 });
  return Buffer.from(payload).toString("base64url");
}

function validateSession(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!payload.email || !payload.exp) return false;
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
}

function destroySession(_token) {
  // Stateless — nothing to destroy server-side; client clears the cookie
}

function isAuthenticated(req) {
  const token = readSignedSession(req);
  return validateSession(token);
}

module.exports = {
  signToken, readSignedSession, cookieHeader,
  verifyPassword, createSession, validateSession,
  destroySession, isAuthenticated
};
