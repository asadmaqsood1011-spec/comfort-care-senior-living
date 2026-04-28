const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { clean, sendEmail, personalizeEmail, mostCommon, VALID_STATUSES } = require("../_lib/helpers");

async function getLeadsByFilters(db, filters = {}) {
  let q = db.from("leads").select("*").order("created_at", { ascending: false });
  if (filters.status && VALID_STATUSES.has(filters.status)) q = q.eq("status", filters.status);
  if (filters.community) q = q.eq("preferred_community", filters.community);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getClient();
  const body = req.body || {};
  // Support both ?action=X and /outreach/X path styles
  const urlPath = req.url || "";
  const action = req.query?.action || (urlPath.includes("/draft") ? "draft" : urlPath.includes("/send") ? "send" : "");
  console.log("outreach method:", req.method, "url:", urlPath, "action:", action);

  try {
    // Draft
    if (action === "draft") {
      const filters = body.filters || {};
      const leads = await getLeadsByFilters(db, filters);
      const community = clean(filters.community || "");
      const careType = mostCommon(leads.map((l) => l.care_type)) || "senior living";
      const targetCommunity = community || mostCommon(leads.map((l) => l.preferred_community)) || "Comfort Care";

      // Build a representative sample lead for the preview
      const sampleLead = leads[0] || {};
      const sampleFirstName = clean(sampleLead.full_name || "").split(" ")[0] || "{{first_name}}";
      const sampleCommunity = sampleLead.preferred_community || targetCommunity;
      const sampleCareType = sampleLead.care_type || careType;
      const sampleMessage = sampleLead.message || "";

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
      if (OPENAI_API_KEY) {
        try {
          const prompt = `You write warm, personalized outreach emails for Comfort Care Senior Living. Write one email using these details about the recipient:
- First name: ${sampleFirstName}
- Interested community: ${sampleCommunity}
- Care type: ${sampleCareType}
- Their message/notes: "${sampleMessage || "none provided"}"

Instructions:
- Address them by first name
- Reference their specific community interest and care type naturally
- If they left a message, acknowledge it briefly and empathetically
- Keep it under 160 words, warm and human, not salesy
- Sign off as "The Comfort Care Team"
- Use {{first_name}}, {{community}}, {{care_type}}, {{lead_message}} as placeholders so it personalizes per recipient
- Return JSON with keys: subject (string) and body (string)`;

          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 500 })
          });
          const aiData = await aiRes.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          if (parsed.subject && parsed.body) {
            return res.status(200).json({ subject: parsed.subject, body: parsed.body, recipients: leads.length, ai: true });
          }
        } catch (err) { console.error("OpenAI draft error:", err.message); }
      }

      const subject = `A personal note from ${targetCommunity}`;
      const bodyText = `Hi {{first_name}},\n\nI wanted to personally follow up from Comfort Care Senior Living. Based on your interest in {{care_type}} at {{community}}, our team can help answer questions about care options, transparent pricing, and scheduling a private tour.\n\n{{community}} is designed to feel warm, safe, and home-like.\n\nWould you like to schedule a call or tour?\n\nWarmly,\nThe Comfort Care Team\n\nReply STOP to opt out.`;
      return res.status(200).json({ subject, body: bodyText, recipients: leads.length, ai: false });
    }

    // Send
    if (action === "send") {
      const subject = clean(body.subject || "");
      const emailBody = clean(body.body || "");
      if (!subject || !emailBody) return res.status(422).json({ error: "Subject and body are required." });

      const leads = await getLeadsByFilters(db, body.filters || {});
      const validLeads = leads.filter((l) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email));

      const testRecipient = clean(body.testRecipient || "").toLowerCase();
      if (testRecipient) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) return res.status(422).json({ error: "Enter a valid test email." });
        const sampleLead = validLeads[0] || { full_name: "Test Recipient", preferred_community: "Comfort Care", care_type: "Senior Living" };
        const personalizedBody = personalizeEmail(emailBody, { ...sampleLead, email: testRecipient });
        const result = await sendEmail({ to: testRecipient, subject: `[TEST] ${subject}`, body: personalizedBody });
        await db.from("email_outreach").insert({ lead_id: sampleLead.id || 0, recipient_email: testRecipient, subject: `[TEST] ${subject}`, body: personalizedBody, status: result.status });
        return res.status(200).json({ ok: true, sent: 1, mode: result.mode, message: result.message });
      }

      const targets = validLeads.slice(0, 50);
      let sent = 0, failed = 0;
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

      for (const lead of targets) {
        const firstName = clean(lead.full_name || "").split(" ")[0] || "there";
        const community = lead.preferred_community || "Comfort Care";
        const careType = lead.care_type || "senior living";
        const leadMsg = lead.message || "";

        let finalBody = personalizeEmail(emailBody, lead);

        // If the template uses placeholders only (AI-drafted), and we have OpenAI, generate a unique per-lead email
        if (OPENAI_API_KEY && emailBody.includes("{{")) {
          try {
            const perLeadPrompt = `Write a short, warm, personalized outreach email for Comfort Care Senior Living.

Recipient details:
- Name: ${firstName}
- Community interested in: ${community}
- Care type: ${careType}
- What they wrote: "${leadMsg || ""}"

STRICT rules:
1. Start with "Hi ${firstName},"
2. ${leadMsg ? `Their message mentions: "${leadMsg}" — you MUST reference this specifically in the first 2 sentences. For example if they mention their mom, say "your mom". If they mention a specific concern, address it directly.` : "They left no message — keep it warm and general."}
3. Mention ${community} and ${careType} naturally
4. Under 150 words, human and warm, never generic or corporate
5. Sign off as "The Comfort Care Team"
6. Return JSON with keys: subject (string) and body (string)`;

            const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: perLeadPrompt }], response_format: { type: "json_object" }, max_tokens: 400 })
            });
            const aiData = await aiRes.json();
            const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
            if (parsed.body) finalBody = parsed.body;
          } catch (err) { console.error(`AI per-lead error for ${lead.email}:`, err.message); }
        }

        const result = await sendEmail({ to: lead.email, subject, body: finalBody });
        await db.from("email_outreach").insert({ lead_id: lead.id, recipient_email: lead.email, subject, body: finalBody, status: result.status });
        await db.from("leads").update({ status: "Contacted", updated_at: new Date().toISOString() }).eq("id", lead.id);
        if (result.status === "Sent") sent++; else failed++;
      }
      return res.status(200).json({ ok: true, sent, failed, message: `Sent ${sent} email${sent !== 1 ? "s" : ""}.` });
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};
