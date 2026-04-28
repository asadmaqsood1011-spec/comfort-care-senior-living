const { getClient } = require("./_lib/db");
const { validateLead, sanitizeLead } = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const errors = validateLead(body);
    if (errors.length) return res.status(422).json({ errors });

    const lead = sanitizeLead(body);
    const db = getClient();

    const { error } = await db.from("leads").insert({
      full_name: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      preferred_community: lead.preferredCommunity,
      care_type: lead.careType,
      message: lead.message,
      status: "New"
    });

    if (error) throw error;

    res.status(201).json({
      ok: true,
      message: "Thank you. Your information is securely stored. We never share your data."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};
