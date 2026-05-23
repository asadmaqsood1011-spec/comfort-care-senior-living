// @ts-check
// Care Ops module — relies on globals from admin-v2-state.js, admin-v2-api.js, admin-v2.js

function bindCareOps() {
  $$("[data-careops-tab]").forEach((btn) => btn.addEventListener("click", () => setCareOpsTab(btn.dataset.careopsTab)));

  $("[data-incident-status-filter]")?.addEventListener("change", (e) => { app.careOps.incidentFilters.status = e.target.value; renderIncidentsList(); });
  $("[data-incident-severity-filter]")?.addEventListener("change", (e) => { app.careOps.incidentFilters.severity = e.target.value; renderIncidentsList(); });
  $("[data-open-incident-form]")?.addEventListener("click", openIncidentForm);
  $("[data-close-incident]")?.addEventListener("click", () => $("[data-incident-modal]").close());
  $("[data-incident-form]")?.addEventListener("submit", handleIncidentSubmit);
  $("[data-close-incident-detail]")?.addEventListener("click", () => $("[data-incident-detail-modal]").close());
  $("[data-incidents-list]")?.addEventListener("click", handleIncidentRowAction);
  $("[data-incident-detail-modal]")?.addEventListener("click", handleIncidentDetailAction);

  $("[data-open-handoff-form]")?.addEventListener("click", openHandoffForm);
  $("[data-close-handoff]")?.addEventListener("click", () => $("[data-handoff-modal]").close());
  $("[data-handoff-form]")?.addEventListener("submit", handleHandoffSubmit);
  $("[data-add-alert]")?.addEventListener("click", () => addHandoffAlertRow());
  $("[data-add-task]")?.addEventListener("click", () => addHandoffTaskRow());
  $("[data-handoffs-unack]")?.addEventListener("click", handleHandoffAction);
  $("[data-handoffs-recent]")?.addEventListener("click", handleHandoffAction);
  $("[data-careops-banner]")?.addEventListener("click", () => { setView("care-ops"); setCareOpsTab("handoff"); });

  $("[data-family-resident-filter]")?.addEventListener("change", (e) => { app.careOps.familyResidentId = e.target.value; loadFamilyUpdates(); });
  $("[data-open-family-form]")?.addEventListener("click", openFamilyForm);
  $("[data-close-family]")?.addEventListener("click", () => $("[data-family-modal]").close());
  $("[data-family-form]")?.addEventListener("submit", handleFamilySubmit);

  $("[data-open-shift-form]")?.addEventListener("click", openShiftForm);
  $("[data-close-shift]")?.addEventListener("click", () => $("[data-shift-modal]").close());
  $("[data-shift-form]")?.addEventListener("submit", handleShiftSubmit);
  $("[data-schedule-prev]")?.addEventListener("click", () => shiftScheduleWeek(-7));
  $("[data-schedule-next]")?.addEventListener("click", () => shiftScheduleWeek(7));
  $("[data-publish-week]")?.addEventListener("click", handlePublishWeek);
  $("[data-schedule-grid]")?.addEventListener("click", handleScheduleChipClick);
}

function setCareOpsTab(tab) {
  if (!tab) return;
  app.careOps.activeTab = tab;
  $$("[data-careops-tab]").forEach((btn) => btn.classList.toggle("active", btn.dataset.careopsTab === tab));
  $$("[data-careops-pane]").forEach((pane) => { pane.hidden = pane.dataset.careopsPane !== tab; });
  const titles = { incidents: "Incidents", handoff: "Shift Handoff", family: "Family Updates", schedule: "Staff Schedule" };
  const titleEl = $("[data-careops-title]");
  if (titleEl) titleEl.textContent = titles[tab] || "Care Ops";
  loadCareOpsActiveTab();
  iconRefresh();
}

async function loadCareOpsActiveTab() {
  try {
    await ensureCareOpsRoster();
    if (app.careOps.activeTab === "incidents") return loadIncidents();
    if (app.careOps.activeTab === "handoff") return loadHandoffs();
    if (app.careOps.activeTab === "family") return loadFamilyUpdates();
    if (app.careOps.activeTab === "schedule") return loadSchedule();
  } catch (err) {
    pushToast(err.message || "Care Ops load failed.", "error");
  }
}

async function ensureCareOpsRoster(force = false) {
  const locationId = app.selectedLocationId || (app.locations[0]?.id || "");
  if (!locationId) return;
  if (!force && app.careOps.staffRoster.length && app.careOps.residentsCache.length) {
    populateCareOpsSelects();
    return;
  }
  try {
    const staffRes = await fetchJson(`/api/v2/care/staff?locationId=${encodeURIComponent(locationId)}`);
    app.careOps.staffRoster = staffRes.staff || [];
  } catch (err) {
    console.warn("careops staff load:", err.message);
  }
  app.careOps.residentsCache = app.operations?.residents || [];
  populateCareOpsSelects();
}

function populateCareOpsSelects() {
  const residents = app.careOps.residentsCache;
  const staff = app.careOps.staffRoster;
  const residentOptions = `<option value="">Select resident...</option>` +
    residents.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.full_name || r.name || r.id)}</option>`).join("");
  ["[data-incident-resident-select]", "[data-family-resident-select]", "[data-family-resident-filter]"].forEach((sel) => {
    const el = $(sel);
    if (el) {
      const current = el.value;
      el.innerHTML = residentOptions;
      if (current) el.value = current;
    }
  });
  const staffOptions = `<option value="">Select staff...</option>` +
    staff.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.fullName)}${s.role ? ` (${escapeHtml(s.role)})` : ""}</option>`).join("");
  const userSel = $("[data-shift-user-select]");
  if (userSel) userSel.innerHTML = staffOptions;
  const handoffOptions = `<option value="">Broadcast to next shift</option>` +
    staff.filter((s) => s.id !== app.user?.id).map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.fullName)}</option>`).join("");
  const handoffSel = $("[data-handoff-to-select]");
  if (handoffSel) handoffSel.innerHTML = handoffOptions;
}

// ---------- Incidents ----------

async function loadIncidents() {
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  const data = await fetchJson(`/api/v2/care/incidents?${params}`);
  app.careOps.incidents = data.incidents || [];
  renderIncidentsList();
}

function renderIncidentsList() {
  const container = $("[data-incidents-list]");
  if (!container) return;
  const { status, severity } = app.careOps.incidentFilters;
  let rows = app.careOps.incidents.slice();
  if (status) rows = rows.filter((r) => r.status === status);
  if (severity) rows = rows.filter((r) => r.severity === severity);
  if (!rows.length) {
    container.innerHTML = `<p class="empty-state">No incidents match these filters.</p>`;
    return;
  }
  const groups = { open: [], reviewing: [], closed: [] };
  rows.forEach((r) => { (groups[r.status || "open"] = groups[r.status || "open"] || []).push(r); });
  container.innerHTML = ["open", "reviewing", "closed"].map((k) => {
    if (!groups[k] || !groups[k].length) return "";
    const label = titleCase(k);
    return `<h3 class="careops-section-head">${label} (${groups[k].length})</h3>` + groups[k].map(renderIncidentCard).join("");
  }).join("");
  iconRefresh();
}

function renderIncidentCard(row) {
  const sev = String(row.severity || "Low").toLowerCase();
  const when = row.incident_at ? new Date(row.incident_at).toLocaleString() : "";
  return `
    <article class="careops-card" data-incident-card data-incident-id="${escapeHtml(row.id)}">
      <header>
        <div>
          <strong>${escapeHtml(row.resident_name || "Unknown resident")}</strong>
          <span class="sev-${escapeHtml(sev)}">${escapeHtml(row.severity || "Low")}</span>
          <span class="meta"> &middot; ${escapeHtml(row.type || "Other")} &middot; <span class="status-${escapeHtml(row.status || "open")}">${escapeHtml(titleCase(row.status || "open"))}</span></span>
        </div>
        <span class="meta">${escapeHtml(when)}</span>
      </header>
      <p>${escapeHtml(row.description || "")}</p>
      ${row.follow_up_required ? `<p class="meta"><strong>Follow-up:</strong> ${escapeHtml(row.follow_up_notes || "Required")} ${row.follow_up_completed ? "(done)" : ""}</p>` : ""}
      <div class="actions">
        <button data-incident-open="${escapeHtml(row.id)}">Open</button>
        ${row.status !== "closed" ? `<button data-incident-status-set="${escapeHtml(row.id)}" data-status="reviewing">Mark reviewing</button>` : ""}
        ${row.status !== "closed" ? `<button data-incident-status-set="${escapeHtml(row.id)}" data-status="closed">Close</button>` : `<button data-incident-status-set="${escapeHtml(row.id)}" data-status="open">Reopen</button>`}
      </div>
    </article>
  `;
}

function openIncidentForm() {
  populateCareOpsSelects();
  const form = $("[data-incident-form]");
  if (form) form.reset();
  $("[data-incident-modal]").showModal();
  iconRefresh();
}

async function handleIncidentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const residentId = fd.get("residentId") || null;
  const resident = app.careOps.residentsCache.find((r) => r.id === residentId);
  const body = {
    locationId: app.selectedLocationId || "",
    residentId,
    residentName: resident ? (resident.full_name || resident.name || "") : "",
    type: fd.get("type") || "Other",
    severity: fd.get("severity") || "Low",
    description: fd.get("description") || "",
    incidentAt: fd.get("incidentAt") || null,
    followUpRequired: !!fd.get("followUpRequired"),
    followUpNotes: fd.get("followUpNotes") || ""
  };
  try {
    await fetchJson("/api/v2/care/incidents", { method: "POST", body });
    pushToast("Incident reported.", "success");
    $("[data-incident-modal]").close();
    await loadIncidents();
  } catch (err) {
    pushToast(err.message || "Could not save incident.", "error");
  }
}

async function handleIncidentRowAction(event) {
  const openBtn = event.target.closest("[data-incident-open]");
  const statusBtn = event.target.closest("[data-incident-status-set]");
  if (openBtn) {
    const id = openBtn.dataset.incidentOpen;
    const row = app.careOps.incidents.find((r) => r.id === id);
    if (row) openIncidentDetail(row);
    return;
  }
  if (statusBtn) {
    const id = statusBtn.dataset.incidentStatusSet;
    const status = statusBtn.dataset.status;
    try {
      await fetchJson(`/api/v2/care/incidents/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
      pushToast("Incident updated.", "success");
      await loadIncidents();
    } catch (err) {
      pushToast(err.message || "Update failed.", "error");
    }
  }
}

function openIncidentDetail(row) {
  const body = $("[data-incident-detail-body]");
  if (!body) return;
  const when = row.incident_at ? new Date(row.incident_at).toLocaleString() : "";
  body.innerHTML = `
    <p><strong>${escapeHtml(row.resident_name || "Unknown")}</strong> &middot; ${escapeHtml(row.type || "Other")} &middot; ${escapeHtml(row.severity || "Low")}</p>
    <p class="meta">${escapeHtml(when)}</p>
    <p>${escapeHtml(row.description || "")}</p>
    <label>Follow-up notes<textarea rows="3" data-incident-followup-notes>${escapeHtml(row.follow_up_notes || "")}</textarea></label>
    <label class="checkbox-row"><input type="checkbox" data-incident-followup-completed ${row.follow_up_completed ? "checked" : ""}> Follow-up completed</label>
    <div class="actions">
      <button class="primary" data-incident-save="${escapeHtml(row.id)}">Save</button>
      ${row.status !== "closed" ? `<button data-incident-close="${escapeHtml(row.id)}">Close incident</button>` : `<button data-incident-reopen="${escapeHtml(row.id)}">Reopen</button>`}
      ${app.user?.role === "super_admin" ? `<button class="danger" data-incident-delete="${escapeHtml(row.id)}">Delete</button>` : ""}
    </div>
  `;
  $("[data-incident-detail-modal]").showModal();
  iconRefresh();
}

async function handleIncidentDetailAction(event) {
  const saveBtn = event.target.closest("[data-incident-save]");
  const closeBtn = event.target.closest("[data-incident-close]");
  const reopenBtn = event.target.closest("[data-incident-reopen]");
  const deleteBtn = event.target.closest("[data-incident-delete]");
  try {
    if (saveBtn) {
      const id = saveBtn.dataset.incidentSave;
      const notes = $("[data-incident-followup-notes]")?.value || "";
      const completed = $("[data-incident-followup-completed]")?.checked || false;
      await fetchJson(`/api/v2/care/incidents/${encodeURIComponent(id)}`, { method: "PATCH", body: { followUpNotes: notes, followUpCompleted: completed } });
      pushToast("Saved.", "success");
      $("[data-incident-detail-modal]").close();
      await loadIncidents();
    } else if (closeBtn) {
      await fetchJson(`/api/v2/care/incidents/${encodeURIComponent(closeBtn.dataset.incidentClose)}`, { method: "PATCH", body: { status: "closed" } });
      $("[data-incident-detail-modal]").close();
      await loadIncidents();
    } else if (reopenBtn) {
      await fetchJson(`/api/v2/care/incidents/${encodeURIComponent(reopenBtn.dataset.incidentReopen)}`, { method: "PATCH", body: { status: "open" } });
      $("[data-incident-detail-modal]").close();
      await loadIncidents();
    } else if (deleteBtn) {
      const ok = await showConfirm("Delete incident", "Permanently delete this incident? This cannot be undone.");
      if (!ok) return;
      await fetchJson(`/api/v2/care/incidents/${encodeURIComponent(deleteBtn.dataset.incidentDelete)}`, { method: "DELETE" });
      $("[data-incident-detail-modal]").close();
      await loadIncidents();
    }
  } catch (err) {
    pushToast(err.message || "Action failed.", "error");
  }
}

// ---------- Handoffs ----------

async function loadHandoffs() {
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  const data = await fetchJson(`/api/v2/care/handoffs?${params}`);
  app.careOps.handoffs = data.handoffs || [];
  app.careOps.unackHandoffs = data.unacknowledged || [];
  renderHandoffsList();
  renderUnackBanner();
}

function renderHandoffsList() {
  const unack = $("[data-handoffs-unack]");
  const recent = $("[data-handoffs-recent]");
  const unackRows = app.careOps.unackHandoffs;
  const recentRows = app.careOps.handoffs.filter((h) => h.acknowledged_at).slice(0, 30);
  if (unack) unack.innerHTML = unackRows.length ? unackRows.map(renderHandoffCard).join("") : `<p class="empty-state">Nothing waiting for you.</p>`;
  if (recent) recent.innerHTML = recentRows.length ? recentRows.map(renderHandoffCard).join("") : `<p class="empty-state">No recent handoffs.</p>`;
  iconRefresh();
}

function renderHandoffCard(row) {
  const when = row.created_at ? new Date(row.created_at).toLocaleString() : "";
  const ackBtn = !row.acknowledged_at ? `<button class="primary" data-handoff-ack="${escapeHtml(row.id)}">Acknowledge</button>` : "";
  const ackInfo = row.acknowledged_at ? `<span class="meta">Acknowledged ${new Date(row.acknowledged_at).toLocaleString()}</span>` : "";
  const alerts = Array.isArray(row.resident_alerts) ? row.resident_alerts : [];
  const tasks = Array.isArray(row.pending_tasks) ? row.pending_tasks : [];
  return `
    <article class="careops-card">
      <header>
        <div><strong>${escapeHtml(row.shift_label || "Handoff")}</strong></div>
        <span class="meta">${escapeHtml(when)}</span>
      </header>
      <p>${escapeHtml(row.summary || "")}</p>
      ${alerts.length ? `<p class="meta"><strong>Alerts:</strong> ${alerts.map((a) => `${escapeHtml(a.resident_name || "Resident")} - ${escapeHtml(a.note || "")}`).join("; ")}</p>` : ""}
      ${tasks.length ? `<p class="meta"><strong>Pending:</strong> ${tasks.map((t) => escapeHtml(t.title || "Task")).join("; ")}</p>` : ""}
      ${ackInfo}
      <div class="actions">${ackBtn}</div>
    </article>
  `;
}

function renderUnackBanner() {
  const banner = $("[data-careops-banner]");
  if (!banner) return;
  const count = app.careOps.unackHandoffs.length;
  if (count > 0 && app.careOps.activeTab !== "handoff") {
    banner.hidden = false;
    banner.innerHTML = `<i data-lucide="bell-ring"></i><span>${count} unacknowledged handoff${count > 1 ? "s" : ""} waiting for you. Click to review.</span>`;
    iconRefresh();
  } else {
    banner.hidden = true;
  }
}

function openHandoffForm() {
  populateCareOpsSelects();
  const form = $("[data-handoff-form]");
  if (form) form.reset();
  const alertsRows = $("[data-handoff-alerts-rows]");
  const tasksRows = $("[data-handoff-tasks-rows]");
  if (alertsRows) alertsRows.innerHTML = "";
  if (tasksRows) tasksRows.innerHTML = "";
  const labelInput = form && form.elements ? form.elements.shiftLabel : null;
  if (labelInput) labelInput.value = `Handoff ${new Date().toLocaleString()}`;
  $("[data-handoff-modal]").showModal();
  iconRefresh();
}

function addHandoffAlertRow(preset) {
  preset = preset || {};
  const wrap = $("[data-handoff-alerts-rows]");
  if (!wrap) return;
  const residents = app.careOps.residentsCache;
  const options = `<option value="">Resident...</option>` + residents.map((r) => `<option value="${escapeHtml(r.id)}" ${r.id === preset.resident_id ? "selected" : ""}>${escapeHtml(r.full_name || r.name || r.id)}</option>`).join("");
  const row = document.createElement("div");
  row.className = "repeater-row";
  row.innerHTML = `
    <select data-alert-resident>${options}</select>
    <input data-alert-note placeholder="Note" value="${escapeHtml(preset.note || "")}">
    <select data-alert-priority>
      <option ${preset.priority === "Low" ? "selected" : ""}>Low</option>
      <option ${preset.priority === "Medium" ? "selected" : ""}>Medium</option>
      <option ${preset.priority === "High" ? "selected" : ""}>High</option>
    </select>
    <button type="button" class="remove">x</button>
  `;
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function addHandoffTaskRow(preset) {
  preset = preset || {};
  const wrap = $("[data-handoff-tasks-rows]");
  if (!wrap) return;
  const dueValue = preset.due_at ? new Date(preset.due_at).toISOString().slice(0, 16) : "";
  const row = document.createElement("div");
  row.className = "repeater-row";
  row.innerHTML = `
    <input data-task-title placeholder="Task title" value="${escapeHtml(preset.title || "")}">
    <input data-task-due type="datetime-local" value="${dueValue}">
    <input data-task-owner placeholder="Owner" value="${escapeHtml(preset.owner || "")}">
    <button type="button" class="remove">x</button>
  `;
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

async function handleHandoffSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const residentNameById = Object.fromEntries(app.careOps.residentsCache.map((r) => [r.id, r.full_name || r.name || ""]));
  const residentAlerts = $$("[data-handoff-alerts-rows] .repeater-row").map((row) => {
    const id = row.querySelector("[data-alert-resident]")?.value || "";
    return {
      resident_id: id || null,
      resident_name: residentNameById[id] || "",
      note: row.querySelector("[data-alert-note]")?.value || "",
      priority: row.querySelector("[data-alert-priority]")?.value || "Low"
    };
  }).filter((a) => a.note || a.resident_id);
  const pendingTasks = $$("[data-handoff-tasks-rows] .repeater-row").map((row) => ({
    title: row.querySelector("[data-task-title]")?.value || "",
    due_at: row.querySelector("[data-task-due]")?.value || null,
    owner: row.querySelector("[data-task-owner]")?.value || ""
  })).filter((t) => t.title);
  const body = {
    locationId: app.selectedLocationId || "",
    shiftLabel: fd.get("shiftLabel") || "",
    summary: fd.get("summary") || "",
    toUserId: fd.get("toUserId") || null,
    residentAlerts,
    pendingTasks
  };
  try {
    await fetchJson("/api/v2/care/handoffs", { method: "POST", body });
    pushToast("Handoff sent.", "success");
    $("[data-handoff-modal]").close();
    await loadHandoffs();
  } catch (err) {
    pushToast(err.message || "Could not send handoff.", "error");
  }
}

async function handleHandoffAction(event) {
  const ackBtn = event.target.closest("[data-handoff-ack]");
  if (!ackBtn) return;
  try {
    await fetchJson(`/api/v2/care/handoffs/${encodeURIComponent(ackBtn.dataset.handoffAck)}/acknowledge`, { method: "POST", body: {} });
    pushToast("Acknowledged.", "success");
    await loadHandoffs();
  } catch (err) {
    pushToast(err.message || "Acknowledge failed.", "error");
  }
}

// ---------- Family Updates ----------

async function loadFamilyUpdates() {
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  if (app.careOps.familyResidentId) params.set("residentId", app.careOps.familyResidentId);
  const data = await fetchJson(`/api/v2/care/family-updates?${params}`);
  app.careOps.familyUpdates = data.updates || [];
  renderFamilyUpdatesList();
}

function renderFamilyUpdatesList() {
  const container = $("[data-family-updates-list]");
  if (!container) return;
  const rows = app.careOps.familyUpdates;
  if (!rows.length) {
    container.innerHTML = `<p class="empty-state">No family updates yet${app.careOps.familyResidentId ? " for this resident" : ""}.</p>`;
    return;
  }
  const residentNameById = Object.fromEntries(app.careOps.residentsCache.map((r) => [r.id, r.full_name || r.name || ""]));
  container.innerHTML = rows.map((r) => {
    const when = r.sent_at ? new Date(r.sent_at).toLocaleString() : "";
    return `
      <article class="careops-card">
        <header>
          <div>
            <strong>${escapeHtml(residentNameById[r.resident_id] || "Resident")}</strong>
            <span class="meta"> &middot; ${escapeHtml(r.channel)} &middot; to ${escapeHtml(r.to_email || "")}</span>
          </div>
          <span class="meta">${escapeHtml(when)} &middot; ${escapeHtml(r.status)}</span>
        </header>
        ${r.subject ? `<p><strong>${escapeHtml(r.subject)}</strong></p>` : ""}
        <p>${escapeHtml(r.body || "")}</p>
      </article>
    `;
  }).join("");
}

function openFamilyForm() {
  populateCareOpsSelects();
  const form = $("[data-family-form]");
  if (form) {
    form.reset();
    if (app.careOps.familyResidentId && form.elements.residentId) {
      form.elements.residentId.value = app.careOps.familyResidentId;
    }
  }
  $("[data-family-modal]").showModal();
  iconRefresh();
}

async function handleFamilySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const recipient = fd.get("recipient") || "";
  const ok = await showConfirm("Send family update", `Send this update to ${recipient}? This will deliver the message immediately.`);
  if (!ok) return;
  const body = {
    locationId: app.selectedLocationId || "",
    residentId: fd.get("residentId") || "",
    channel: "email",
    recipient,
    subject: fd.get("subject") || "",
    body: fd.get("body") || ""
  };
  try {
    const data = await fetchJson("/api/v2/care/family-updates", { method: "POST", body });
    pushToast((data && data.sendResult && data.sendResult.message) || "Update sent.", "success");
    $("[data-family-modal]").close();
    await loadFamilyUpdates();
  } catch (err) {
    pushToast(err.message || "Could not send update.", "error");
  }
}

// ---------- Schedule ----------

function currentWeekStart(date) {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function shiftScheduleWeek(days) {
  const base = app.careOps.schedule.weekStart ? new Date(app.careOps.schedule.weekStart) : currentWeekStart();
  base.setDate(base.getDate() + days);
  app.careOps.schedule.weekOf = base.toISOString();
  loadSchedule();
}

async function loadSchedule() {
  const locationId = app.selectedLocationId || (app.locations[0]?.id || "");
  if (!locationId) {
    const g = $("[data-schedule-grid]");
    if (g) g.innerHTML = `<p class="empty-state">Select a location to view schedule.</p>`;
    return;
  }
  const weekOf = app.careOps.schedule.weekOf || currentWeekStart().toISOString();
  const params = new URLSearchParams({ locationId, weekOf });
  const data = await fetchJson(`/api/v2/care/schedule?${params}`);
  app.careOps.schedule = { ...app.careOps.schedule, ...data, weekOf };
  renderSchedule();
}

function renderSchedule() {
  const grid = $("[data-schedule-grid]");
  if (!grid) return;
  const start = new Date(app.careOps.schedule.weekStart || currentWeekStart());
  const label = $("[data-schedule-week-label]");
  if (label) label.textContent = `Week of ${start.toLocaleDateString()}`;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime());
    d.setDate(start.getDate() + i);
    return d;
  });
  const shifts = app.careOps.schedule.shifts || [];
  const staffIds = Array.from(new Set([...app.careOps.staffRoster.map((s) => s.id), ...shifts.map((s) => s.user_id)]));
  const staffById = Object.fromEntries(app.careOps.staffRoster.map((s) => [s.id, s.fullName]));
  if (!staffIds.length) {
    grid.innerHTML = `<p class="empty-state">No staff assigned to this location yet.</p>`;
    return;
  }
  const rows = staffIds.map((sid) => {
    const cells = days.map((d) => {
      const dayShifts = shifts.filter((s) => s.user_id === sid && sameDay(new Date(s.starts_at), d));
      return `<td>${dayShifts.map(renderShiftChip).join("") || ""}</td>`;
    }).join("");
    return `<tr><th>${escapeHtml(staffById[sid] || sid)}</th>${cells}</tr>`;
  }).join("");
  const headers = days.map((d) => `<th>${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</th>`).join("");
  grid.innerHTML = `<table><thead><tr><th>Staff</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderShiftChip(shift) {
  const start = new Date(shift.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const end = new Date(shift.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `<span class="shift-chip ${escapeHtml(shift.status || "scheduled")}" data-shift-chip="${escapeHtml(shift.id)}" title="${escapeHtml(shift.notes || "")}">${escapeHtml(shift.role || "Shift")} ${escapeHtml(start)}-${escapeHtml(end)}</span>`;
}

function openShiftForm() {
  populateCareOpsSelects();
  const form = $("[data-shift-form]");
  if (form) form.reset();
  $("[data-shift-modal]").showModal();
  iconRefresh();
}

async function handleShiftSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const body = {
    locationId: app.selectedLocationId || "",
    userId: fd.get("userId"),
    role: fd.get("role") || "",
    startsAt: fd.get("startsAt"),
    endsAt: fd.get("endsAt"),
    notes: fd.get("notes") || ""
  };
  try {
    await fetchJson("/api/v2/care/schedule/shifts", { method: "POST", body });
    pushToast("Shift saved.", "success");
    $("[data-shift-modal]").close();
    await loadSchedule();
  } catch (err) {
    pushToast(err.message || "Could not save shift.", "error");
  }
}

async function handlePublishWeek() {
  const ok = await showConfirm("Publish week", "Publish all scheduled shifts for this week to staff?");
  if (!ok) return;
  try {
    const data = await fetchJson("/api/v2/care/schedule/publish", { method: "POST", body: {
      locationId: app.selectedLocationId || "",
      weekOf: app.careOps.schedule.weekOf || currentWeekStart().toISOString()
    }});
    pushToast(`Published ${data.published} shift${data.published === 1 ? "" : "s"}.`, "success");
    await loadSchedule();
  } catch (err) {
    pushToast(err.message || "Publish failed.", "error");
  }
}

async function handleScheduleChipClick(event) {
  const chip = event.target.closest("[data-shift-chip]");
  if (!chip) return;
  const id = chip.dataset.shiftChip;
  const shift = (app.careOps.schedule.shifts || []).find((s) => s.id === id);
  if (!shift) return;
  const action = window.prompt(`Shift ${shift.role || ""} ${new Date(shift.starts_at).toLocaleString()}\nActions: publish, request-swap, cancel${app.user?.role === "super_admin" ? ", delete" : ""}\nType action:`);
  if (!action) return;
  try {
    if (action === "publish") {
      await fetchJson(`/api/v2/care/schedule/shifts/${encodeURIComponent(id)}`, { method: "PATCH", body: { status: "published" } });
    } else if (action === "cancel") {
      await fetchJson(`/api/v2/care/schedule/shifts/${encodeURIComponent(id)}/cancel`, { method: "POST", body: {} });
    } else if (action === "delete") {
      const ok = await showConfirm("Delete shift", "Permanently delete this shift?");
      if (!ok) return;
      await fetchJson(`/api/v2/care/schedule/shifts/${encodeURIComponent(id)}`, { method: "DELETE" });
    } else if (action === "request-swap") {
      const reason = window.prompt("Reason for swap (optional):") || "";
      await fetchJson("/api/v2/care/schedule/swaps", { method: "POST", body: { shiftId: id, reason } });
    } else {
      return;
    }
    pushToast("Done.", "success");
    await loadSchedule();
  } catch (err) {
    pushToast(err.message || "Action failed.", "error");
  }
}
