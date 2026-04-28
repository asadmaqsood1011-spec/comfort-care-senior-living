const { query, ensureTables } = require("./_lib/db");
const { validateLead, sanitizeLead } = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await ensureTables();
    const body = req.body || {};
    const errors = validateLead(body);
    if (errors.length) return res.status(422).json({ errors });

    const lead = sanitizeLead(body);
    await query(
      `INSERT INTO leads (full_name, phone, email, preferred_community, care_type, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'New')`,
      [lead.fullName, lead.phone, lead.email, lead.preferredCommunity, lead.careType, lead.message]
    );

    res.status(201).json({ ok: true, message: "Thank you. Your information is securely stored. We never share your data." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};
