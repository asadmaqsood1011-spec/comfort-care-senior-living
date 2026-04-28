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

// In-memory session store (fine for serverless — sessions are short-lived)
const sessions = new Map();

function createSession(email) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { email, createdAt: Date.now() });
  return token;
}

function validateSession(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > 8 * 60 * 60 * 1000) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  if (token) sessions.delete(token);
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
