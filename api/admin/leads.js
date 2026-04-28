const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { toLeadCsv, parseDateFilter, clean, VALID_STATUSES, sendEmail, personalizeEmail } = require("../_lib/helpers");

async function getLeads(db, params = {}) {
  let q = db.from("leads").select("*").order("created_at", { ascending: false });

  if (params.status && VALID_STATUSES.has(params.status)) q = q.eq("status", params.status);
  if (params.community) q = q.eq("preferred_community", params.community);

  const dateFrom = parseDateFilter(params.dateFrom, false);
  const dateTo = parseDateFilter(params.dateTo, true);
  if (dateFrom) q = q.gte("created_at", dateFrom.toISOString());
  if (dateTo) q = q.lte("created_at", dateTo.toISOString());

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getClient();
  const params = req.query || {};

  try {
    // Export CSV
    if (req.method === "GET" && params.export === "csv") {
      const leads = await getLeads(db, params);
      const csv = toLeadCsv(leads);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="comfort-care-leads.csv"');
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(csv);
    }

    // POST /api/admin/leads/:id/email — send AI email to one lead
    const urlPath = req.url || "";
    if (req.method === "POST" && params.id && urlPath.includes("/email")) {
      const { data: rows, error: fetchErr } = await db.from("leads").select("*").eq("id", params.id).single();
      if (fetchErr || !rows) return res.status(404).json({ error: "Lead not found." });
      const lead = rows;

      let subject = `A personal note from Comfort Care Senior Living`;
      let body = `Hi {{first_name}},\n\nThank you for your interest in ${lead.preferred_community}. We'd love to help you explore care options for ${lead.care_type}.\n\nWould you like to schedule a call or tour?\n\nWarmly,\nThe Comfort Care Team`;

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
      if (OPENAI_API_KEY) {
        try {
          const prompt = `Write a short warm outreach email for a senior living community called "${lead.preferred_community}" to a lead interested in "${lead.care_type}". Use {{first_name}} as placeholder. Under 120 words. Friendly, not salesy. Sign off as "The Comfort Care Team". Return JSON with keys: subject, body.`;
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 300 })
          });
          const aiData = await aiRes.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          if (parsed.subject && parsed.body) { subject = parsed.subject; body = parsed.body; }
        } catch (e) { console.error("AI error:", e.message); }
      }

      const personalizedBody = personalizeEmail(body, lead);
      const result = await sendEmail({ to: lead.email, subject, body: personalizedBody });
      await db.from("email_outreach").insert({ lead_id: lead.id, recipient_email: lead.email, subject, body: personalizedBody, status: result.status });
      await db.from("leads").update({ status: "Contacted", updated_at: new Date().toISOString() }).eq("id", lead.id);
      return res.status(200).json({ ok: true, message: `Email sent to ${lead.email}`, subject });
    }

    // PATCH status — /api/admin/leads?id=123
    if (req.method === "PATCH" && params.id) {
      const status = clean(req.body?.status || "");
      if (!VALID_STATUSES.has(status)) return res.status(422).json({ error: "Invalid status." });
      const { error } = await db.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", params.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // DELETE — /api/admin/leads?id=123
    if (req.method === "DELETE" && params.id) {
      const { error } = await db.from("leads").delete().eq("id", params.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // GET list
    if (req.method === "GET") {
      const rows = await getLeads(db, params);
      const leads = rows.map(r => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone,
        email: r.email,
        preferredCommunity: r.preferred_community,
        careType: r.care_type,
        message: r.message,
        status: r.status,
        submittedAt: r.created_at,
        updatedAt: r.updated_at
      }));
      return res.status(200).json({ leads });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};
