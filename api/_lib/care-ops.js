const { clean, sendEmail, buildBrandedEmail } = require("./helpers");
const { assertLocationAccess, isManager } = require("./v2-auth");

const INCIDENT_SEVERITIES = new Set(["Low", "Medium", "High", "Critical"]);
const INCIDENT_STATUSES = new Set(["open", "reviewing", "closed"]);
const HANDOFF_FIELDS = ["shift_label", "summary", "resident_alerts", "pending_tasks", "to_user_id"];
const SHIFT_STATUSES = new Set(["scheduled", "published", "swapped", "cancelled", "completed", "no_show"]);
const SWAP_STATUSES = new Set(["open", "accepted", "declined", "cancelled"]);

function validationError(message, statusCode = 422) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function userLocationIds(user) {
  return (user.locations || []).map((l) => l.id);
}

function requireDefaultLocation(user, locationId) {
  const id = clean(locationId) || (user.locations[0]?.id || "");
  if (!id) validationError("No location selected.");
  assertLocationAccess(user, id);
  return id;
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

async function logActivity(db, user, locationId, entityType, entityId, action, metadata = {}) {
  try {
    await db.from("activity_logs").insert({
      location_id: locationId,
      actor_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      action,
      metadata,
      created_by: user.id
    });
  } catch (err) {
    console.warn("care-ops activity log failed:", err.message);
  }
}

// ---------- Incidents ----------

async function listIncidents(db, user, params = {}) {
  const locIds = userLocationIds(user);
  if (!locIds.length && !user.isSuperAdmin) return { incidents: [] };
  let query = db.from("incidents").select("*").order("incident_at", { ascending: false }).limit(500);
  if (!user.isSuperAdmin) query = query.in("location_id", locIds);
  if (params.locationId) query = query.eq("location_id", params.locationId);
  if (params.status && INCIDENT_STATUSES.has(params.status)) query = query.eq("status", params.status);
  if (params.residentId) query = query.eq("resident_id", params.residentId);
  const { data, error } = await query;
  if (error) throw error;
  return { incidents: data || [] };
}

async function createIncident(db, user, body = {}) {
  const locationId = requireDefaultLocation(user, body.locationId);
  const description = clean(body.description);
  if (!description) validationError("Description is required.");
  const severity = clean(body.severity) || "Low";
  if (!INCIDENT_SEVERITIES.has(severity)) validationError("Invalid severity.");
  const type = clean(body.type) || "Other";
  const residentName = clean(body.residentName);
  const community = clean(body.community);
  const staffName = clean(body.staffName) || user.profile?.full_name || user.email || "";
  const followUpRequired = !!body.followUpRequired;
  const followUpNotes = clean(body.followUpNotes);

  const insert = {
    location_id: locationId,
    reporter_user_id: user.id,
    resident_id: body.residentId || null,
    resident_name: residentName,
    community,
    type,
    description,
    severity,
    staff_name: staffName,
    incident_at: body.incidentAt ? new Date(body.incidentAt).toISOString() : new Date().toISOString(),
    follow_up_required: followUpRequired,
    follow_up_notes: followUpNotes,
    status: "open"
  };

  const { data, error } = await db.from("incidents").insert(insert).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "incident", data.id, "incident_created", { severity, type });
  return { incident: data };
}

async function updateIncident(db, user, id, body = {}) {
  if (!id) validationError("Incident id required.");
  const { data: existing, error: findErr } = await db.from("incidents").select("*").eq("id", id).single();
  if (findErr || !existing) validationError("Incident not found.", 404);
  if (existing.location_id) assertLocationAccess(user, existing.location_id);

  const patch = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!INCIDENT_STATUSES.has(body.status)) validationError("Invalid status.");
    patch.status = body.status;
    if (body.status === "closed") {
      patch.closed_at = new Date().toISOString();
      patch.closed_by = user.id;
    } else {
      patch.closed_at = null;
      patch.closed_by = null;
    }
  }
  if (body.followUpRequired !== undefined) patch.follow_up_required = !!body.followUpRequired;
  if (body.followUpCompleted !== undefined) patch.follow_up_completed = !!body.followUpCompleted;
  if (body.followUpNotes !== undefined) patch.follow_up_notes = clean(body.followUpNotes);
  if (body.severity !== undefined) {
    if (!INCIDENT_SEVERITIES.has(body.severity)) validationError("Invalid severity.");
    patch.severity = body.severity;
  }
  if (body.description !== undefined) patch.description = clean(body.description);

  const { data, error } = await db.from("incidents").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "incident", id, "incident_updated", { status: patch.status });
  return { incident: data };
}

async function hardDeleteIncident(db, user, id) {
  if (!user.isSuperAdmin) validationError("Only super admins can permanently delete.", 403);
  const { data: existing, error: findErr } = await db.from("incidents").select("*").eq("id", id).single();
  if (findErr || !existing) validationError("Incident not found.", 404);
  const { error } = await db.from("incidents").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "incident", id, "incident_deleted", {});
  return { ok: true };
}

// ---------- Shift handoffs ----------

async function listHandoffs(db, user, params = {}) {
  const locIds = userLocationIds(user);
  if (!locIds.length && !user.isSuperAdmin) return { handoffs: [], unacknowledged: [] };
  let query = db.from("shift_handoffs").select("*").order("created_at", { ascending: false }).limit(200);
  if (!user.isSuperAdmin) query = query.in("location_id", locIds);
  if (params.locationId) query = query.eq("location_id", params.locationId);
  const { data, error } = await query;
  if (error) throw error;
  const all = data || [];
  const unack = all.filter((row) => !row.acknowledged_at &&
    (row.to_user_id === user.id || row.to_user_id === null));
  return { handoffs: all, unacknowledged: unack };
}

async function createHandoff(db, user, body = {}) {
  const locationId = requireDefaultLocation(user, body.locationId);
  const summary = clean(body.summary);
  if (!summary) validationError("Summary is required.");
  const shiftLabel = clean(body.shiftLabel) || `Handoff ${new Date().toLocaleString()}`;
  const residentAlerts = safeArray(body.residentAlerts).map((a) => ({
    resident_id: clean(a.resident_id || a.residentId) || null,
    resident_name: clean(a.resident_name || a.residentName),
    note: clean(a.note),
    priority: clean(a.priority) || "Low"
  }));
  const pendingTasks = safeArray(body.pendingTasks).map((t) => ({
    title: clean(t.title),
    due_at: t.due_at || t.dueAt || null,
    owner: clean(t.owner)
  }));

  const insert = {
    location_id: locationId,
    from_user_id: user.id,
    to_user_id: clean(body.toUserId) || null,
    shift_label: shiftLabel,
    summary,
    resident_alerts: residentAlerts,
    pending_tasks: pendingTasks
  };
  const { data, error } = await db.from("shift_handoffs").insert(insert).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "shift_handoff", data.id, "handoff_created", { shiftLabel });
  return { handoff: data };
}

async function acknowledgeHandoff(db, user, id) {
  const { data: existing, error: findErr } = await db.from("shift_handoffs").select("*").eq("id", id).single();
  if (findErr || !existing) validationError("Handoff not found.", 404);
  assertLocationAccess(user, existing.location_id);
  if (existing.acknowledged_at) validationError("Already acknowledged.");
  if (existing.to_user_id && existing.to_user_id !== user.id && !user.isSuperAdmin && !isManager(user, existing.location_id)) {
    validationError("Only the recipient can acknowledge.", 403);
  }
  const { data, error } = await db.from("shift_handoffs").update({
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: user.id
  }).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "shift_handoff", id, "handoff_acknowledged", {});
  return { handoff: data };
}

async function updateHandoff(db, user, id, body = {}) {
  const { data: existing, error: findErr } = await db.from("shift_handoffs").select("*").eq("id", id).single();
  if (findErr || !existing) validationError("Handoff not found.", 404);
  assertLocationAccess(user, existing.location_id);
  if (existing.from_user_id !== user.id && !user.isSuperAdmin) validationError("Only the author can edit.", 403);
  if (existing.acknowledged_at) validationError("Cannot edit after acknowledgement.");
  const patch = {};
  if (body.summary !== undefined) patch.summary = clean(body.summary);
  if (body.shiftLabel !== undefined) patch.shift_label = clean(body.shiftLabel);
  if (body.toUserId !== undefined) patch.to_user_id = clean(body.toUserId) || null;
  if (body.residentAlerts !== undefined) patch.resident_alerts = safeArray(body.residentAlerts);
  if (body.pendingTasks !== undefined) patch.pending_tasks = safeArray(body.pendingTasks);
  const { data, error } = await db.from("shift_handoffs").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "shift_handoff", id, "handoff_updated", {});
  return { handoff: data };
}

async function hardDeleteHandoff(db, user, id) {
  if (!user.isSuperAdmin) validationError("Only super admins can permanently delete.", 403);
  const { data: existing } = await db.from("shift_handoffs").select("*").eq("id", id).single();
  if (!existing) validationError("Handoff not found.", 404);
  const { error } = await db.from("shift_handoffs").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "shift_handoff", id, "handoff_deleted", {});
  return { ok: true };
}

// ---------- Family updates ----------

async function listFamilyUpdates(db, user, params = {}) {
  const locIds = userLocationIds(user);
  if (!locIds.length && !user.isSuperAdmin) return { updates: [] };
  let query = db.from("communication_messages")
    .select("*")
    .eq("direction", "outbound_family")
    .order("sent_at", { ascending: false })
    .limit(200);
  if (!user.isSuperAdmin) query = query.in("location_id", locIds);
  if (params.locationId) query = query.eq("location_id", params.locationId);
  if (params.residentId) query = query.eq("resident_id", params.residentId);
  const { data, error } = await query;
  if (error) throw error;
  return { updates: data || [] };
}

async function sendFamilyUpdate(db, user, body = {}) {
  const locationId = requireDefaultLocation(user, body.locationId);
  const residentId = clean(body.residentId) || null;
  const channel = clean(body.channel) || "email";
  if (!["email", "sms"].includes(channel)) validationError("Invalid channel.");
  const recipient = clean(body.recipient);
  if (!recipient) validationError("Recipient is required.");
  const subject = clean(body.subject) || "Update from Comfort Care Senior Living";
  const messageBody = clean(body.body);
  if (!messageBody) validationError("Message body is required.");

  if (channel === "sms") {
    validationError("SMS channel is not configured on this server. Use email.", 501);
  }

  const sendResult = await sendEmail({
    to: recipient,
    subject,
    body: messageBody,
    html: buildBrandedEmail ? buildBrandedEmail(messageBody) : `<p>${messageBody.replace(/\n/g, "<br>")}</p>`
  });

  const status = sendResult?.status === "Sent" ? "sent" : (sendResult?.status === "Demo Sent" ? "sent" : "failed");
  const insert = {
    location_id: locationId,
    resident_id: residentId || null,
    direction: "outbound_family",
    channel,
    provider: channel === "email" ? (sendResult?.mode === "live" ? "gmail" : "demo") : "sms",
    to_email: channel === "email" ? recipient : "",
    subject,
    body: messageBody,
    status,
    sent_by: user.id,
    sent_at: new Date().toISOString(),
    metadata: { ...(body.metadata || {}), send_mode: sendResult?.mode || "demo", send_message: sendResult?.message || "" }
  };
  const { data, error } = await db.from("communication_messages").insert(insert).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "family_update", data.id, "family_update_sent", { channel, residentId });
  return { update: data, sendResult };
}

async function hardDeleteFamilyUpdate(db, user, id) {
  if (!user.isSuperAdmin) validationError("Only super admins can permanently delete.", 403);
  const { data: existing } = await db.from("communication_messages").select("*").eq("id", id).single();
  if (!existing) validationError("Update not found.", 404);
  const { error } = await db.from("communication_messages").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "family_update", id, "family_update_deleted", {});
  return { ok: true };
}

// ---------- Staff scheduling ----------

function weekRangeFrom(weekOf) {
  const start = weekOf ? new Date(weekOf) : new Date();
  if (Number.isNaN(start.getTime())) validationError("Invalid weekOf date.");
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // Sunday-start
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  return { start, end };
}

async function getWeeklySchedule(db, user, params = {}) {
  const locationId = requireDefaultLocation(user, params.locationId);
  const { start, end } = weekRangeFrom(params.weekOf);
  const { data: shifts, error } = await db
    .from("staff_shifts")
    .select("*")
    .eq("location_id", locationId)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  const shiftIds = (shifts || []).map((s) => s.id);
  let swaps = [];
  if (shiftIds.length) {
    const { data: swapRows, error: swapErr } = await db
      .from("shift_swap_requests")
      .select("*")
      .in("shift_id", shiftIds)
      .order("created_at", { ascending: false });
    if (swapErr) throw swapErr;
    swaps = swapRows || [];
  }
  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    locationId,
    shifts: shifts || [],
    swaps
  };
}

async function assertNoOverlap(db, userId, startsAt, endsAt, excludeShiftId = null) {
  let query = db.from("staff_shifts").select("id, starts_at, ends_at, status")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());
  if (excludeShiftId) query = query.neq("id", excludeShiftId);
  const { data, error } = await query;
  if (error) throw error;
  if ((data || []).length) validationError("This staffer already has an overlapping shift.");
}

async function createShift(db, user, body = {}) {
  const locationId = requireDefaultLocation(user, body.locationId);
  if (!isManager(user, locationId)) validationError("Only managers can create shifts.", 403);
  const userId = clean(body.userId);
  if (!userId) validationError("Staff user is required.");
  const starts = new Date(body.startsAt);
  const ends = new Date(body.endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) validationError("Invalid start/end time.");
  if (ends <= starts) validationError("End must be after start.");
  if ((ends - starts) / 3600000 > 16) validationError("Shifts cannot exceed 16 hours.");
  await assertNoOverlap(db, userId, starts, ends);
  const insert = {
    location_id: locationId,
    user_id: userId,
    role: clean(body.role),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    notes: clean(body.notes),
    created_by: user.id,
    status: "scheduled"
  };
  const { data, error } = await db.from("staff_shifts").insert(insert).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "staff_shift", data.id, "shift_created", {});
  return { shift: data };
}

async function updateShift(db, user, id, body = {}) {
  const { data: existing, error: findErr } = await db.from("staff_shifts").select("*").eq("id", id).single();
  if (findErr || !existing) validationError("Shift not found.", 404);
  assertLocationAccess(user, existing.location_id);
  if (!isManager(user, existing.location_id)) validationError("Only managers can edit shifts.", 403);
  const patch = { updated_at: new Date().toISOString() };
  if (body.userId !== undefined) patch.user_id = body.userId;
  if (body.role !== undefined) patch.role = clean(body.role);
  if (body.notes !== undefined) patch.notes = clean(body.notes);
  if (body.status !== undefined) {
    if (!SHIFT_STATUSES.has(body.status)) validationError("Invalid status.");
    patch.status = body.status;
  }
  let starts = existing.starts_at ? new Date(existing.starts_at) : null;
  let ends = existing.ends_at ? new Date(existing.ends_at) : null;
  if (body.startsAt !== undefined) { starts = new Date(body.startsAt); patch.starts_at = starts.toISOString(); }
  if (body.endsAt !== undefined) { ends = new Date(body.endsAt); patch.ends_at = ends.toISOString(); }
  if (starts && ends && ends <= starts) validationError("End must be after start.");
  if (starts && ends && (body.startsAt !== undefined || body.endsAt !== undefined || body.userId !== undefined)) {
    await assertNoOverlap(db, patch.user_id || existing.user_id, starts, ends, id);
  }
  const { data, error } = await db.from("staff_shifts").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "staff_shift", id, "shift_updated", {});
  return { shift: data };
}

async function cancelShift(db, user, id) {
  return updateShift(db, user, id, { status: "cancelled" });
}

async function hardDeleteShift(db, user, id) {
  if (!user.isSuperAdmin) validationError("Only super admins can permanently delete.", 403);
  const { data: existing } = await db.from("staff_shifts").select("*").eq("id", id).single();
  if (!existing) validationError("Shift not found.", 404);
  const { error } = await db.from("staff_shifts").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, existing.location_id, "staff_shift", id, "shift_deleted", {});
  return { ok: true };
}

async function publishWeek(db, user, body = {}) {
  const locationId = requireDefaultLocation(user, body.locationId);
  if (!isManager(user, locationId)) validationError("Only managers can publish.", 403);
  const { start, end } = weekRangeFrom(body.weekOf);
  const { data, error } = await db
    .from("staff_shifts")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("location_id", locationId)
    .eq("status", "scheduled")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .select("id, user_id");
  if (error) throw error;
  await logActivity(db, user, locationId, "staff_shift", null, "shifts_published", { count: (data || []).length, weekOf: start.toISOString() });
  return { published: (data || []).length };
}

async function requestSwap(db, user, body = {}) {
  const shiftId = clean(body.shiftId);
  if (!shiftId) validationError("shiftId required.");
  const { data: shift, error: shiftErr } = await db.from("staff_shifts").select("*").eq("id", shiftId).single();
  if (shiftErr || !shift) validationError("Shift not found.", 404);
  assertLocationAccess(user, shift.location_id);
  if (shift.user_id !== user.id && !isManager(user, shift.location_id)) {
    validationError("Only the assigned staffer can request a swap.", 403);
  }
  const insert = {
    shift_id: shiftId,
    requested_by: user.id,
    offered_to: clean(body.offeredTo) || null,
    reason: clean(body.reason)
  };
  const { data, error } = await db.from("shift_swap_requests").insert(insert).select("*").single();
  if (error) throw error;
  await logActivity(db, user, shift.location_id, "shift_swap", data.id, "swap_requested", { shiftId });
  return { swap: data };
}

async function respondToSwap(db, user, id, body = {}) {
  const { data: swap, error: swapErr } = await db.from("shift_swap_requests").select("*").eq("id", id).single();
  if (swapErr || !swap) validationError("Swap request not found.", 404);
  if (swap.status !== "open") validationError("Swap already resolved.");
  const accept = body.accept === true || body.accept === "true";
  const { data: shift } = await db.from("staff_shifts").select("*").eq("id", swap.shift_id).single();
  if (!shift) validationError("Linked shift missing.", 404);
  assertLocationAccess(user, shift.location_id);

  const validResponder = swap.offered_to ? swap.offered_to === user.id : true;
  if (!validResponder && !isManager(user, shift.location_id)) {
    validationError("You are not the offered recipient.", 403);
  }

  const patch = {
    status: accept ? "accepted" : "declined",
    resolved_at: new Date().toISOString(),
    resolved_by: user.id
  };
  const { data: updatedSwap, error } = await db.from("shift_swap_requests").update(patch).eq("id", id).select("*").single();
  if (error) throw error;

  if (accept) {
    await assertNoOverlap(db, user.id, new Date(shift.starts_at), new Date(shift.ends_at), shift.id);
    await db.from("staff_shifts").update({ user_id: user.id, status: "published", updated_at: new Date().toISOString() }).eq("id", shift.id);
  }
  await logActivity(db, user, shift.location_id, "shift_swap", id, accept ? "swap_accepted" : "swap_declined", { shiftId: shift.id });
  return { swap: updatedSwap };
}

// ---------- Roster helper (staff at a location for picker UIs) ----------

async function listLocationStaff(db, user, params = {}) {
  const locationId = requireDefaultLocation(user, params.locationId);
  const { data: access, error: accessErr } = await db
    .from("user_location_access")
    .select("user_id, access_level")
    .eq("location_id", locationId);
  if (accessErr) throw accessErr;
  const ids = (access || []).map((row) => row.user_id);
  if (!ids.length) return { staff: [] };
  const { data: profiles, error: profErr } = await db
    .from("profiles")
    .select("id, full_name, email, role, active")
    .in("id", ids);
  if (profErr) throw profErr;
  const accessByUser = Object.fromEntries((access || []).map((r) => [r.user_id, r.access_level]));
  const staff = (profiles || [])
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      fullName: p.full_name || p.email,
      email: p.email,
      role: p.role,
      accessLevel: accessByUser[p.id] || ""
    }));
  if (!staff.some((s) => s.id === user.id)) {
    staff.push({
      id: user.id,
      fullName: user.profile?.full_name || user.email,
      email: user.email,
      role: user.role,
      accessLevel: "self"
    });
  }
  staff.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
  return { staff };
}

module.exports = {
  // incidents
  listIncidents,
  createIncident,
  updateIncident,
  hardDeleteIncident,
  // handoffs
  listHandoffs,
  createHandoff,
  acknowledgeHandoff,
  updateHandoff,
  hardDeleteHandoff,
  // family
  listFamilyUpdates,
  sendFamilyUpdate,
  hardDeleteFamilyUpdate,
  // schedule
  getWeeklySchedule,
  createShift,
  updateShift,
  cancelShift,
  hardDeleteShift,
  publishWeek,
  requestSwap,
  respondToSwap,
  // roster
  listLocationStaff
};
