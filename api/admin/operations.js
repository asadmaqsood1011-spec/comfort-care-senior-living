/**
 * Unified operations endpoint — residents + incidents
 * Routes:
 *   GET/POST   /api/admin/operations/residents
 *   PATCH/DEL  /api/admin/operations/residents/:id
 *   GET/POST   /api/admin/operations/incidents
 *   PATCH      /api/admin/operations/incidents/:id
 */
const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { clean } = require("../_lib/helpers");

const CARE_LEVELS = new Set(["Assisted Living", "Memory Care", "Independent Living", "Continuum of Care"]);
const INCIDENT_TYPES = new Set(["Fall", "Medication Error", "Behavioral", "Medical Emergency", "Other"]);
const SEVERITIES = new Set(["Low", "Medium", "High"]);

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getClient();
  const urlPath = req.url || "";
  const isResidents = urlPath.includes("/residents");
  const isIncidents = urlPath.includes("/incidents");
  const idMatch = urlPath.match(/\/(residents|incidents)\/(\d+)/);
  const id = idMatch?.[2] || req.query?.id;

  try {
    if (isResidents) return await handleResidents(db, req, res, id);
    if (isIncidents) return await handleIncidents(db, req, res, id);
    res.status(400).json({ error: "Unknown resource." });
  } catch (err) {
    console.error("Operations error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

async function handleResidents(db, req, res, id) {
  if (req.method === "GET" && !id) {
    const { data, error } = await db.from("residents").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const community = clean(req.query?.community || "");
    const residents = (data || []).filter(r => !community || r.community === community);
    return res.status(200).json({ residents });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const name = clean(body.name || "");
    if (!name) return res.status(422).json({ error: "Name is required." });
    const careLevel = CARE_LEVELS.has(body.careLevel) ? body.careLevel : "Assisted Living";
    const { data, error } = await db.from("residents").insert({
      name,
      community: clean(body.community || ""),
      room_number: clean(body.roomNumber || body.room_number || ""),
      care_level: careLevel,
      move_in_date: clean(body.moveInDate || body.move_in_date || "") || null,
      emergency_contact_name: clean(body.emergencyContactName || ""),
      emergency_contact_phone: clean(body.emergencyContactPhone || ""),
      notes: clean(body.notes || ""),
      status: "Active"
    }).select("id").single();
    if (error) throw error;
    return res.status(201).json({ ok: true, id: data?.id });
  }
  if (req.method === "PATCH" && id) {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = clean(body.name);
    if (body.community !== undefined) patch.community = clean(body.community);
    if (body.roomNumber !== undefined) patch.room_number = clean(body.roomNumber);
    if (body.careLevel !== undefined) patch.care_level = CARE_LEVELS.has(body.careLevel) ? body.careLevel : "Assisted Living";
    if (body.moveInDate !== undefined) patch.move_in_date = clean(body.moveInDate) || null;
    if (body.emergencyContactName !== undefined) patch.emergency_contact_name = clean(body.emergencyContactName);
    if (body.emergencyContactPhone !== undefined) patch.emergency_contact_phone = clean(body.emergencyContactPhone);
    if (body.notes !== undefined) patch.notes = clean(body.notes);
    if (body.status !== undefined) patch.status = clean(body.status);
    const { error } = await db.from("residents").update(patch).eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE" && id) {
    const { error } = await db.from("residents").delete().eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleIncidents(db, req, res, id) {
  if (req.method === "GET" && !id) {
    const { data, error } = await db.from("incidents").select("*").order("incident_at", { ascending: false });
    if (error) throw error;
    let incidents = data || [];
    if (req.query?.community) incidents = incidents.filter(i => i.community === clean(req.query.community));
    if (req.query?.severity) incidents = incidents.filter(i => i.severity === clean(req.query.severity));
    if (req.query?.followUp === "true") incidents = incidents.filter(i => i.follow_up_required && !i.follow_up_completed);
    return res.status(200).json({ incidents });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const description = clean(body.description || "");
    if (!description) return res.status(422).json({ error: "Description is required." });
    const type = INCIDENT_TYPES.has(body.type) ? body.type : "Other";
    const severity = SEVERITIES.has(body.severity) ? body.severity : "Low";
    const { data, error } = await db.from("incidents").insert({
      resident_name: clean(body.residentName || body.resident_name || ""),
      community: clean(body.community || ""),
      type, description, severity,
      staff_name: clean(body.staffName || ""),
      incident_at: clean(body.incidentAt || "") || new Date().toISOString(),
      follow_up_required: body.followUpRequired === true || body.followUpRequired === "true",
      follow_up_notes: clean(body.followUpNotes || ""),
      follow_up_completed: false
    }).select("id").single();
    if (error) throw error;
    return res.status(201).json({ ok: true, id: data?.id });
  }
  if (req.method === "PATCH" && id) {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (body.followUpCompleted !== undefined) patch.follow_up_completed = body.followUpCompleted === true || body.followUpCompleted === "true";
    if (body.followUpNotes !== undefined) patch.follow_up_notes = clean(body.followUpNotes);
    if (body.severity !== undefined && SEVERITIES.has(body.severity)) patch.severity = body.severity;
    if (body.description !== undefined) patch.description = clean(body.description);
    const { error } = await db.from("incidents").update(patch).eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
