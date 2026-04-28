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
  const urlPath = req.url || "";

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

    // POST /api/admin/leads/import — bulk import CSV
    if (req.method === "POST" && urlPath.includes("/import")) {
      const csv = req.body?.csv || "";
      if (!csv) return res.status(422).json({ error: "No CSV provided." });
      const lines = csv.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
      const idx = (name) => headers.findIndex(h => h.includes(name));
      const nameIdx = idx("name"); const phoneIdx = idx("phone"); const emailIdx = idx("email");
      const communityIdx = idx("community"); const careIdx = idx("care"); const messageIdx = idx("message");
      const inserted = []; const skipped = [];
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const email = cols[emailIdx] || "";
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped.push(line); continue; }
        const { error } = await db.from("leads").insert({
          full_name: cols[nameIdx] || "Unknown",
          phone: cols[phoneIdx] || "",
          email,
          preferred_community: cols[communityIdx] || "Unknown",
          care_type: cols[careIdx] || "Unknown",
          message: cols[messageIdx] || "",
          status: "New"
        });
        if (error) skipped.push(email); else inserted.push(email);
      }
      return res.status(200).json({ ok: true, message: `Imported ${inserted.length} lead${inserted.length !== 1 ? "s" : ""}.`, skipped });
    }

    // POST /api/admin/leads/:id/email — send AI email to one lead
    if (req.method === "POST" && params.id && urlPath.includes("/email")) {
      const { data: rows, error: fetchErr } = await db.from("leads").select("*").eq("id", params.id).single();
      if (fetchErr || !rows) return res.status(404).json({ error: "Lead not found." });
      const lead = rows;

      let subject = `A personal note from Comfort Care Senior Living`;
      let body = `Hi {{first_name}},\n\nThank you for your interest in ${lead.preferred_community}. We'd love to help you explore care options for ${lead.care_type}.\n\nWould you like to schedule a call or tour?\n\nWarmly,\nThe Comfort Care Team`;

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
      if (OPENAI_API_KEY) {
        try {
          const firstName = clean(lead.full_name || "").split(" ")[0] || "there";
          const leadMsg = lead.message || "";
          const careType = lead.care_type || "";
          // Combine care_type + message — care_type often contains personal context like "for my mom"
          const personalContext = [careType, leadMsg].filter(Boolean).join(" | ");
          const prompt = `Write a short, warm, personalized outreach email for Comfort Care Senior Living.

Recipient details:
- Name: ${firstName}
- Community interested in: ${lead.preferred_community}
- Their notes/context: "${personalContext}"

STRICT rules:
1. Start with "Hi ${firstName},"
2. Their notes say: "${personalContext}" — EXTRACT any personal detail (family member like mom/dad, specific concern, urgency) and reference it directly in the FIRST sentence. E.g. if it mentions "mom", say "your mom". If it says "dad", say "your father".
3. Mention ${lead.preferred_community} naturally
4. Under 150 words, human and warm, never generic or corporate
5. Sign off as "The Comfort Care Team"
6. Return JSON with keys: subject (string) and body (string)`;

          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 400 })
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

    // GET /api/admin/leads/:id/emails — email history for a lead
    if (req.method === "GET" && params.id && urlPath.includes("/emails")) {
      const { data, error } = await db.from("email_outreach").select("*").eq("lead_id", params.id).order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ emails: data || [] });
    }

    // POST /api/admin/leads/:id/notes — save notes for a lead
    if (req.method === "POST" && params.id && urlPath.includes("/notes")) {
      const notes = clean(req.body?.notes || "").slice(0, 2000);
      const { error } = await db.from("leads").update({ notes, updated_at: new Date().toISOString() }).eq("id", params.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // PATCH status — /api/admin/leads/:id/status
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
        notes: r.notes || "",
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
