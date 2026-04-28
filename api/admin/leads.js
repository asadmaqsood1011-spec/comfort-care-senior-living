const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { toLeadCsv, parseDateFilter, clean, VALID_STATUSES } = require("../_lib/helpers");

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
