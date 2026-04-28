const { verifyPassword, signToken, createSession, cookieHeader } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email = "", password = "" } = req.body || {};
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

  if (email.toLowerCase() !== ADMIN_EMAIL || !(await verifyPassword(String(password), ADMIN_PASSWORD_HASH))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = createSession(email.toLowerCase());
  res.setHeader("Set-Cookie", cookieHeader("ccsl_session", signToken(token), {
    httpOnly: true, sameSite: "Lax", secure: true, maxAge: 60 * 60 * 8
  }));
  res.status(200).json({ ok: true });
};
