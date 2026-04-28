const { query, ensureTables } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { clean, sendEmail, personalizeEmail, mostCommon, VALID_STATUSES } = require("../_lib/helpers");

async function getLeadsByFilters(filters = {}) {
  const conditions = [];
  const values = [];
  let i = 1;
  if (filters.status && VALID_STATUSES.has(filters.status)) { conditions.push(`status = $${i++}`); values.push(filters.status); }
  if (filters.community) { conditions.push(`preferred_community = $${i++}`); values.push(filters.community); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM leads ${where} ORDER BY created_at DESC`, values);
  return result.rows;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  await ensureTables();
  const body = req.body || {};
  const action = req.query?.action || "";

  // Draft email
  if (action === "draft") {
    const filters = body.filters || {};
    const leads = await getLeadsByFilters(filters);
    const community = clean(filters.community || "");
    const careType = mostCommon(leads.map((l) => l.care_type)) || "senior living";
    const targetCommunity = community || mostCommon(leads.map((l) => l.preferred_community)) || "Comfort Care";

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    if (OPENAI_API_KEY) {
      try {
        const prompt = `Write a short, warm outreach email for a senior living community called "${targetCommunity}". The email is for leads interested in "${careType}". Use {{first_name}} as the placeholder. Keep it under 150 words. Friendly, empathetic, not salesy. Sign off as "The Comfort Care Team". Return JSON with keys: subject (string) and body (string).`;
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 400 })
        });
        const aiData = await aiRes.json();
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
        if (parsed.subject && parsed.body) return res.status(200).json({ subject: parsed.subject, body: parsed.body, recipients: leads.length, ai: true });
      } catch (err) { console.error("OpenAI draft error:", err.message); }
    }

    const subject = `A personal note from ${targetCommunity}`;
    const bodyText = `Hi {{first_name}},\n\nI wanted to personally follow up from Comfort Care Senior Living. Based on your interest in ${careType}, our team can help answer questions about care options, transparent pricing, and scheduling a private tour.\n\n${targetCommunity} is designed to feel warm, safe, and home-like.\n\nWould you like to schedule a call or tour?\n\nWarmly,\nThe Comfort Care Team\n\nReply STOP to opt out.`;
    return res.status(200).json({ subject, body: bodyText, recipients: leads.length, ai: false });
  }

  // Send emails
  if (action === "send") {
    const subject = clean(body.subject || "");
    const emailBody = clean(body.body || "");
    if (!subject || !emailBody) return res.status(422).json({ error: "Subject and body are required." });

    const leads = await getLeadsByFilters(body.filters || {});
    const validLeads = leads.filter((l) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email));

    // Test send
    const testRecipient = clean(body.testRecipient || "").toLowerCase();
    if (testRecipient) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) return res.status(422).json({ error: "Enter a valid test email." });
      const sampleLead = validLeads[0] || { full_name: "Test Recipient", preferred_community: "Comfort Care", care_type: "Senior Living" };
      const personalizedBody = personalizeEmail(emailBody, { ...sampleLead, email: testRecipient });
      const result = await sendEmail({ to: testRecipient, subject: `[TEST] ${subject}`, body: personalizedBody });
      await query("INSERT INTO email_outreach (lead_id, recipient_email, subject, body, status) VALUES ($1,$2,$3,$4,$5)",
        [sampleLead.id || 0, testRecipient, `[TEST] ${subject}`, personalizedBody, result.status]);
      return res.status(200).json({ ok: true, sent: 1, mode: result.mode, message: result.message });
    }

    // Bulk send (cap at 50)
    const targets = validLeads.slice(0, 50);
    let sent = 0, failed = 0;
    for (const lead of targets) {
      const personalizedBody = personalizeEmail(emailBody, lead);
      const result = await sendEmail({ to: lead.email, subject, body: personalizedBody });
      await query("INSERT INTO email_outreach (lead_id, recipient_email, subject, body, status) VALUES ($1,$2,$3,$4,$5)",
        [lead.id, lead.email, subject, personalizedBody, result.status]);
      await query("UPDATE leads SET status='Contacted', updated_at=NOW() WHERE id=$1", [lead.id]);
      if (result.status === "Sent") sent++; else failed++;
    }
    return res.status(200).json({ ok: true, sent, failed, message: `Sent ${sent} email${sent !== 1 ? "s" : ""}.` });
  }

  res.status(400).json({ error: "Unknown action." });
};
