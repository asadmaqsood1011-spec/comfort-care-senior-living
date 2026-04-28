const { query, ensureTables } = require("../_lib/db");
const { isAuthenticated, readSignedSession } = require("../_lib/auth");
const { toLeadCsv, parseDateFilter, clean, VALID_STATUSES } = require("../_lib/helpers");

async function getLeads(params = {}) {
  const conditions = [];
  const values = [];
  let i = 1;

  if (params.status && VALID_STATUSES.has(params.status)) {
    conditions.push(`status = $${i++}`);
    values.push(params.status);
  }
  if (params.community) {
    conditions.push(`preferred_community = $${i++}`);
    values.push(params.community);
  }
  const dateFrom = parseDateFilter(params.dateFrom, false);
  const dateTo = parseDateFilter(params.dateTo, true);
  if (dateFrom) { conditions.push(`created_at >= $${i++}`); values.push(dateFrom); }
  if (dateTo) { conditions.push(`created_at <= $${i++}`); values.push(dateTo); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM leads ${where} ORDER BY created_at DESC`, values);
  return result.rows;
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  await ensureTables();
  const params = req.query || {};

  // Export CSV
  if (params.export === "csv") {
    const leads = await getLeads(params);
    const csv = toLeadCsv(leads);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="comfort-care-leads.csv"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  }

  // PATCH status
  if (req.method === "PATCH" && params.id) {
    const status = clean(req.body?.status || "");
    if (!VALID_STATUSES.has(status)) return res.status(422).json({ error: "Invalid status." });
    await query("UPDATE leads SET status=$1, updated_at=NOW() WHERE id=$2", [status, params.id]);
    return res.status(200).json({ ok: true });
  }

  // DELETE
  if (req.method === "DELETE" && params.id) {
    await query("DELETE FROM leads WHERE id=$1", [params.id]);
    return res.status(200).json({ ok: true });
  }

  // GET list
  if (req.method === "GET") {
    const leads = await getLeads(params);
    return res.status(200).json({ leads });
  }

  res.status(405).json({ error: "Method not allowed" });
};
