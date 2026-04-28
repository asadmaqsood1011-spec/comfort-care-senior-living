const { readSignedSession, destroySession, cookieHeader } = require("../_lib/auth");

module.exports = (req, res) => {
  const token = readSignedSession(req);
  destroySession(token);
  res.setHeader("Set-Cookie", cookieHeader("ccsl_session", "", {
    httpOnly: true, sameSite: "Lax", secure: true, maxAge: 0
  }));
  res.status(200).json({ ok: true });
};
