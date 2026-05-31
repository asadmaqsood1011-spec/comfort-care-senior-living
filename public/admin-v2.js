// @ts-check

boot();

window.addEventListener("unhandledrejection", (event) => {
  setStatus(event.reason?.message || "Something went wrong.", true);
});

async function boot() {
  bindStaticEvents();
  setStatus("Loading operations hub...");
  try {
    const config = await fetchJson("/api/v2/config", { skipAuth: true });
    if (config.supabaseAnonKey) {
      app.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    app.session = await restoreStoredSession(config.authMode === "browser" && config.supabaseAnonKey);
    if (app.session || config.authMode === "server") await loadSession();
    else showAuth();
  } catch (err) {
    showAuth();
    setLoginStatus(err.message || "Unable to load Supabase configuration.");
  } finally {
    iconRefresh();
  }
}

function bindStaticEvents() {
  $("[data-login-form]").addEventListener("submit", handleLogin);
  $("[data-logout]").addEventListener("click", handleLogout);
  $("[data-focus-mode]").addEventListener("click", () => toggleFocusMode());
  $("[data-super-notifications]")?.addEventListener("click", () => setView("dashboard"));
  $("[data-notifications]")?.addEventListener("click", openNotificationCenter);
  $("[data-close-notifications]")?.addEventListener("click", () => $("[data-notification-modal]")?.close());
  $("[data-notification-list]")?.addEventListener("click", handleNotificationAction);
  $("[data-open-apps]")?.addEventListener("click", openAppsPanel);
  $("[data-refresh]").addEventListener("click", refreshAll);
  $("[data-close-work-sprint]")?.addEventListener("click", () => $("[data-work-sprint-modal]")?.close());
  $("[data-work-sprint-modal]")?.addEventListener("click", handleIntelligenceClick);
  $("[data-location-switcher]").addEventListener("change", (event) => {
    app.selectedLocationId = event.target.value;
    refreshAll();
  });
  window.addEventListener("hashchange", () => {
    const view = viewFromHash();
    if (view && view !== app.activeView) setView(view, { updateHash: false });
  });
  $("[data-panel='dashboard']").addEventListener("click", handleIntelligenceClick);
  $("[data-panel='dashboard']").addEventListener("click", handleScopeControlClick);
  $("[data-coordination-strip]").addEventListener("click", handleIntelligenceClick);
  $("[data-mission-context]")?.addEventListener("click", handleIntelligenceClick);
  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $("[data-lead-status-filter]").addEventListener("change", () => { app.leadsPagination.page = 1; loadLeads(1); });
  $("[data-open-create-lead]").addEventListener("click", openCreateLead);
  $("[data-close-create-lead]").addEventListener("click", () => $("[data-create-lead-modal]").close());
  $("[data-create-lead-form]").addEventListener("submit", handleCreateLead);
  $("[data-export-leads]").addEventListener("click", handleLeadExport);
  $("[data-close-lead-detail]").addEventListener("click", () => $("[data-lead-detail-modal]").close());
  $("[data-save-lead-notes]").addEventListener("click", handleSaveLeadNotes);
  $("[data-generate-lead-email]").addEventListener("click", handleGenerateLeadEmail);
  $("[data-send-lead-email]").addEventListener("click", handleSendLeadEmail);
  $("[data-lead-detail-modal]").addEventListener("click", handleLeadDetailTabs);
  $("[data-detail-followup]").addEventListener("click", () => {
    if (app.selectedLeadDetail?.lead?.id) {
      $("[data-lead-detail-modal]").close();
      setQuickFollowUp(app.selectedLeadDetail.lead.id);
    }
  });
  $("[data-tour-form]").addEventListener("submit", handleTourSubmit);
  $("[data-followup-form]").addEventListener("submit", handleFollowUpSubmit);
  $("[data-task-form]").addEventListener("submit", handleTaskSubmit);
  $("[data-room-form]")?.addEventListener("submit", handleRoomSubmit);
  $("[data-room-status-filter]")?.addEventListener("change", handleRoomFilters);
  $("[data-room-care-filter]")?.addEventListener("input", handleRoomFilters);
  $("[data-room-type-filter]")?.addEventListener("change", handleRoomFilters);
  $("[data-close-room-detail]")?.addEventListener("click", () => $("[data-room-detail-modal]")?.close());
  $("[data-resident-form]").addEventListener("submit", handleResidentSubmit);
  $("[data-close-room-condition]")?.addEventListener("click", () => $("[data-room-condition-modal]")?.close());
  $("[data-room-condition-form]")?.addEventListener("submit", handleRoomConditionSubmit);
  $("[data-document-form]").addEventListener("submit", handleDocumentUpload);
  $("[data-referral-partner-form]")?.addEventListener("submit", handleReferralPartnerSubmit);
  $("[data-calendar-integration]")?.addEventListener("click", handleCalendarIntegrationClick);
  $("[data-open-create-user]").addEventListener("click", openCreateUser);
  $("[data-close-create-user]").addEventListener("click", () => $("[data-create-user-modal]").close());
  $("[data-create-user-form]").addEventListener("submit", handleCreateUser);
  $("[data-refresh-rules]")?.addEventListener("click", loadIntelligenceRules);
  $("[data-intelligence-rules]")?.addEventListener("click", handleRuleAction);
  $$("[data-lead-view]").forEach((button) => button.addEventListener("click", () => setLeadView(button.dataset.leadView)));
  $("[data-activity-filter]")?.addEventListener("change", renderFilteredActivity);
  $("[data-refresh-activity]")?.addEventListener("click", () => refreshAll().then(renderFilteredActivity));
  $("[data-sidebar-toggle]")?.addEventListener("click", toggleSidebar);
  $("[data-sidebar-overlay]")?.addEventListener("click", () => {
    $("[data-app-shell]")?.classList.remove("sidebar-open");
  });
  $("[data-close-kbd-modal]")?.addEventListener("click", () => $("[data-kbd-modal]")?.close());
  $("[data-kbd-modal]")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });
  $("[data-leads-prev]")?.addEventListener("click", () => { if (app.leadsPagination.page > 1) changeLeadsPage(app.leadsPagination.page - 1); });
  $("[data-leads-next]")?.addEventListener("click", () => { if (app.leadsPagination.page < app.leadsPagination.pageCount) changeLeadsPage(app.leadsPagination.page + 1); });
  $("[data-lead-search]").addEventListener("input", debounce(() => { app.leadsPagination.page = 1; loadLeads(1); }, 250));
  bindPipelineDnD();
  bindCommandPalette();
  bindOperatorShortcuts();
  bindBulkActions();
  bindAiPanels();
  bindMassOutreach();
  bindArchiveAndMerge();
  bindCareOps();
  applyFocusMode();
}

function bindArchiveAndMerge() {
  $("[data-close-archive]")?.addEventListener("click", () => $("[data-archive-modal]").close());
  $("[data-archive-form]")?.addEventListener("submit", handleArchiveSubmit);
  $("[data-close-merge]")?.addEventListener("click", () => $("[data-merge-modal]").close());
  $("[data-merge-form]")?.addEventListener("submit", handleMergeSubmit);
  $("[data-close-pipeline-transition]")?.addEventListener("click", () => $("[data-pipeline-transition-modal]")?.close());
  $("[data-pipeline-transition-form]")?.addEventListener("submit", handlePipelineTransitionSubmit);
}

function toggleFocusMode(force) {
  app.focusMode = typeof force === "boolean" ? force : !app.focusMode;
  localStorage.setItem("ccsl:v2-focus-mode", String(app.focusMode));
  applyFocusMode();
}

function applyFocusMode() {
  document.body.classList.toggle("focus-mode", Boolean(app.focusMode));
  const button = $("[data-focus-mode]");
  if (button) {
    button.innerHTML = app.focusMode
      ? `<i data-lucide="minimize-2"></i>Exit focus`
      : `<i data-lucide="crosshair"></i>Focus mode`;
  }
  iconRefresh();
}

let pendingArchiveLeadId = "";
function openArchiveModal(leadId) {
  pendingArchiveLeadId = leadId;
  const form = $("[data-archive-form]");
  form.reset();
  $("[data-archive-modal]").showModal();
}

async function handleArchiveSubmit(event) {
  event.preventDefault();
  if (!pendingArchiveLeadId) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await fetchJson(`/api/v2/leads/${pendingArchiveLeadId}/archive`, { method: "POST", body });
    $("[data-archive-modal]").close();
    pushToast("Lead archived with reason.", "success");
    await refreshAfterWorkflowChange();
  } catch (err) {
    pushToast(err.message || "Could not archive.", "error");
  }
}

function openMergeModal() {
  const opts = app.leads.map((l) => `<option value="${l.id}">${escapeHtml(l.full_name)} &middot; ${escapeHtml(locationName(l.location_id))}</option>`).join("");
  $("[data-merge-primary]").innerHTML = opts;
  $("[data-merge-duplicate]").innerHTML = opts;
  $("[data-merge-modal]").showModal();
}

async function handleMergeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await fetchJson("/api/v2/leads/merge", { method: "POST", body });
    $("[data-merge-modal]").close();
    pushToast("Leads merged.", "success");
    await refreshAll();
  } catch (err) {
    pushToast(err.message || "Merge failed.", "error");
  }
}

function bindAiPanels() {
  $("[data-morning-brief]")?.addEventListener("click", openMorningBrief);
  $("[data-close-morning-brief]")?.addEventListener("click", () => $("[data-morning-brief-modal]").close());
  $("[data-close-tour-prep]")?.addEventListener("click", () => $("[data-tour-prep-modal]").close());
  $("[data-close-triage]")?.addEventListener("click", () => $("[data-triage-modal]").close());
  $("[data-run-triage]")?.addEventListener("click", runTriage);
}

async function openMorningBrief() {
  const dialog = $("[data-morning-brief-modal]");
  const out = $("[data-morning-brief-result]");
  out.innerHTML = `<p class="helper-text">Building today's brief...</p>`;
  dialog.showModal();
  try {
    const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
    const data = await fetchJson(`/api/v2/intelligence/morning-brief${query}`, { method: "POST", timeoutMs: 30000 });
    const b = data.brief || {};
    out.innerHTML = `
      <div class="ai-section"><h3>Headline</h3><p>${escapeHtml(b.headline || "")}</p></div>
      ${(b.overnight || []).length ? `<div class="ai-section"><h3>Overnight</h3><ul>${b.overnight.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      ${(b.today || []).length ? `<div class="ai-section"><h3>Today</h3><ul>${b.today.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      ${(b.watch || []).length ? `<div class="ai-section"><h3>Watch</h3><ul>${b.watch.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      ${b.celebrate ? `<div class="ai-section"><h3>Celebrate</h3><p>${escapeHtml(b.celebrate)}</p></div>` : ""}
      <small class="helper-text">${escapeHtml(data.provider || "deterministic")} &middot; ${formatDate(data.generatedAt)}</small>
    `;
    iconRefresh();
  } catch (err) {
    out.innerHTML = `<p class="helper-text">${escapeHtml(err.message || "Could not generate brief.")}</p>`;
  }
}

async function openTourPrep(tourId) {
  const dialog = $("[data-tour-prep-modal]");
  const out = $("[data-tour-prep-result]");
  $("[data-tour-prep-title]").textContent = "Tour prep brief";
  out.innerHTML = `<p class="helper-text">Generating talking points...</p>`;
  dialog.showModal();
  try {
    const data = await fetchJson(`/api/v2/tours/${tourId}/prep-brief`, { method: "POST", timeoutMs: 30000 });
    const b = data.brief || {};
    if (data.lead?.name) $("[data-tour-prep-title]").textContent = `Tour prep: ${data.lead.name}`;
    out.innerHTML = `
      ${b.summary ? `<div class="ai-section"><h3>Summary</h3><p>${escapeHtml(b.summary)}</p></div>` : ""}
      ${(b.talkingPoints || []).length ? `<div class="ai-section"><h3>Talking points</h3><ul>${b.talkingPoints.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      ${(b.sensitivities || []).length ? `<div class="ai-section"><h3>Sensitivities</h3><ul>${b.sensitivities.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      ${(b.questionsToAsk || []).length ? `<div class="ai-section"><h3>Questions to ask</h3><ul>${b.questionsToAsk.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      ${(b.redFlags || []).length ? `<div class="ai-section"><h3>Red flags</h3><ul>${b.redFlags.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}
      <small class="helper-text">${escapeHtml(data.provider || "deterministic")} &middot; ${formatDate(data.generatedAt)}</small>
    `;
    iconRefresh();
  } catch (err) {
    out.innerHTML = `<p class="helper-text">${escapeHtml(err.message || "Could not generate brief.")}</p>`;
  }
}

function openTriage() {
  const dialog = $("[data-triage-modal]");
  $("[data-triage-input]").value = "";
  $("[data-triage-result]").hidden = true;
  $("[data-triage-result]").innerHTML = "";
  dialog.showModal();
}

async function runTriage() {
  const text = $("[data-triage-input]").value.trim();
  if (!text) return pushToast("Paste a message first", "error");
  const out = $("[data-triage-result]");
  out.hidden = false;
  out.innerHTML = `<p class="helper-text">Analyzing...</p>`;
  try {
    const data = await fetchJson(`/api/v2/intelligence/triage`, { method: "POST", body: { text }, timeoutMs: 30000 });
    const t = data.triage || {};
    const ex = t.extractedFields || {};
    const reply = t.suggestedReply || {};
    out.innerHTML = `
      <div class="ai-section">
        <div class="triage-meta">
          <span class="ai-pill ${t.urgency === "high" || t.urgency === "critical" ? "urgent" : t.urgency === "medium" ? "warn" : ""}">${escapeHtml(t.urgency || "medium")} urgency</span>
          <span class="ai-pill">${escapeHtml(t.intent || "other")}</span>
          <span class="ai-pill">${escapeHtml(t.sentiment || "neutral")}</span>
        </div>
        <p>${escapeHtml(t.summary || "")}</p>
      </div>
      <div class="ai-section">
        <h3>Extracted fields</h3>
        <p><strong>Care type:</strong> ${escapeHtml(ex.careType || "Unknown")} &middot; <strong>Timeline:</strong> ${escapeHtml(ex.moveTimeline || "Unknown")} &middot; <strong>Decision maker:</strong> ${escapeHtml(ex.decisionMaker || "Unknown")}</p>
        ${ex.budgetSignal ? `<p><strong>Budget signal:</strong> ${escapeHtml(ex.budgetSignal)}</p>` : ""}
      </div>
      <div class="ai-section">
        <h3>Suggested reply${reply.subject ? ` &middot; <em>${escapeHtml(reply.subject)}</em>` : ""}</h3>
        <div class="triage-reply">${escapeHtml(reply.body || "")}</div>
      </div>
      ${t.internalNotes ? `<div class="ai-section"><h3>Internal note</h3><p>${escapeHtml(t.internalNotes)}</p></div>` : ""}
      <small class="helper-text">${escapeHtml(data.provider || "deterministic")} &middot; ${formatDate(data.generatedAt)}</small>
    `;
    iconRefresh();
  } catch (err) {
    out.innerHTML = `<p class="helper-text">${escapeHtml(err.message || "Triage failed.")}</p>`;
  }
}

function bindBulkActions() {
  const selectAll = $("[data-bulk-select-all]");
  if (selectAll) selectAll.addEventListener("change", (event) => {
    const checked = event.target.checked;
    app.selectedLeadIds = checked ? new Set(app.leads.map((l) => l.id)) : new Set();
    renderLeads();
  });
  $("[data-bulk-apply]").addEventListener("click", handleBulkApply);
  $("[data-bulk-clear]").addEventListener("click", () => { app.selectedLeadIds = new Set(); renderLeads(); });
}

function bindMassOutreach() {
  const form = $("[data-outreach-form]");
  if (!form) return;
  form.addEventListener("input", debounce(renderOutreachPreview, 150));
  form.addEventListener("change", renderOutreachPreview);
  $("[data-outreach-draft]")?.addEventListener("click", draftMassOutreach);
  $("[data-outreach-test]")?.addEventListener("click", sendMassOutreachTest);
  $("[data-outreach-demo]")?.addEventListener("click", () => sendMassOutreachCampaign({ demoOnly: true }));
  $("[data-outreach-live]")?.addEventListener("click", () => sendMassOutreachCampaign({ demoOnly: false }));
  $("[data-outreach-refresh-history]")?.addEventListener("click", loadOutreachHistory);
  $("[data-outreach-show-archived]")?.addEventListener("change", loadOutreachHistory);
}

async function handleBulkApply() {
  const status = $("[data-bulk-status]").value;
  if (!status) return pushToast("Pick a status first", "error");
  const ids = [...app.selectedLeadIds];
  if (!ids.length) return;
  setStatus(`Updating ${ids.length} lead${ids.length === 1 ? "" : "s"}...`);
  try {
    await fetchJson("/api/v2/leads/bulk", { method: "POST", body: { ids, status } });
    app.selectedLeadIds = new Set();
    app.leadsPagination.page = 1;
    setStatus(`Updated ${ids.length} lead${ids.length === 1 ? "" : "s"}.`);
    await refreshAll();
  } catch (err) {
    setStatus(err.message || "Bulk update failed.", true);
  }
}

function leadSlaState(lead) {
  if (!lead || lead.status === "move_in" || lead.status === "archived") return null;
  const ref = lead.updated_at || lead.created_at;
  if (!ref) return null;
  const hours = (Date.now() - new Date(ref).getTime()) / 3600000;
  const limit = SLA_HOURS[lead.status] ?? 72;
  if (hours >= limit) return { kind: "breach", text: `SLA ${Math.round(hours - limit)}h late` };
  if (hours >= limit * 0.66) return { kind: "warn", text: `SLA ${Math.round(limit - hours)}h left` };
  return null;
}

function leadBadgesHtml(lead) {
  const parts = [];
  if (lead.duplicate_of) parts.push(`<span class="lead-badge dup" title="${escapeHtml(lead.duplicate_reason || "Possible duplicate")}">DUP</span>`);
  const sla = leadSlaState(lead);
  if (sla) parts.push(`<span class="lead-badge sla-${sla.kind}">${escapeHtml(sla.text)}</span>`);
  return parts.join("");
}

function bindPipelineDnD() {
  const pipeline = $("[data-lead-pipeline]");
  if (!pipeline) return;
  pipeline.addEventListener("dragover", (event) => {
    const column = event.target.closest(".pipeline-column");
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    $$(".pipeline-column.drop-target", pipeline).forEach((el) => el !== column && el.classList.remove("drop-target"));
    column.classList.add("drop-target");
  });
  pipeline.addEventListener("dragleave", (event) => {
    const column = event.target.closest(".pipeline-column");
    if (column && !column.contains(event.relatedTarget)) column.classList.remove("drop-target");
  });
  pipeline.addEventListener("drop", async (event) => {
    const column = event.target.closest(".pipeline-column");
    if (!column) return;
    event.preventDefault();
    column.classList.remove("drop-target");
    const leadId = event.dataTransfer.getData("text/plain");
    const targetStatus = column.dataset.status;
    if (!leadId || !targetStatus) return;
    await moveLeadToStatus(leadId, targetStatus);
  });
  pipeline.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pipeline-followup], button[data-pipeline-open]");
    if (!button) return;
    event.stopPropagation();
    if (button.dataset.pipelineOpen) openLeadDetail(button.dataset.pipelineOpen);
    else if (button.dataset.pipelineFollowup) setQuickFollowUp(button.dataset.pipelineFollowup);
  });
}

function bindCommandPalette() {
  const dialog = $("[data-cmdk]");
  const input = $("[data-cmdk-input]");
  const results = $("[data-cmdk-results]");
  if (!dialog || !input || !results) return;
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    } else if (event.key === "Escape" && dialog.open) {
      dialog.close();
    }
  });
  input.addEventListener("input", renderCommandPalette);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); moveCmdkActive(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveCmdkActive(-1); }
    else if (event.key === "Enter")  { event.preventDefault(); runActiveCmdk(); }
  });
  results.addEventListener("click", (event) => {
    const item = event.target.closest("[data-cmdk-index]");
    if (!item) return;
    app.cmdk.activeIndex = Number(item.dataset.cmdkIndex);
    runActiveCmdk();
  });
  dialog.addEventListener("close", () => { input.value = ""; });
}

function bindOperatorShortcuts() {
  document.addEventListener("keydown", async (event) => {
    const target = event.target;
    const isTyping = target?.matches?.("input, textarea, select, [contenteditable='true']");

    // Ctrl+\ toggles sidebar (works even while typing)
    if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
      event.preventDefault();
      toggleSidebar();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "Escape") {
      const openDialog = $("dialog[open]");
      if (openDialog) {
        event.preventDefault();
        openDialog.close();
      }
      return;
    }
    if (isTyping || $("dialog[open]")) return;
    if (event.key === "?") {
      event.preventDefault();
      $("[data-kbd-modal]")?.showModal();
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      setView("leads");
      setTimeout(() => $("[data-lead-search]")?.focus(), 0);
      return;
    }
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      openCreateLead();
      return;
    }
    if (app.activeView !== "dashboard") return;
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      moveToNextCommand();
      return;
    }
    if (event.key.toLowerCase() === "d") {
      event.preventDefault();
      await completeCommand(findCommand(app.activeCommandId));
    }
  });
}

function toggleSidebar() {
  const shell = $("[data-app-shell]");
  if (!shell) return;
  const isOverlay = window.matchMedia("(max-width: 1120px)").matches;
  if (isOverlay) {
    shell.classList.toggle("sidebar-open");
  } else {
    shell.classList.toggle("sidebar-collapsed");
  }
}

function showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = $("[data-confirm-modal]");
    if (!modal) { resolve(window.confirm(message)); return; }
    $("[data-confirm-title]").textContent = title;
    $("[data-confirm-message]").textContent = message;
    modal.showModal();
    const ok = $("[data-confirm-ok]");
    const cancel = $("[data-confirm-cancel]");
    function cleanup(result) {
      modal.close();
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      modal.removeEventListener("close", onClose);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onClose() { cleanup(false); }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    modal.addEventListener("close", onClose, { once: true });
  });
}

function moveToNextCommand() {
  const items = getCommandCenterItems();
  if (!items.length) return;
  const index = Math.max(0, items.findIndex((item) => item.id === app.activeCommandId));
  setActiveCommand(items[(index + 1) % items.length].id);
}

async function changeLeadsPage(page) {
  await loadLeads(page);
  refreshDashboardSnapshot().catch(() => {});
}

async function refreshDashboardSnapshot() {
  if (!app.session) return;
  invalidate("dashboard");
  invalidate("intelligence");
  invalidate("operations");
  await Promise.all([
    loadDashboard(),
    loadIntelligence(),
    loadOperations(),
    loadRevenueCommand().catch(() => {})
  ]);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;
  const button = form.querySelector("button[type='submit']");
  try {
    if (button) button.disabled = true;
    setLoginStatus("Signing in...");
    setStatus("");
    const data = await fetchJson("/api/v2/login", { method: "POST", body: { email, password }, skipAuth: true });
    if (!data.session?.access_token) throw new Error("Login succeeded but no session was returned.");
    app.session = data.session;
    if (app.supabase && app.session.refresh_token) {
      await app.supabase.auth.setSession({
        access_token: app.session.access_token,
        refresh_token: app.session.refresh_token
      }).catch(() => {});
    }
    storeSession(app.session);
    setLoginStatus("Loading your dashboard...");
    showApp();
    await loadSession();
  } catch (err) {
    setLoginStatus(err.message || "Unable to sign in.");
    setStatus(err.message || "Unable to sign in.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleLogout() {
  await fetchJson("/api/v2/logout", { method: "POST", skipAuth: true }).catch(() => {});
  if (app.supabase) await app.supabase.auth.signOut();
  storeSession(null);
  app.session = null;
  app.user = null;
  stopBackgroundLoops();
  showAuth();
}

async function loadSession() {
  const data = await fetchJson("/api/v2/session");
  app.user = data.user;
  app.locations = data.locations || [];
  hydrateLocationSwitcher();
  const initialView = viewFromHash();
  if (initialView && initialView !== app.activeView) setView(initialView, { updateHash: false });
  showApp();
  try {
    await refreshAll();
  } catch (err) {
    setStatus(err.message || "Unable to load dashboard data.", true);
  } finally {
    startBackgroundLoops();
  }
}

let _realtimeChannel = null;
let _liveRefreshEventsBound = false;

function startBackgroundLoops() {
  stopBackgroundLoops();
  coordinationTicker = setInterval(renderCoordinationStrip, 30_000);
  silentRefreshTimer = setInterval(silentRefresh, 30_000);
  bindLiveRefreshEvents();
  bindRealtimeSubscriptions();
}

function stopBackgroundLoops() {
  if (coordinationTicker) clearInterval(coordinationTicker);
  if (silentRefreshTimer) clearInterval(silentRefreshTimer);
  coordinationTicker = null;
  silentRefreshTimer = null;
  if (_realtimeChannel) { try { app.supabase?.removeChannel(_realtimeChannel); } catch (_) {} _realtimeChannel = null; }
}

function bindRealtimeSubscriptions() {
  if (!app.supabase) return;
  if (_realtimeChannel) { try { app.supabase.removeChannel(_realtimeChannel); } catch (_) {} }
  _realtimeChannel = app.supabase
    .channel("admin-v2-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads_v2" }, () => handleRealtimeChange(["leads", "dashboard", "operatingPlan", "intelligence", "revenueCommand", "scopeControl"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms_v2" }, () => handleRealtimeChange(["operations", "roomIntelligence", "dashboard", "operatingPlan", "revenueCommand", "scopeControl"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "residents_v2" }, () => handleRealtimeChange(["operations", "dashboard", "roomIntelligence", "revenueCommand"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "tours" }, () => handleRealtimeChange(["operations", "dashboard", "operatingPlan", "intelligence"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, () => handleRealtimeChange(["operations", "dashboard", "operatingPlan", "intelligence"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "operating_plan_items" }, () => handleRealtimeChange(["operatingPlan", "dashboard"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "operational_events" }, () => handleRealtimeChange(["intelligence", "dashboard", "scopeControl"]))
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => handleRealtimeChange(["intelligence", "dashboard"]))
    .subscribe();
}

function bindLiveRefreshEvents() {
  if (_liveRefreshEventsBound) return;
  _liveRefreshEventsBound = true;
  window.addEventListener("focus", () => {
    silentRefresh().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAll().catch(() => {});
  });
}

function handleRealtimeChange(keys) {
  keys.forEach(invalidate);
  if (!document.hidden) silentRefresh().catch(() => {});
}

async function silentRefresh() {
  if (!app.session || document.hidden) return;
  const tasks = [];
  const maybeLoad = (key, fn, ttl = 55000) => {
    if (!isFresh(key, ttl)) tasks.push(runRefreshTask(key, fn));
  };
  maybeLoad("intelligence", loadIntelligence);
  maybeLoad("operations", loadOperations);
  if (app.activeView === "dashboard") {
    maybeLoad("dashboard", loadDashboard);
    maybeLoad("operatingPlan", loadOperatingPlan);
    maybeLoad("revenueCommand", () => loadRevenueCommand().catch(() => {}));
    maybeLoad("escalations", () => loadEscalations().catch(() => {}));
    maybeLoad("placementDesk", () => loadPlacementDesk().catch(() => {}));
    maybeLoad("roomIntelligence", () => loadRoomIntelligence().catch(() => {}));
    maybeLoad("scopeControl", () => loadScopeControl().catch(() => {}));
    maybeLoad("forecast", () => loadForecast().catch(() => {}));
    maybeLoad("referralRoi", () => loadReferralRoi().catch(() => {}));
  }
  if (app.activeView === "leads") maybeLoad("leads", loadLeads);
  if (app.activeView === "outreach") {
    maybeLoad("outreachHistory", () => loadOutreachHistory().catch(() => {}));
    maybeLoad("referralPartners", () => loadReferralPartners().catch(() => {}));
  }
  if (app.activeView === "checkins") maybeLoad("checkIns", loadCheckIns);
  if (app.activeView === "rooms") maybeLoad("roomIntelligence", () => loadRoomIntelligence().catch(() => {}));
  if (["tours", "operations"].includes(app.activeView)) maybeLoad("integrations", () => loadIntegrations().catch(() => {}));
  if (tasks.length) {
    try {
      await Promise.all(tasks);
      renderCommandCenterSnapshot();
    } catch (_) {}
  }
}

async function runRefreshTask(label, task, timeoutMs = 20000) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} refresh timed out.`)), timeoutMs);
  });
  try {
    await Promise.race([Promise.resolve().then(task), timeout]);
    return { label, ok: true };
  } catch (reason) {
    return { label, ok: false, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function refreshAll() {
  if (!app.session) return;
  invalidateAll();
  const refreshBtn = $("[data-refresh]");
  if (refreshBtn) { refreshBtn.dataset.loading = "true"; refreshBtn.disabled = true; }
  setStatus("Refreshing...");
  const tasks = [
    ["dashboard", loadDashboard],
    ["operating plan", loadOperatingPlan],
    ["intelligence", loadIntelligence],
    ["leads", loadLeads],
    ["operations", loadOperations],
    ["workflows", () => loadWorkflows()],
    ["escalations", () => loadEscalations()],
    ["placement desk", () => loadPlacementDesk()],
    ["room intelligence", () => loadRoomIntelligence()],
    ["revenue command", () => loadRevenueCommand()],
    ["forecast", loadForecast],
    ["referral ROI", loadReferralRoi],
    ["referral partners", () => loadReferralPartners()],
    ["integrations", () => loadIntegrations()],
    ["outreach history", () => loadOutreachHistory()],
    ["scope control", () => loadScopeControl()]
  ];
  let failed = [];
  try {
    const results = await Promise.all(tasks.map(([label, task]) => runRefreshTask(label, task)));
    failed = results.filter((result) => !result.ok);
    if (failed.length === tasks.length) {
      const message = failed[0]?.reason?.message || "Unable to load dashboard data.";
      throw new Error(message);
    }
    if (app.activeView === "checkins") await runRefreshTask("check-ins", loadCheckIns);
    renderCommandCenterSnapshot();
  } finally {
    if (refreshBtn) { delete refreshBtn.dataset.loading; refreshBtn.disabled = false; }
  }
  if (failed.length) {
    console.warn("Admin-v2 refresh skipped panels:", failed.map((item) => `${item.label}: ${item.reason?.message || item.reason}`).join("; "));
    setStatus(`Data refreshed. ${failed.length} panel${failed.length === 1 ? "" : "s"} need attention.`, true);
  } else {
    setStatus("");
  }
  iconRefresh();
}

async function rescanIntelligenceAfterWorkflowChange() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  try {
    await fetchJson(`/api/v2/intelligence/scan${query}`, { method: "POST", timeoutMs: 30000 });
  } catch (err) {
    console.warn("Operational scan after workflow change failed:", err?.message || err);
  }
}

async function refreshAfterWorkflowChange(outcome) {
  await rescanIntelligenceAfterWorkflowChange();
  await refreshAll();
  if (outcome) {
    const afterCount = buildAdmissionsCommands().length;
    app.workflowOutcome = buildWorkflowOutcome({ ...outcome, afterCount });
    pushToast(app.workflowOutcome.title, "success");
    renderExecutionSystem();
  }
}

async function updateOperatingPlanAction(id, action) {
  if (!id || !action) return;
  const beforeItem = (app.operatingPlan?.items || []).find((item) => String(item.id) === String(id));
  const beforeTitle = beforeItem?.title || "Operating plan item";
  const assignmentPanel = document.querySelector(`[data-assignment-for="${CSS.escape(String(id))}"]`);
  const assignmentBody = assignmentPanel && action === "assign"
    ? {
        ownerRole: assignmentPanel.querySelector("[data-assignment-owner]")?.value || "",
        dueAt: assignmentPanel.querySelector("[data-assignment-due]")?.value || ""
      }
    : {};
  try {
    await fetchJson(`/api/v2/operating-plan/${id}`, {
      method: "PATCH",
      body: action === "snooze"
        ? { action, minutes: 1440 }
        : action === "assign"
          ? { action, createTask: true, ...assignmentBody }
          : { action }
    });
    pushToast(action === "assign" ? "Plan item assigned." : action === "snooze" ? "Plan item snoozed." : "Plan item completed.", "success");
    await loadOperatingPlan();
    await loadOperations();
    const nextItem = (app.operatingPlan?.items || [])[0] || null;
    app.operatingOutcome = {
      id,
      action,
      title: beforeTitle,
      nextTitle: nextItem?.title || "",
      at: new Date().toISOString()
    };
    renderDailyOperatingPlanHome();
  } catch (err) {
    pushToast(err.message || "Could not update plan item.", "error");
  }
}

async function loadForecast() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  try {
    app.forecast = await fetchJson(`/api/v2/forecast/occupancy${query}`);
    markFresh("forecast");
    renderForecast();
  } catch (_) {}
}

async function loadReferralRoi() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  try {
    const data = await fetchJson(`/api/v2/reports/referrals${query}`);
    app.referrals = data.sources || [];
    markFresh("referralRoi");
    renderReferralRoi();
  } catch (_) {}
}

async function loadIntegrations() {
  try {
    app.integrations = await fetchJson("/api/v2/integrations");
    markFresh("integrations");
  } catch (err) {
    app.integrations = { schemaInstalled: false, integrations: [], message: err.message || "Could not load integrations." };
  }
  renderCalendarIntegration();
  renderAppConnectionsHome();
  renderSystemHealth();
}

async function loadReferralPartners() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  const data = await fetchJson(`/api/v2/referral-partners${query}`);
  app.referralPartners = data || { partners: [] };
  markFresh("referralPartners");
  renderReferralPartners();
}

async function loadScopeControl() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  try {
    app.scopeControl = await fetchJson(`/api/v2/scope-control${query}`);
    markFresh("scopeControl");
  } catch (err) {
    app.scopeControl = { error: err.message || "Scope control unavailable." };
  }
  renderScopeControl();
  renderNotificationButton();
  renderMarketingActions();
  renderAdmissionsValueLayer();
  renderLostRecoveryPanel();
  renderTourConversionCoach();
  renderRoomReadinessSla();
}

function renderForecast() {
  const target = $("[data-occupancy-forecast]");
  if (!target) return;
  const f = app.forecast || {};
  target.innerHTML = `
    <div class="forecast-cell"><strong>${f.current ?? 0}</strong><small>Current move-ins</small></div>
    <div class="forecast-cell"><strong>${f.projected30 ?? 0}</strong><small>Projected 30d</small></div>
    <div class="forecast-cell"><strong>${f.projected60 ?? 0}</strong><small>Projected 60d</small></div>
    <div class="forecast-cell weighted"><strong>${f.projected90 ?? 0}</strong><small>Projected 90d</small></div>
    <div class="forecast-cell money"><strong>${formatMoney(f.fill3MonthlyRevenue || f.roomRevenueForecast?.fillThreeMonthlyRevenue || 0)}</strong><small>If top 3 rooms fill</small></div>
    <div class="forecast-cell"><strong>${f.roomRevenueForecast?.openRooms ?? 0}</strong><small>Fillable rooms</small></div>
  `;
  renderRevenueCommand();
}

function renderReferralRoi() {
  const target = $("[data-referral-roi]");
  if (!target) return;
  const rows = app.referrals || [];
  if (!rows.length) { target.innerHTML = empty("No source data yet."); return; }
  target.innerHTML = `
    <div class="referral-row head"><span>Source</span><span class="num">Leads</span><span class="num tours">Room fit</span><span class="num">Quality</span></div>
    ${rows.slice(0, 8).map((r) => `
      <div class="referral-row">
        <span class="src">${escapeHtml(r.source)}<small>${r.moveIns || 0} move-ins / ${r.tours || 0} tours</small></span>
        <span class="num">${r.leads}</span>
        <span class="num tours">${r.roomFitRate ?? 0}%</span>
        <span class="conv">${r.qualityScore ?? r.conversionRate ?? 0}</span>
      </div>
    `).join("")}
  `;
}

function activeNotifications() {
  return (app.scopeControl?.notifications?.active || [])
    .filter((item) => !["resolved", "dismissed"].includes(String(item.status || "").toLowerCase()));
}

function renderNotificationButton() {
  const button = $("[data-notifications]");
  const countNode = $("[data-notification-count]");
  if (!button || !countNode) return;
  const count = activeNotifications().length;
  countNode.textContent = String(count);
  button.classList.toggle("attention", count > 0);
  button.title = count ? `${count} notification${count === 1 ? "" : "s"} need attention` : "No active notifications";
}

function openNotificationCenter() {
  renderNotificationCenter();
  $("[data-notification-modal]")?.showModal();
}

function renderNotificationCenter() {
  const target = $("[data-notification-list]");
  if (!target) return;
  const rows = activeNotifications();
  if (!rows.length) {
    target.innerHTML = empty("No active notifications.");
    iconRefresh();
    return;
  }
  target.innerHTML = rows.slice(0, 30).map((item) => {
    const canUpdate = isUuid(item.id);
    return `
      <article class="notification-item ${escapeHtml(item.severity || "medium")}">
        <div>
          <span>${escapeHtml(item.severity || "medium")}</span>
          <strong>${escapeHtml(item.title || "Notification")}</strong>
          <small>${escapeHtml(item.message || item.source_type || "")}</small>
        </div>
        <div class="notification-actions">
          ${canUpdate ? `
            <button class="ghost" data-notification-action="acknowledge" data-notification-id="${escapeHtml(item.id)}">Ack</button>
            <button data-notification-action="resolve" data-notification-id="${escapeHtml(item.id)}">Done</button>
            <button class="ghost" data-notification-action="dismiss" data-notification-id="${escapeHtml(item.id)}"><i data-lucide="x"></i></button>
          ` : `<button class="ghost" data-refresh-notifications>Refresh</button>`}
        </div>
      </article>
    `;
  }).join("");
  iconRefresh();
}

async function handleNotificationAction(event) {
  const refresh = event.target?.closest?.("[data-refresh-notifications]");
  if (refresh) {
    await loadScopeControl();
    renderNotificationCenter();
    return;
  }
  const button = event.target?.closest?.("[data-notification-action]");
  if (!button) return;
  button.disabled = true;
  try {
    await fetchJson(`/api/v2/scope-control/notifications/${encodeURIComponent(button.dataset.notificationId)}`, {
      method: "PATCH",
      body: { action: button.dataset.notificationAction }
    });
    await loadScopeControl();
    renderNotificationCenter();
    pushToast("Notification updated.", "success");
  } catch (err) {
    pushToast(err.message || "Could not update notification.", "error");
  } finally {
    button.disabled = false;
  }
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function renderScopeControl() {
  const target = $("[data-scope-control]");
  if (!target) return;
  const data = app.scopeControl || {};
  if (data.error) {
    target.innerHTML = `<article class="scope-card"><p class="eyebrow">A-scope controls</p><strong>${escapeHtml(data.error)}</strong></article>`;
    return;
  }
  const comms = data.communications || {};
  const notifications = data.notifications || {};
  const ownership = data.ownership || {};
  const myWork = ownership.myWork || { items: [] };
  const marketing = data.marketing || [];
  const report = data.ownerReport || {};
  const permissions = data.permissions || [];
  const audit = data.audit || {};
  const users = ownership.users || [];
  const assignableItems = buildAssignableScopeItems(data);
  const isAdmin = Boolean(app.user?.isSuperAdmin || ["super_admin", "regional_manager", "location_admin"].includes(app.user?.role));
  target.innerHTML = `
    <header class="scope-control-head">
      <div>
        <p class="eyebrow">Operations Control</p>
        <h2>Work ownership, escalations, reporting</h2>
      </div>
      ${isAdmin ? `<button class="ghost" data-owner-report-export><i data-lucide="download"></i>Owner CSV</button>` : ""}
    </header>
    <div class="scope-primary-grid">
      <article class="scope-card my-work">
        <span>My work today</span>
        <strong>${Number(myWork.overdue || 0)} overdue / ${Number(myWork.dueToday || 0)} today</strong>
        <small>Only work assigned to you. Finish or snooze before escalation.</small>
        ${(myWork.items || []).slice(0, 5).map((item) => `
          <p>
            <b>${escapeHtml(item.status)}</b> ${escapeHtml(item.title || "Assigned work")}
            <small>${item.due_at ? formatDate(item.due_at) : escapeHtml(titleCase(item.type || "work"))}</small>
          </p>
        `).join("") || empty("No assigned work due today.")}
      </article>
      <article class="scope-card alert">
        <span>Escalations</span>
        <strong>${Number(notifications.needsAttention || 0)} need attention</strong>
        <small>Ignored urgent work gets promoted here.</small>
        ${(notifications.active || []).slice(0, 4).map((item) => `<p><b>${escapeHtml(item.severity || "medium")}</b> ${escapeHtml(item.title || "")}<small>${escapeHtml(item.status || "open")}</small></p>`).join("") || empty("No active escalation notifications.")}
      </article>
      <article class="scope-card">
        <span>Ownership</span>
        <strong>${Number(ownership.unassigned || 0)} unassigned</strong>
        <small>${Number(ownership.overdue || 0)} overdue across active work</small>
        <div class="scope-assign-row">
          <select data-scope-assign-item>
            <option value="">Choose work item...</option>
            ${assignableItems.map((item) => `<option value="${escapeHtml(item.type)}:${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("")}
          </select>
          <select data-scope-assign-user>
            <option value="">Owner...</option>
            ${users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name || user.email)}</option>`).join("")}
          </select>
          <button data-scope-assign><i data-lucide="user-check"></i>Assign</button>
        </div>
        ${users.slice(0, 4).map((user) => `<p>${escapeHtml(user.name)}<small>${user.open} open / ${user.overdue} overdue</small></p>`).join("")}
      </article>
    </div>
    <details class="scope-admin-tools"${isAdmin ? " open" : ""}>
      <summary><span>Admin tools</span><small>Reports, marketing, audit, permissions</small></summary>
      <div class="scope-secondary-grid">
        <article class="scope-card compact">
          <span>Email activity</span>
          <strong>${Number(comms.sentCount || 0)} sent / ${Number(comms.inboxCount || 0)} inbox</strong>
          <small>Gmail link lives in App Connections above.</small>
          ${(comms.recentSent || []).slice(0, 2).map((email) => `<p>${escapeHtml(email.subject || "Email")}<small>${escapeHtml(email.recipient_email || "")}</small></p>`).join("") || empty("No sent history yet.")}
        </article>
      <article class="scope-card">
        <span>Marketing ROI loop</span>
        <strong>${escapeHtml(marketing[0]?.source || "No source yet")}</strong>
        <small>${escapeHtml(marketing[0]?.recommendation || "Add source data to generate recommendations.")}</small>
        ${marketing.slice(0, 4).map((row) => `<p>${escapeHtml(row.source)}<small>${row.qualityScore || 0} quality &middot; ${escapeHtml(row.recommendation || "")}</small></p>`).join("")}
      </article>
      <article class="scope-card">
        <span>Owner report</span>
        <strong>${escapeHtml(report.scope || "Assigned locations")}</strong>
        <small>${Number(report.openTasks || 0)} tasks &middot; ${Number(report.openFollowUps || 0)} follow-ups &middot; ${Number(report.activeEvents || 0)} events</small>
        <p>Top source<small>${escapeHtml(report.topMarketingSource || "Not enough data")}</small></p>
      </article>
      <article class="scope-card">
        <span>Permissions</span>
        <strong>${escapeHtml(app.user?.role || "staff")}</strong>
        ${permissions.map((row) => `<p>${escapeHtml(row.area)}<small>${escapeHtml(row.access)} ${row.allowed ? "allowed" : "restricted"}</small></p>`).join("")}
      </article>
      <article class="scope-card audit">
        <span>Sensitive audit</span>
        <strong>${audit.schemaInstalled ? `${(audit.rows || []).length} events` : "SQL needed"}</strong>
        ${(audit.rows || []).slice(0, 4).map((row) => `<p>${escapeHtml(row.action)} ${escapeHtml(row.entity_type)}<small>${escapeHtml(row.profiles?.full_name || row.actor_role || "System")} &middot; ${formatDate(row.created_at)}</small></p>`).join("") || empty(audit.message || "No sensitive actions logged yet.")}
      </article>
      </div>
    </details>
  `;
  iconRefresh();
  renderNotificationButton();
}

function valueLayer() {
  return app.scopeControl?.valueLayer || {};
}

function renderAdmissionsValueLayer() {
  const target = $("[data-value-layer]");
  if (!target) return;
  const value = valueLayer();
  const recovery = value.lostLeadRecovery || {};
  const speed = value.speedToLead || {};
  const tour = value.tourConversionCoach || {};
  const sla = value.roomReadinessSla || {};
  target.innerHTML = `
    <header>
      <div><p class="eyebrow">Value layer</p><h2>Admissions performance levers</h2></div>
      <span>${escapeHtml(speed.label || "Loading")}</span>
    </header>
    <div class="value-layer-grid compact-visual">
      <article>
        <span>Lost recovery</span>
        <strong>${Number(recovery.total || 0)}</strong>
        <meter min="0" max="12" value="${Number(recovery.total || 0)}"></meter>
      </article>
      <article>
        <span>Speed-to-lead</span>
        <strong>${Number(speed.score || 0)}</strong>
        <meter min="0" max="100" value="${Number(speed.score || 0)}"></meter>
      </article>
      <article>
        <span>Tour coach</span>
        <strong>${Number(tour.cards?.length || 0)}</strong>
        <meter min="0" max="10" value="${Number(tour.cards?.length || 0)}"></meter>
      </article>
      <article>
        <span>Room SLA</span>
        <strong>${Number(sla.blockedCount || 0)}</strong>
        <meter min="0" max="10" value="${Number(sla.blockedCount || 0)}"></meter>
      </article>
    </div>
  `;
  iconRefresh();
}

function buildAssignableScopeItems(data = {}) {
  const items = [];
  (data.notifications?.active || []).forEach((item) => {
    if (item.assigned_to || !["task", "follow_up", "operating_plan"].includes(item.source_type)) return;
    items.push({ type: item.source_type, id: item.source_id, label: `${titleCase(item.source_type.replace("_", " "))}: ${item.title}` });
  });
  (app.operations?.tasks || []).filter((item) => !item.assigned_to && !["done", "archived"].includes(String(item.status || ""))).slice(0, 8)
    .forEach((item) => items.push({ type: "task", id: item.id, label: `Task: ${item.title}` }));
  (app.operations?.followUps || []).filter((item) => !item.assigned_to && !["completed", "archived", "missed"].includes(String(item.status || ""))).slice(0, 8)
    .forEach((item) => items.push({ type: "follow_up", id: item.id, label: `Follow-up: ${leadName(item.lead_id) || item.note || "Open follow-up"}` }));
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (!item.id || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

async function handleScopeControlClick(event) {
  const target = event.target?.closest ? event.target : null;
  const assign = target?.closest("[data-scope-assign]");
  const exportReport = target?.closest("[data-owner-report-export]");
  const connectGmail = target?.closest("[data-connect-google-gmail]");
  const pullGmail = target?.closest("[data-pull-google-gmail]");
  const disconnectGmail = target?.closest("[data-disconnect-google-gmail]");
  const connectCalendar = target?.closest("[data-connect-google-calendar]");
  const disconnectCalendar = target?.closest("[data-disconnect-google-calendar]");
  const refreshIntegrations = target?.closest("[data-refresh-integrations]");
  if (connectCalendar || disconnectCalendar || refreshIntegrations) return handleCalendarIntegrationClick(event);
  if (assign) {
    const [type, id] = String($("[data-scope-assign-item]")?.value || "").split(":");
    const assignedTo = $("[data-scope-assign-user]")?.value || "";
    if (!type || !id || !assignedTo) return pushToast("Choose work item and owner.", "error");
    assign.disabled = true;
    try {
      await fetchJson("/api/v2/scope-control/assign", { method: "POST", body: { type, id, assignedTo } });
      pushToast("Work assigned.", "success");
      await refreshAll();
    } catch (err) {
      pushToast(err.message || "Could not assign work.", "error");
    } finally {
      assign.disabled = false;
    }
  }
  if (exportReport) {
    try {
      await downloadOwnerScopeReport();
    } catch (err) {
      pushToast(err.message || "Unable to export owner report.", "error");
    }
  }
  if (connectGmail) {
    try {
      const data = await fetchJson("/api/v2/integrations/google-gmail/connect", { method: "POST" });
      window.open(data.authUrl, "google-gmail-connect", "width=620,height=720");
      pushToast("Gmail connect opened.", "success");
      setTimeout(() => loadScopeControl().catch(() => {}), 2500);
    } catch (err) {
      pushToast(err.message || "Could not start Gmail connection.", "error");
    }
  }
  if (pullGmail) {
    try {
      const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
      const data = await fetchJson(`/api/v2/integrations/google-gmail/pull${query}`, { method: "POST" });
      pushToast(`Pulled ${data.imported || 0} inbox messages.`, "success");
      await loadScopeControl();
    } catch (err) {
      pushToast(err.message || "Could not pull Gmail inbox.", "error");
    }
  }
  if (disconnectGmail) {
    try {
      await fetchJson("/api/v2/integrations/google-gmail/disconnect", { method: "POST" });
      pushToast("Gmail unlinked.", "success");
      await loadScopeControl();
    } catch (err) {
      pushToast(err.message || "Could not unlink Gmail.", "error");
    }
  }
}

async function downloadOwnerScopeReport() {
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  const headers = {};
  if (app.session?.access_token) headers.Authorization = `Bearer ${app.session.access_token}`;
  const response = await fetch(`/api/v2/scope-control/owner-report.csv?${params.toString()}`, { headers });
  if (!response.ok) throw new Error("Unable to export owner report.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "comfort-care-owner-scope-report.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadDashboard() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.dashboard = await fetchJson(`/api/v2/dashboard${query}`);
  markFresh("dashboard");
  renderDashboard();
}

async function loadOperatingPlan() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  try {
    app.operatingPlan = await fetchJson(`/api/v2/operating-plan${query}`);
    markFresh("operatingPlan");
  } catch (err) {
    app.operatingPlan = { items: [], summary: {}, schemaInstalled: false, warning: err.message || "Could not load Daily Operating Plan." };
  }
  renderDailyOperatingPlanHome();
}

async function loadIntelligence() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.intelligence = await fetchJson(`/api/v2/intelligence${query}`);
  markFresh("intelligence");
  renderIntelligence();
}

async function loadLeads(page = app.leadsPagination?.page || 1) {
  const reqId = ++_leadsReqId;
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  const status = $("[data-lead-status-filter]").value;
  const search = $("[data-lead-search]").value.trim();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", "100");
  const data = await fetchJson(`/api/v2/leads?${params.toString()}`);
  if (reqId !== _leadsReqId) return; // stale response — newer request in flight
  app.leads = data.leads || [];
  app.leadsPagination = { page: data.page || 1, pageCount: data.pageCount || 1, total: data.total || 0, limit: data.limit || 100 };
  markFresh("leads");
  renderLeads();
  renderRevenueCommand();
  hydrateOutreachFilters();
  renderOutreachPreview();
  hydrateLeadSelects();
  renderTodayWorkHome();
  renderSystemHealth();
}

async function loadOutreachHistory() {
  const target = $("[data-outreach-history]");
  if (!target) return;
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  if ($("[data-outreach-show-archived]")?.checked) params.set("archived", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await fetchJson(`/api/v2/outreach/history${suffix}`);
  app.outreach.campaigns = data.campaigns || [];
  markFresh("outreachHistory");
  renderOutreachHistory();
}

async function loadOperations() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.operations = await fetchJson(`/api/v2/operations${query}`);
  if (!Array.isArray(app.operations.rooms)) app.operations.rooms = [];
  markFresh("operations");
  renderOperations();
}

async function loadWorkflows() {
  const params = new URLSearchParams({ type: "move_in" });
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  app.workflows = await fetchJson(`/api/v2/workflows?${params.toString()}`);
  markFresh("workflows");
  renderMoveInWorkflows();
}

async function loadEscalations() {
  if (!app.user?.isSuperAdmin) {
    app.escalations = null;
    renderSuperEscalations();
    renderSuperNotificationBell();
    return;
  }
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.escalations = await fetchJson(`/api/v2/escalations${query}`);
  markFresh("escalations");
  renderSuperEscalations();
  renderSuperNotificationBell();
}

async function loadPlacementDesk() {
  const canUse = app.user?.isSuperAdmin || ["super_admin", "regional_manager"].includes(app.user?.role);
  if (!canUse) {
    app.placementDesk = null;
    renderPlacementDesk();
    return;
  }
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.placementDesk = await fetchJson(`/api/v2/placement-desk${query}`);
  markFresh("placementDesk");
  renderPlacementDesk();
}

async function loadRoomIntelligence() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.roomIntelligence = await fetchJson(`/api/v2/rooms/availability${query}`);
  markFresh("roomIntelligence");
  renderRevenueCommand();
}

async function loadRevenueCommand() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.revenueCommand = await fetchJson(`/api/v2/revenue-command${query}`);
  markFresh("revenueCommand");
  renderRevenueCommand();
  renderMissionContextRail();
}

function hydrateLocationSwitcher() {
  const select = $("[data-location-switcher]");
  const canSwitch = app.user?.isSuperAdmin || ["super_admin", "regional_manager"].includes(app.user?.role);
  select.innerHTML = "";
  if (canSwitch) select.append(new Option("All assigned locations", ""));
  app.locations.forEach((location) => select.append(new Option(location.name, location.id)));
  if (!canSwitch && app.locations[0]) app.selectedLocationId = app.locations[0].id;
  select.value = app.selectedLocationId;
  select.disabled = !canSwitch;
  $("[data-role-label]").textContent = `${roleLabel(app.user?.role)}${canSwitch ? " access" : " locked to assigned location"}`;
  $$("[data-super-only]").forEach((item) => item.hidden = !app.user?.isSuperAdmin);
  renderSuperNotificationBell();
  hydrateRoomLocationSelect();
}

function showAuth() {
  $("[data-auth-screen]").hidden = false;
  $("[data-app-shell]").hidden = true;
  setStatus("");
}

function showApp() {
  $("[data-auth-screen]").hidden = true;
  $("[data-app-shell]").hidden = false;
}

function viewFromHash() {
  const view = String(window.location.hash || "").replace(/^#\/?/, "");
  if (!view) return "";
  return $(`[data-panel="${CSS.escape(view)}"]`) ? view : "";
}

function setView(view, options = {}) {
  app.activeView = view;
  // Close overlay sidebar on nav (tablet/mobile)
  if (window.matchMedia("(max-width: 1120px)").matches) {
    $("[data-app-shell]")?.classList.remove("sidebar-open");
  }
  $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
  $("[data-page-title]").textContent = view === "dashboard" ? "Command Center" : titleCase(view.replace("-", " "));
  if (options.updateHash !== false && window.location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  if (view === "users") {
    loadUsers();
    loadIntelligenceRules();
  }
  if (view === "checkins") loadCheckIns();
  if (view === "care-ops") loadCareOpsActiveTab();
  if (view === "outreach") {
    hydrateOutreachFilters();
    renderOutreachPreview();
    loadOutreachHistory().catch((err) => pushToast(err.message || "Could not load outreach history.", "error"));
  }
  if (view === "reports") {
    if (app.dashboard) renderReports();
    else loadDashboard().catch((err) => pushToast(err.message || "Could not load reports.", "error"));
  }
  renderMissionContextRail();
  iconRefresh();
}

function openAppsPanel() {
  setView("tours");
  setTimeout(() => {
    const panel = $("[data-calendar-integration]");
    if (!panel) return;
    panel.scrollIntoView({ block: "center", behavior: "smooth" });
    panel.classList.add("attention");
    setTimeout(() => panel.classList.remove("attention"), 1400);
  }, 80);
}

function renderDashboard() {
  renderTodayWorkHome();
  renderSystemHealth();
  renderDashboardCharts();
  renderReports();
  renderAppConnectionsHome();
  renderAdmissionsValueLayer();
  renderDashboardRoomBoard();
  renderSuperEscalations();
  renderPlacementDesk();
  renderSuperNotificationBell();
  renderDailyOperatingPlanHome();
  renderRevenueCommand();
  renderMissionContextRail();
  const metrics = app.dashboard?.metrics || {};
  const items = [
    ["Total leads", metrics.totalLeads || 0, "leads", null],
    ["Tours scheduled", metrics.toursScheduled || 0, "tours", null],
    ["Move-ins", metrics.moveIns || 0, "leads", "move_in"],
    ["Conversion rate", `${metrics.conversionRate || 0}%`, null, null],
    ["Overdue follow-ups", metrics.overdueFollowUps || 0, "followups", null],
    ["Open tasks", metrics.openTasks || 0, "tasks", null]
  ];
  const metricsEl = $("[data-metrics]");
  metricsEl.innerHTML = items.map(([label, value, view, filter]) => `
    <article class="metric${view ? " metric-link" : ""}" ${view ? `data-metric-nav="${view}" ${filter ? `data-metric-filter="${filter}"` : ""}` : ""} role="${view ? "button" : ""}" tabindex="${view ? "0" : ""}">
      <strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span>
    </article>
  `).join("");
  metricsEl.onclick = (e) => {
    const card = e.target.closest("[data-metric-nav]");
    if (!card) return;
    setView(card.dataset.metricNav);
    if (card.dataset.metricFilter) {
      const filter = $("[data-lead-status-filter]");
      if (filter) { filter.value = card.dataset.metricFilter; loadLeads(); }
    }
  };

  const comparison = app.dashboard?.locationComparison || [];
  $("[data-location-comparison]").innerHTML = comparison.length ? comparison.map((row) => `
    <article class="card">
      <div class="card-head"><strong>${escapeHtml(row.name)}</strong><span class="badge">${row.conversionRate}% conv.</span></div>
      <small>${row.leads} leads &middot; ${row.tours} tours &middot; ${row.moveIns} move-ins &middot; ${row.overdueFollowUps} overdue</small>
    </article>
  `).join("") : empty("No assigned locations yet.");

  renderActivity(app.dashboard?.recentActivity || [], $("[data-recent-activity]"));
  renderReports();
  renderIntelligence();
  renderExecutionSystem();
}

function renderCommandCenterSnapshot() {
  const renderers = [
    renderTodayWorkHome,
    renderSystemHealth,
    renderDashboardCharts,
    renderDashboardRoomBoard,
    renderRevenueCommand,
    renderDailyOperatingPlanHome,
    renderMissionContextRail,
    renderReports
  ];
  renderers.forEach((render) => {
    try { render(); } catch (err) { console.warn("Command Center render skipped:", err?.message || err); }
  });
  iconRefresh();
}

function renderDashboardCharts() {
  const target = $("[data-dashboard-charts]");
  if (!target) return;
  const metrics = app.dashboard?.metrics || {};
  const rooms = app.operations?.rooms || [];
  const value = valueLayer();
  const speed = Number(value.speedToLead?.score || 0);
  const revenue = Number(app.forecast?.fill3MonthlyRevenue || app.forecast?.roomRevenueForecast?.fillThreeMonthlyRevenue || 0);
  const roomCounts = ["available", "reserved", "occupied", "maintenance", "offline"].map((status) => ({
    status,
    count: rooms.filter((room) => roomCurrentStatus(room) === status).length
  }));
  const totalRooms = Math.max(1, roomCounts.reduce((sum, row) => sum + row.count, 0));
  const occupiedPct = Math.round(((roomCounts.find((row) => row.status === "occupied")?.count || 0) / totalRooms) * 100);
  const pipelineRows = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    count: (app.leads || []).filter((lead) => String(lead.status || "").toLowerCase() === col.status).length
  }));
  const maxPipeline = Math.max(1, ...pipelineRows.map((row) => row.count));
  target.innerHTML = `
    <article class="chart-card radial">
      <div class="radial-chart" style="--pct:${occupiedPct}"><strong>${occupiedPct}%</strong></div>
      <span>Occupancy</span>
    </article>
    <article class="chart-card radial">
      <div class="radial-chart speed" style="--pct:${Math.max(0, Math.min(100, speed))}"><strong>${speed}</strong></div>
      <span>Speed</span>
    </article>
    <article class="chart-card bars">
      <header><span>Pipeline</span><strong>${Number(metrics.totalLeads || 0)}</strong></header>
      <div class="mini-bar-chart">
        ${pipelineRows.map((row) => `
          <div>
            <span>${escapeHtml(row.label)}</span>
            <i style="--w:${Math.round((row.count / maxPipeline) * 100)}%"></i>
            <b>${row.count}</b>
          </div>
        `).join("")}
      </div>
    </article>
    <article class="chart-card stack">
      <header><span>Rooms</span><strong>${totalRooms}</strong></header>
      <div class="stack-bar">
        ${roomCounts.map((row) => `<i class="${escapeHtml(row.status)}" style="--w:${Math.max(3, Math.round((row.count / totalRooms) * 100))}%"></i>`).join("")}
      </div>
      <div class="stack-legend">
        ${roomCounts.map((row) => `<span><i class="${escapeHtml(row.status)}"></i>${row.count}</span>`).join("")}
      </div>
    </article>
    <article class="chart-card money">
      <span>Top 3 fill</span>
      <strong>${app.forecast ? formatMoney(revenue) : "—"}</strong>
      <div class="spark-bars"><i></i><i></i><i></i></div>
    </article>
  `;
}

function renderPlacementDesk() {
  const target = $("[data-placement-desk]");
  if (!target) return;
  const canUse = app.user?.isSuperAdmin || ["super_admin", "regional_manager"].includes(app.user?.role);
  if (!canUse) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  const data = app.placementDesk || {};
  const summary = data.summary || {};
  const opportunities = data.opportunities || [];
  const noFit = data.noFitLeads || [];
  const roomGroups = data.availableRoomsByLocation || [];
  target.innerHTML = `
    <header class="placement-desk-head">
      <div>
        <p class="eyebrow">Regional placement desk</p>
        <h2>Cross-location room opportunities</h2>
        <span>Use available inventory across assigned locations before losing high-intent families.</span>
      </div>
      <div class="placement-metrics">
        <article><strong>${summary.crossLocationOpportunities || 0}</strong><span>placement fits</span></article>
        <article><strong>${summary.highIntentNoFit || 0}</strong><span>no-room leads</span></article>
        <article><strong>${summary.availableRooms || 0}</strong><span>available rooms</span></article>
      </div>
    </header>
    <div class="placement-desk-grid">
      <section>
        <div class="mini-head"><strong>Best transfers</strong><span>${opportunities.length}</span></div>
        <div class="placement-list">
          ${opportunities.length ? opportunities.slice(0, 6).map((match) => `
            <article>
              <div>
                <strong>${escapeHtml(match.lead.full_name || "Lead")} -> Room ${escapeHtml(match.room.room_number || "")}</strong>
                <span>${escapeHtml(match.currentLocationName)} to ${escapeHtml(match.suggestedLocationName)}</span>
                <small>${escapeHtml(match.transferReason || match.explanation || "")}</small>
              </div>
              <em>${escapeHtml(match.score)}%</em>
              <button class="ghost" data-reserve-room="${escapeHtml(match.room.id)}" data-lead-id="${escapeHtml(match.lead.id)}"><i data-lucide="bookmark-check"></i>Hold</button>
            </article>
          `).join("") : empty("No cross-location placement opportunities right now.")}
        </div>
      </section>
      <section>
        <div class="mini-head"><strong>No-room hot leads</strong><span>${noFit.length}</span></div>
        <div class="placement-compact-list">
          ${noFit.length ? noFit.slice(0, 6).map((lead) => `
            <button data-intel-open-lead="${escapeHtml(lead.id)}">
              <strong>${escapeHtml(lead.full_name || "Lead")}</strong>
              <span>${escapeHtml(lead.locationName)} &middot; ${escapeHtml(lead.care_type || "Care TBD")}</span>
              <em>${escapeHtml(lead.score)}</em>
            </button>
          `).join("") : empty("No hot leads are blocked by inventory.")}
        </div>
      </section>
      <section>
        <div class="mini-head"><strong>Available inventory</strong><span>${roomGroups.length}</span></div>
        <div class="placement-compact-list">
          ${roomGroups.length ? roomGroups.slice(0, 6).map((group) => `
            <button data-command-location="${escapeHtml(group.locationId)}">
              <strong>${escapeHtml(group.name)}</strong>
              <span>${escapeHtml(group.availableRooms)} rooms &middot; ${formatMoney(group.monthlyRevenue)} risk</span>
            </button>
          `).join("") : empty("No available rooms across assigned scope.")}
        </div>
      </section>
    </div>
  `;
  iconRefresh();
}

function renderSuperEscalations() {
  const target = $("[data-super-escalations]");
  if (!target) return;
  if (!app.user?.isSuperAdmin) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  const data = app.escalations || {};
  const summary = data.summary || {};
  const locations = data.locations || [];
  const planItems = data.planItems || [];
  const workflows = data.workflows || [];
  target.innerHTML = `
    <header class="super-escalation-head">
      <div>
        <p class="eyebrow">Super Admin escalation desk</p>
        <h2>Locations needing intervention</h2>
        <span>${escapeHtml(data.warning || "Ignored work, escalated plan items, and blocked move-in workflows.")}</span>
      </div>
      <div class="super-escalation-metrics">
        <article><strong>${summary.locationsAtRisk || 0}</strong><span>locations</span></article>
        <article><strong>${summary.escalatedPlanItems || 0}</strong><span>escalated</span></article>
        <article><strong>${summary.blockedWorkflows || 0}</strong><span>blocked workflows</span></article>
      </div>
    </header>
    <div class="super-escalation-grid">
      <section>
        <div class="mini-head"><strong>Location risk</strong><button class="ghost" data-refresh><i data-lucide="refresh-cw"></i>Refresh</button></div>
        <div class="super-location-list">
          ${locations.length ? locations.slice(0, 8).map((row) => `
            <button class="super-location-risk" data-command-location="${escapeHtml(row.locationId)}">
              <strong>${escapeHtml(row.name)}</strong>
              <span>${row.escalatedPlanItems} escalated / ${row.overduePlanItems} overdue / ${row.blockedWorkflows} blocked</span>
              <em>${row.riskScore}</em>
            </button>
          `).join("") : empty("No escalated location risk right now.")}
        </div>
      </section>
      <section>
        <div class="mini-head"><strong>Escalated work</strong><span>${planItems.length}</span></div>
        <div class="super-work-list">
          ${planItems.length ? planItems.slice(0, 6).map((item) => `
            <article>
              <strong>${escapeHtml(item.title || "Escalated item")}</strong>
              <span>${escapeHtml(locationName(item.location_id))} &middot; ${escapeHtml(item.department || "operations")} &middot; ${escapeHtml(item.status || "open")}</span>
              <small>${escapeHtml(item.impact || item.reason || "")}</small>
            </article>
          `).join("") : empty("No escalated Daily Operating Plan items.")}
        </div>
      </section>
      <section>
        <div class="mini-head"><strong>Blocked workflows</strong><span>${workflows.length}</span></div>
        <div class="super-work-list">
          ${workflows.length ? workflows.slice(0, 6).map((workflow) => `
            <article>
              <strong>${escapeHtml(workflow.title || "Blocked workflow")}</strong>
              <span>${escapeHtml(locationName(workflow.location_id))} &middot; ${escapeHtml(workflow.status || "active")}</span>
              <small>${workflow.due_at ? `Due ${escapeHtml(formatShortDate(workflow.due_at))}` : "No due date set"}</small>
            </article>
          `).join("") : empty("No blocked move-in workflows.")}
        </div>
      </section>
    </div>
  `;
  iconRefresh();
}

function renderSuperNotificationBell() {
  const button = $("[data-super-notifications]");
  if (!button) return;
  if (!app.user?.isSuperAdmin) {
    button.hidden = true;
    return;
  }
  const summary = app.escalations?.summary || {};
  const count = Number(summary.escalatedPlanItems || 0) + Number(summary.blockedWorkflows || 0) + Number(summary.overduePlanItems || 0);
  button.hidden = false;
  button.classList.toggle("attention", count > 0);
  button.title = count > 0
    ? `${count} escalation${count === 1 ? "" : "s"} need Super Admin review`
    : "No Super Admin escalations";
  const span = button.querySelector("span");
  if (span) span.textContent = String(count);
}

function renderMissionContextRail() {
  const target = $("[data-mission-context]");
  if (!target) return;
  const model = buildRevenueCommandModel();
  const planSummary = app.operatingPlan?.summary || {};
  const rooms = app.operations?.rooms || [];
  const now = Date.now();
  const overdueFollowUps = (app.operations?.followUps || []).filter((item) => {
    const due = safeTime(item.due_at);
    return due && due < now && !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase());
  }).length;
  const roomCounts = {
    occupied: rooms.filter((room) => roomCurrentStatus(room) === "occupied").length,
    reserved: rooms.filter((room) => roomCurrentStatus(room) === "reserved").length,
    blocked: rooms.filter((room) => ["maintenance", "offline"].includes(roomCurrentStatus(room))).length
  };
  const scope = app.selectedLocationId ? locationName(app.selectedLocationId) : "All assigned locations";
  const mode = app.activeView === "dashboard" ? "Command Center" : titleCase(app.activeView.replace("-", " "));
  const critical = Number(planSummary.critical || 0) + Number(planSummary.high || 0);
  const cards = [
    {
      view: "dashboard",
      icon: "radar",
      label: "Operating mode",
      value: mode,
      detail: `${scope} scope`,
      tone: "mode"
    },
    {
      view: "rooms",
      icon: "door-open",
      label: "Room inventory",
      value: `${model.openRooms} available`,
      detail: `${roomCounts.occupied} occupied / ${roomCounts.reserved} reserved / ${roomCounts.blocked} blocked`,
      tone: model.openRooms ? "good" : "watch"
    },
    {
      view: "leads",
      icon: "users",
      label: "Admissions demand",
      value: `${model.hotLeadCount} hot leads`,
      detail: `${model.activeLeadCount} active families in pipeline`,
      tone: model.hotLeadCount ? "good" : "quiet"
    },
    {
      view: "followups",
      icon: "bell-ring",
      label: "Coordination debt",
      value: `${overdueFollowUps} overdue`,
      detail: `${critical} high-priority plan items`,
      tone: overdueFollowUps || critical ? "risk" : "good"
    },
    {
      view: "rooms",
      icon: "circle-dollar-sign",
      label: "Vacancy pressure",
      value: formatMoney(model.lostRevenue),
      detail: "estimated monthly vacant room risk",
      tone: model.lostRevenue ? "risk" : "quiet"
    }
  ];
  target.innerHTML = cards.map((card) => `
    <button class="mission-context-card ${card.tone}${card.view === app.activeView ? " active" : ""}" data-view="${escapeHtml(card.view)}">
      <i data-lucide="${escapeHtml(card.icon)}"></i>
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.detail)}</small>
    </button>
  `).join("");
  iconRefresh();
}

function renderDailyOperatingPlanHome() {
  const target = $("[data-operating-plan]");
  if (!target) return;
  const plan = app.operatingPlan || {};
  const items = plan.items || [];
  const summary = plan.summary || {};
  const primary = items[0] || null;
  const metrics = app.dashboard?.metrics || {};
  const planLine = primary?.reason || "No urgent daily plan item is waiting. Keep leads, rooms, and staff work current.";
  const queueItems = items.slice(0, 7);
  const activeItem = primary;
  const openCount = summary.total || items.length || 0;
  const criticalCount = summary.critical || 0;
  const highCount = summary.high || 0;
  const stateLabel = criticalCount ? "Needs intervention" : highCount ? "Due now" : openCount ? "Scheduled" : "Clear";
  target.innerHTML = `
    <section class="command-vision">
      <header class="command-vision-hero compact">
        <div class="command-vision-copy">
          <p class="eyebrow">Command Center</p>
          <h2>Daily operating queue</h2>
          <strong>${escapeHtml(openCount ? `${openCount} active item${openCount === 1 ? "" : "s"}` : "Operations calm")} &middot; ${escapeHtml(stateLabel)}</strong>
          <span>${escapeHtml(planLine)}</span>
        </div>
        <div class="command-status-strip">
          <article><span>Open</span><strong>${openCount}</strong><small>${summary.escalated || 0} escalated</small></article>
          <article><span>Move-ins</span><strong>${metrics.moveIns || 0}</strong><small>${metrics.conversionRate || 0}% conversion</small></article>
          <article><span>Occupancy</span><strong>${app.roomIntelligence?.occupancyRate ?? "--"}%</strong><small>${app.roomIntelligence?.counts?.available ?? 0} available</small></article>
          <article><span>Follow-ups</span><strong>${metrics.overdueFollowUps || 0}</strong><small>overdue</small></article>
        </div>
      </header>
      ${plan.warning ? `<p class="helper-text plan-warning">${escapeHtml(plan.warning)}</p>` : ""}
      <div class="command-vision-grid">
        <section class="live-ops-panel">
          <div class="vision-panel-head">
            <span>Operating Plan Queue</span>
            <button class="ghost icon-only" data-refresh aria-label="Refresh"><i data-lucide="refresh-cw"></i></button>
          </div>
          <div class="live-ops-list">
            ${queueItems.length ? queueItems.map((item, index) => renderLiveOperatingRow(item, { active: index === 0 })).join("") : empty("Operational calm. Monitoring follow-ups, tours, rooms, and workflow blockers.")}
          </div>
        </section>
        <aside class="today-priority-panel active-case-pane">
          <div class="vision-panel-head">
            <span>Active Case Pane</span>
            <strong>${activeItem ? escapeHtml(priorityUxLabel(activeItem.priority || "medium")) : "Clear"}</strong>
          </div>
          ${app.operatingOutcome ? renderOperatingOutcome(activeItem) : activeItem ? renderActiveOperatingCase(activeItem) : renderCalmOperatingCase()}
        </aside>
      </div>
    </section>
  `;
  iconRefresh();
}

function renderLiveOperatingRow(item = {}, options = {}) {
  const time = item.due_at ? formatTime(item.due_at) : "--";
  return `
    <article class="live-op-row ${options.active ? "active" : ""} ${escapeHtml(item.priority || "medium")}">
      <span class="live-op-dot"></span>
      <time>${escapeHtml(time)}</time>
      <div>
        <strong>${escapeHtml(item.title || "Plan item")}</strong>
        <small>${escapeHtml(item.reason || item.impact || "")}</small>
      </div>
      <span class="queue-next-action">${escapeHtml(item.recommended_action || "Review")}</span>
    </article>
  `;
}

function renderActiveOperatingCase(item = {}) {
  const meta = item.metadata || {};
  return `
    <div class="active-operating-case">
      <span class="case-pill">${escapeHtml(titleCase(item.department || "Operations"))}</span>
      <h3>${escapeHtml(item.title || "Operating plan item")}</h3>
      <p>${escapeHtml(item.impact || item.reason || "This item affects admissions momentum.")}</p>
      <div class="ai-operator-card inline">
        <div>
          <p class="eyebrow">AI Operator</p>
          <strong>${escapeHtml(item.recommended_action || "Review this item and confirm next owner.")}</strong>
          <small>Explanation only. Backend rules approve saved actions.</small>
        </div>
      </div>
      <div class="operator-actions primary-only">
        ${meta.leadId ? `<button data-operating-open-lead="${escapeHtml(meta.leadId)}"><i data-lucide="folder-open"></i>Open lead</button>` : ""}
        ${meta.roomId ? `<button class="ghost" data-view="rooms"><i data-lucide="door-open"></i>Open Room Board</button>` : ""}
        ${item.schema_fallback !== true && app.operatingPlan?.schemaInstalled !== false ? `<button class="ghost" data-operating-action="${escapeHtml(item.id)}" data-action="complete"><i data-lucide="check"></i>Mark done</button>` : ""}
      </div>
      ${renderInlineAssignment(item)}
    </div>
  `;
}

function renderCalmOperatingCase() {
  return `
    <div class="active-operating-case calm">
      <span class="case-pill">Monitoring</span>
      <h3>Operations calm</h3>
      <p>No forced action is waiting. Next scan checks follow-ups, tours, and room readiness.</p>
      <div class="calm-signal-list">
        <span>Follow-ups current</span>
        <span>Tours prepared</span>
        <span>Rooms monitored</span>
      </div>
      <div class="ai-operator-card inline">
        <div>
          <p class="eyebrow">AI Operator</p>
          <strong>No recommendation until deterministic rules surface work.</strong>
        </div>
      </div>
    </div>
  `;
}

function renderOperatingOutcome(nextItem = null) {
  const outcome = app.operatingOutcome || {};
  return `
    <div class="active-operating-case outcome">
      <span class="case-pill">Completed</span>
      <h3>${escapeHtml(outcome.title || "Operating plan item")}</h3>
      <p>${escapeHtml(outcome.action === "snooze" ? "Item snoozed. Queue recalculated against current operational state." : outcome.action === "assign" ? "Owner assignment started. Queue recalculated against current operational state." : "Item completed. Queue recalculated against current operational state.")}</p>
      <div class="outcome-next">
        <span>Next item</span>
        <strong>${escapeHtml(outcome.nextTitle || nextItem?.title || "No forced action waiting")}</strong>
      </div>
      <div class="operator-actions primary-only">
        <button class="ghost" data-clear-operating-outcome><i data-lucide="arrow-right"></i>Continue</button>
        ${nextItem ? `<button data-operating-action="${escapeHtml(nextItem.id)}" data-action="complete"><i data-lucide="check"></i>Mark next done</button>` : ""}
        <button class="ghost" data-operating-action="${escapeHtml(outcome.id || "")}" data-action="reopen" ${outcome.id ? "" : "disabled"}><i data-lucide="rotate-ccw"></i>Reopen</button>
      </div>
    </div>
  `;
}

function renderInlineAssignment(item = {}) {
  if (item.schema_fallback === true || app.operatingPlan?.schemaInstalled === false) return "";
  return `
    <div class="inline-assignment-panel" data-assignment-for="${escapeHtml(item.id)}">
      <div>
        <span>Assign owner</span>
        <strong>Work Queue first, named user when available</strong>
      </div>
      <div class="inline-assignment-grid">
        <select aria-label="Owner queue" data-assignment-owner>
          <option value="admissions">Admissions queue</option>
          <option value="housekeeping">Housekeeping queue</option>
          <option value="maintenance">Maintenance queue</option>
          <option value="marketing">Marketing queue</option>
        </select>
        <input type="datetime-local" aria-label="Due time" data-assignment-due>
        <button class="ghost" data-operating-action="${escapeHtml(item.id)}" data-action="assign"><i data-lucide="user-check"></i>Assign</button>
      </div>
    </div>
  `;
}

function priorityUxLabel(priority = "") {
  const value = String(priority || "").toLowerCase();
  if (value === "critical") return "Needs intervention";
  if (value === "high") return "Due now";
  if (value === "low") return "Watch";
  return "Scheduled";
}

function renderOperatingPlanItem(item = {}, options = {}) {
  const meta = item.metadata || {};
  const due = item.due_at ? formatDate(item.due_at) : "No due time";
  return `
    <article class="operating-plan-item ${options.active ? "active" : ""} ${escapeHtml(item.priority || "medium")}">
      <div class="operating-plan-status"><span></span></div>
      <div class="operating-plan-main">
        <span>${escapeHtml(titleCase(item.department || "admin"))} &middot; ${escapeHtml(due)}</span>
        <strong>${escapeHtml(item.title || "Plan item")}</strong>
        <p>${escapeHtml(item.impact || item.reason || "")}</p>
      </div>
      ${renderOperatingPlanActions(item)}
    </article>
  `;
}

function renderOperatingPlanActions(item = {}) {
  const meta = item.metadata || {};
  const leadAction = meta.leadId ? `<button class="ghost" data-operating-open-lead="${escapeHtml(meta.leadId)}"><i data-lucide="folder-open"></i>Open lead</button>` : "";
  const roomAction = meta.roomId ? `<button class="ghost" data-view="rooms"><i data-lucide="door-open"></i>Rooms</button>` : "";
  const canPatch = item.schema_fallback !== true && app.operatingPlan?.schemaInstalled !== false;
  return `
    <div class="operating-plan-actions">
      ${leadAction}
      ${roomAction}
      ${canPatch ? `<button data-operating-action="${escapeHtml(item.id)}" data-action="complete"><i data-lucide="check"></i>Done</button>` : ""}
      ${canPatch ? `<button class="ghost" data-operating-action="${escapeHtml(item.id)}" data-action="snooze"><i data-lucide="clock-3"></i>Snooze</button>` : ""}
      ${canPatch ? `<button class="ghost" data-operating-action="${escapeHtml(item.id)}" data-action="assign"><i data-lucide="user-check"></i>Assign</button>` : ""}
    </div>
  `;
}

function renderRevenueCommand() {
  const target = $("[data-revenue-command]");
  if (!target) return;
  const model = buildRevenueCommandModel();
  const opportunities = model.opportunities.slice(0, 4);
  const primaryOpportunity = opportunities[0] || null;
  const primaryMatch = !primaryOpportunity && model.roomMatches.length ? model.roomMatches[0] : null;
  const primarySignal = !primaryOpportunity && !primaryMatch && model.roomSignals.length ? model.roomSignals[0] : null;
  const activeTitle = primaryOpportunity
    ? primaryOpportunity.lead.full_name || "Unnamed lead"
    : primaryMatch
      ? `${primaryMatch.lead.full_name || "Matched lead"} fits Room ${primaryMatch.room.room_number || ""}`.trim()
      : primarySignal
        ? primarySignal.title
        : "Admissions is stable";
  const activeMeta = primaryOpportunity
    ? `${primaryOpportunity.probability}% move-in probability`
    : primaryMatch
      ? `${primaryMatch.score}% room fit`
      : primarySignal
        ? titleCase(primarySignal.severity || "signal")
        : "No urgent exception";
  const activeDetail = primaryOpportunity
    ? revenueOpportunityDetail(primaryOpportunity)
    : primaryMatch
      ? primaryMatch.explanation
      : primarySignal
        ? primarySignal.detail
        : "No urgent admissions action is visible in the current location scope.";
  const activeAction = primaryOpportunity
    ? `<button class="primary mission-action" data-revenue-lead="${escapeHtml(primaryOpportunity.lead.id)}"><i data-lucide="folder-open"></i>Open lead</button>`
    : primaryMatch
      ? `<button class="primary mission-action" data-revenue-lead="${escapeHtml(primaryMatch.lead.id)}"><i data-lucide="folder-open"></i>Open match</button>`
      : `<button class="primary mission-action" data-view="rooms"><i data-lucide="door-open"></i>Review rooms</button>`;
  const nextSteps = [
    primaryOpportunity ? `Resolve: ${revenueOpportunityDetail(primaryOpportunity)}` : "Confirm room inventory is current",
    model.openRooms ? "Match available rooms to ready families" : "Clear reserved, maintenance, or offline room blockers",
    model.blockerCount ? "Work the oldest blocker before opening new pipeline" : "Keep follow-up rhythm current"
  ];
  target.innerHTML = `
    <section class="revenue-command-shell">
      <header class="revenue-command-topline">
        <div class="revenue-command-copy">
          <p class="eyebrow">Revenue Command</p>
          <h2>Admissions mission control</h2>
          <p>${escapeHtml(model.summary)}</p>
        </div>
        <div class="revenue-pressure">
          <span>Monthly risk</span>
          <strong>${formatMoney(model.revenueAtRisk + model.lostRevenue)}</strong>
          <small>${model.blockerCount} blockers &middot; ${model.openRooms} ready rooms</small>
        </div>
      </header>
      <div class="revenue-mission-grid">
        <aside class="revenue-panel revenue-queue-panel">
          <div class="panel-head compact">
            <div><p class="eyebrow">Work queue</p><h2>Move-in actions</h2></div>
            <span class="execution-badge">${model.hotLeadCount} hot</span>
          </div>
          <div class="revenue-opportunity-list compact">
            ${opportunities.length ? opportunities.map(renderRevenueOpportunity).join("") : empty("No active opportunities in scope.")}
          </div>
          <div class="revenue-blocker-list compact">
            ${model.blockers.map((item) => `
              <button class="revenue-blocker" data-view="${escapeHtml(item.view)}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.count)}</strong>
              </button>
            `).join("")}
          </div>
        </aside>
        <article class="revenue-panel revenue-active-panel">
          <div class="mission-case-top">
            <div>
              <p class="eyebrow">Do next</p>
              <h2>${escapeHtml(activeTitle)}</h2>
              <span>${escapeHtml(activeMeta)}</span>
            </div>
            ${activeAction}
          </div>
          <p class="mission-case-detail">${escapeHtml(activeDetail)}</p>
          <div class="mission-impact-grid">
            <article><strong>${formatMoney(model.weightedPipeline)}</strong><span>Weighted pipeline</span></article>
            <article><strong>${model.occupancyRate}%</strong><span>Occupancy</span></article>
            <article><strong>${formatMoney(model.lostRevenue)}</strong><span>Vacant room risk</span></article>
            <article><strong>${formatMoney(model.estimatedMonthlyRevenue)}</strong><span>Monthly run rate</span></article>
          </div>
          <div class="mission-step-list">
            ${nextSteps.map((step, index) => `
              <article>
                <span>${index + 1}</span>
                <p>${escapeHtml(step)}</p>
              </article>
            `).join("")}
          </div>
        </article>
        <aside class="revenue-panel revenue-context-panel">
          <div class="panel-head compact">
            <div><p class="eyebrow">Inventory context</p><h2>Rooms and revenue</h2></div>
            <button class="ghost icon-only" data-view="rooms" aria-label="Open rooms"><i data-lucide="door-open"></i></button>
          </div>
          <div class="mission-room-summary">
            <article><strong>${model.openRooms}</strong><span>Available</span></article>
            <article><strong>${model.roomMatches.length}</strong><span>Matches</span></article>
            <article><strong>${model.roomSignals.length}</strong><span>Signals</span></article>
          </div>
          <div class="revenue-room-line">
            <strong>${model.openRooms}</strong>
            <span>${escapeHtml(model.roomMessage)}</span>
          </div>
          <div class="room-match-list">
            ${model.roomMatches.length ? model.roomMatches.slice(0, 3).map(renderRoomMatch).join("") : empty("Add room budget/care data to generate matches.")}
          </div>
          <div class="room-signal-list">
            ${model.roomSignals.length ? model.roomSignals.slice(0, 3).map((signal) => `
              <article class="room-signal ${escapeHtml(signal.severity)}">
                <strong>${escapeHtml(signal.title)}</strong>
                <span>${escapeHtml(signal.detail)}</span>
              </article>
            `).join("") : empty("No room-specific signals yet.")}
          </div>
        </aside>
      </div>
    </section>
  `;
  $$("[data-revenue-lead]", target).forEach((button) => {
    button.addEventListener("click", () => openLeadDetail(button.dataset.revenueLead));
  });
  $$("[data-view]", target).forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  iconRefresh();
}

let _revModelCache = null;
let _revModelFingerprint = null;

function buildRevenueCommandModel() {
  if (app.revenueCommand?.source === "backend") {
    const model = app.revenueCommand;
    return {
      activeLeadCount: Number(model.activeLeadCount || 0),
      blockerCount: Number(model.blockerCount || 0),
      hotLeadCount: Number(model.hotLeadCount || 0),
      openRooms: Number(model.openRooms || 0),
      opportunities: Array.isArray(model.opportunities) ? model.opportunities : [],
      projected90: app.forecast?.projected90 ?? 0,
      occupancyRate: Number(model.occupancyRate || 0),
      estimatedMonthlyRevenue: Number(model.estimatedMonthlyRevenue || 0),
      lostRevenue: Number(model.lostRevenue || 0),
      nearTermRevenueOpportunity: Number(model.nearTermRevenueOpportunity || 0),
      revenueAtRisk: Number(model.revenueAtRisk || 0),
      roomMatches: Array.isArray(model.roomMatches) ? model.roomMatches : [],
      roomSignals: Array.isArray(model.roomSignals) ? model.roomSignals : [],
      weightedPipeline: Number(model.weightedPipeline || 0),
      summary: model.summary || "Revenue Command is using backend operational intelligence.",
      roomMessage: model.roomMessage || "Room inventory is current.",
      blockers: Array.isArray(model.blockers) ? model.blockers : []
    };
  }
  // Memoize expensive client-side computation
  const fp = [
    (app.leads || []).map((l) => l.id + l.status + l.updated_at).join(),
    (app.operations?.followUps || []).map((f) => f.id + f.status + f.due_at).join(),
    (app.operations?.tours || []).map((t) => t.id + t.status + t.scheduled_at).join(),
    (app.operations?.rooms || []).map((r) => r.id + r.status + r.monthly_rate).join(),
    String(app.selectedLocationId)
  ].join("|");
  if (_revModelCache && _revModelFingerprint === fp) return _revModelCache;
  const now = Date.now();
  const leads = (app.leads || []).filter((lead) => !["archived", "move_in"].includes(String(lead.status || "").toLowerCase()));
  const followUps = (app.operations?.followUps || []).filter((item) => !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase()));
  const tours = (app.operations?.tours || []).filter((tour) => !INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase()));
  const tasks = (app.operations?.tasks || []).filter((task) => !["done", "archived", "completed"].includes(String(task.status || "").toLowerCase()));
  const rooms = typeof buildRoomOccupancy === "function" ? buildRoomOccupancy() : [];
  const backend = app.roomIntelligence || {};
  let openRooms = rooms.filter((room) => !room.activeResident && !room.needsTurnover && !["reserved", "occupied"].includes(room.inventoryStatus || "")).length;
  const reservedRooms = rooms.filter((room) => room.inventoryStatus === "reserved").length;
  const occupiedRooms = rooms.filter((room) => room.inventoryStatus === "occupied" || room.activeResident).length;
  const revenueRooms = (app.operations?.rooms || []).filter((room) => roomCurrentStatus(room) !== "offline");
  let estimatedMonthlyRevenue = revenueRooms
    .filter((room) => roomCurrentStatus(room) === "occupied")
    .reduce((sum, room) => sum + (Number(room.monthly_rate) || AVG_MONTHLY_REVENUE), 0);
  let lostRevenue = revenueRooms
    .filter((room) => roomCurrentStatus(room) === "available")
    .reduce((sum, room) => sum + (Number(room.monthly_rate) || AVG_MONTHLY_REVENUE), 0);
  const overdueFollowUps = followUps.filter((item) => safeTime(item.due_at) && safeTime(item.due_at) < now);
  const overdueTasks = tasks.filter((task) => safeTime(task.due_at) && safeTime(task.due_at) < now);
  const upcomingTours = tours.filter((tour) => {
    const time = safeTime(tour.scheduled_at);
    return time && time >= now && time <= now + 7 * 24 * 3600000;
  });
  const scored = leads.map((lead) => {
    const leadFollowUps = followUps.filter((item) => item.lead_id === lead.id);
    const leadTours = tours.filter((tour) => tour.lead_id === lead.id);
    const overdue = leadFollowUps.some((item) => safeTime(item.due_at) && safeTime(item.due_at) < now);
    const nextTour = leadTours
      .filter((tour) => safeTime(tour.scheduled_at) && safeTime(tour.scheduled_at) >= now)
      .sort((a, b) => safeTime(a.scheduled_at) - safeTime(b.scheduled_at))[0];
    const score = estimateClientLeadScore(lead);
    const staleDays = daysSince(lead.updated_at || lead.created_at);
    const probability = estimateMoveInProbability(lead, score, { overdue, nextTour, staleDays });
    const blocker = revenueLeadBlocker(lead, { overdue, nextTour, staleDays });
    return { lead, score, probability, blocker, nextTour, staleDays };
  }).sort((a, b) => b.probability - a.probability || b.score - a.score);
  const opportunities = scored.filter((item) => item.probability >= 40 || item.blocker).slice(0, 8);
  if (backend.counts) openRooms = Number(backend.counts.available || 0);
  if (Number.isFinite(Number(backend.estimatedMonthlyRevenue))) estimatedMonthlyRevenue = Number(backend.estimatedMonthlyRevenue);
  if (Number.isFinite(Number(backend.lostRevenue))) lostRevenue = Number(backend.lostRevenue);
  const roomMatches = (backend.matches?.length ? backend.matches : buildRoomMatches(app.operations?.rooms || [], leads)).slice(0, 5);
  const roomSignals = (backend.signals?.length ? backend.signals : buildRoomSignals(app.operations?.rooms || [], leads, roomMatches, { openRooms, occupiedRooms, reservedRooms, lostRevenue })).slice(0, 6);
  const hotLeadCount = scored.filter((item) => item.probability >= 55).length;
  const revenueAtRisk = opportunities.filter((item) => item.blocker).length * AVG_MONTHLY_REVENUE;
  const weightedPipeline = scored.reduce((sum, item) => sum + (AVG_MONTHLY_REVENUE * item.probability / 100), 0);
  const blockerCount = overdueFollowUps.length + overdueTasks.length + scored.filter((item) => item.blocker === "Needs contact").length;
  const result = {
    activeLeadCount: leads.length,
    blockerCount,
    hotLeadCount,
    openRooms,
    opportunities,
    projected90: app.forecast?.projected90 ?? 0,
    occupancyRate: Number.isFinite(Number(backend.occupancyRate)) ? Number(backend.occupancyRate) : revenueRooms.length ? Math.round((occupiedRooms / revenueRooms.length) * 100) : 0,
    estimatedMonthlyRevenue,
    lostRevenue,
    revenueAtRisk,
    roomMatches,
    roomSignals,
    weightedPipeline,
    summary: leads.length
      ? `${hotLeadCount} families look movable now; ${overdueFollowUps.length} follow-ups, ${upcomingTours.length} tours, and ${reservedRooms} reserved rooms need tight execution.`
      : "No active pipeline is loaded for the selected scope.",
    roomMessage: openRooms
      ? `${formatMoney(lostRevenue)} in monthly room revenue is open for conversion.`
      : "No available ready room is visible; check reserved rooms and turnover before committing move-in dates.",
    blockers: [
      { label: "Overdue follow-ups", count: overdueFollowUps.length, view: "followups" },
      { label: "Tours this week", count: upcomingTours.length, view: "tours" },
      { label: "Overdue tasks", count: overdueTasks.length, view: "tasks" },
      { label: "Stale hot leads", count: scored.filter((item) => item.probability >= 55 && item.staleDays >= 7).length, view: "leads" }
    ]
  };
  _revModelCache = result;
  _revModelFingerprint = fp;
  return result;
}

function renderRevenueOpportunity(item) {
  const { lead, probability, blocker, nextTour, staleDays } = item;
  return `
    <article class="revenue-opportunity">
      <div>
        <strong>${escapeHtml(lead.full_name || "Unnamed lead")}</strong>
        <small>${escapeHtml(locationName(lead.location_id))} &middot; ${escapeHtml(titleCase(String(lead.status || "new").replaceAll("_", " ")))}</small>
      </div>
      <span class="revenue-probability">${probability}%</span>
      <p>${escapeHtml(revenueOpportunityDetail({ blocker, nextTour, staleDays }))}</p>
      <button class="ghost" data-revenue-lead="${escapeHtml(lead.id)}"><i data-lucide="folder-open"></i>Open</button>
    </article>
  `;
}

function buildRoomMatches(rooms = [], leads = []) {
  const activeLeads = leads.filter((lead) => !["archived", "move_in"].includes(String(lead.status || "").toLowerCase()));
  return rooms
    .filter((room) => roomCurrentStatus(room) === "available")
    .flatMap((room) => activeLeads.map((lead) => scoreRoomLeadMatch(room, lead)))
    .filter((match) => match.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function scoreRoomLeadMatch(room, lead) {
  let score = 0;
  const reasons = [];
  if (room.location_id === lead.location_id) {
    score += 30;
    reasons.push("same location");
  }
  const care = normalizeMatchText(lead.care_type || lead.careLevel || "");
  const roomCare = normalizeMatchText(room.care_level_supported || room.care_level || "");
  if (!roomCare || !care || roomCare.includes(care) || care.includes(roomCare)) {
    score += 25;
    reasons.push("care type fits");
  }
  const budget = inferLeadBudget(lead);
  const min = Number(room.budget_min || 0);
  const max = Number(room.budget_max || room.monthly_rate || 0);
  const rate = Number(room.monthly_rate || 0);
  if (!budget || (!min && !max && !rate) || (budget >= (min || 0) && budget <= (max || rate || budget))) {
    score += 20;
    reasons.push("budget range fits");
  }
  const timeline = normalizeMatchText(lead.move_timeline || "");
  if (timeline.includes("asap") || timeline.includes("immediate") || timeline.includes("30")) {
    score += 15;
    reasons.push("near-term move-in");
  }
  if (estimateClientLeadScore(lead) >= 55) {
    score += 10;
    reasons.push("high intent");
  }
  return {
    room,
    lead,
    score: Math.min(100, score),
    reasons,
    explanation: `${lead.full_name || "This lead"} fits Room ${room.room_number || ""} because ${reasons.slice(0, 3).join(", ")}.`
  };
}

function renderRoomMatch(match) {
  return `
    <article class="room-match">
      <div>
        <strong>Room ${escapeHtml(match.room.room_number || "")} -> ${escapeHtml(match.lead.full_name || "Unnamed lead")}</strong>
        <small>${escapeHtml(match.explanation)}</small>
      </div>
      <span>${match.score}%</span>
      <button class="ghost" data-reserve-room="${escapeHtml(match.room.id)}" data-lead-id="${escapeHtml(match.lead.id)}"><i data-lucide="bookmark-check"></i>Hold</button>
    </article>
  `;
}

function buildRoomSignals(rooms = [], leads = [], matches = [], metrics = {}) {
  const signals = [];
  const available = rooms.filter((room) => roomCurrentStatus(room) === "available");
  const maintenance = rooms.filter((room) => ["maintenance", "offline"].includes(roomCurrentStatus(room)) || ["maintenance", "damaged"].includes(String(room.condition || "")));
  const reserved = rooms.filter((room) => roomCurrentStatus(room) === "reserved");
  const highIntent = leads.filter((lead) => estimateClientLeadScore(lead) >= 55);
  available.forEach((room) => {
    if (!matches.some((match) => match.room.id === room.id)) {
      signals.push({ severity: "medium", title: `Room ${room.room_number} has no matching lead`, detail: "Create or source demand for this available room." });
    }
  });
  highIntent.forEach((lead) => {
    if (!matches.some((match) => match.lead.id === lead.id)) {
      signals.push({ severity: "high", title: `${lead.full_name} has no compatible room`, detail: "Review care level, budget, or alternate locations." });
    }
  });
  if (metrics.lostRevenue > 0) signals.push({ severity: "high", title: "Vacant room revenue risk", detail: `${formatMoney(metrics.lostRevenue)} estimated monthly revenue is vacant.` });
  reserved.forEach((room) => signals.push({ severity: "medium", title: `Room ${room.room_number} reserved`, detail: "Confirm move-in date and clear blockers." }));
  maintenance.forEach((room) => signals.push({ severity: "high", title: `Room ${room.room_number} blocks occupancy`, detail: "Maintenance or offline status is preventing admission." }));
  const total = rooms.filter((room) => roomCurrentStatus(room) !== "offline").length;
  if (total && Math.round(((metrics.occupiedRooms || 0) / total) * 100) < 85) {
    signals.push({ severity: "medium", title: "Location occupancy below target", detail: "Prioritize matched leads for available rooms." });
  }
  return signals.slice(0, 6);
}

function normalizeMatchText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferLeadBudget(lead = {}) {
  const text = `${lead.payment_type || ""} ${lead.notes_summary || ""} ${lead.current_situation || ""}`;
  const match = text.match(/\$?\s*(\d{4,5})/);
  return match ? Number(match[1]) : 0;
}

function revenueOpportunityDetail({ blocker, nextTour, staleDays }) {
  if (blocker) return blocker;
  if (nextTour) return `Tour ${formatShortDate(nextTour.scheduled_at)}`;
  if (staleDays) return `Last touched ${Math.round(staleDays)}d ago`;
  return "Ready for next best action";
}

function estimateMoveInProbability(lead, score, context = {}) {
  const statusBonus = { new: 6, contacted: 16, tour_scheduled: 32 }[String(lead.status || "").toLowerCase()] || 10;
  const tourBonus = context.nextTour ? 18 : 0;
  const overduePenalty = context.overdue ? 10 : 0;
  const stalePenalty = context.staleDays >= 14 ? 14 : context.staleDays >= 7 ? 7 : 0;
  return Math.max(5, Math.min(92, Math.round((score * 0.52) + statusBonus + tourBonus - overduePenalty - stalePenalty)));
}

function revenueLeadBlocker(lead, context = {}) {
  if (context.overdue) return "Overdue follow-up";
  if (!lead.phone && !lead.email) return "Needs contact";
  if (context.staleDays >= 14) return "Stale opportunity";
  if (lead.status === "tour_scheduled" && !context.nextTour) return "Tour needs confirmation";
  return "";
}

function safeTime(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function sameDay(value, compare = Date.now()) {
  const a = new Date(value);
  const b = new Date(compare);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function daysSince(value) {
  const time = safeTime(value);
  if (!time) return 0;
  return Math.max(0, (Date.now() - time) / 86400000);
}

function formatShortDate(value) {
  const time = safeTime(value);
  if (!time) return "pending";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(time));
}

function renderIntelligence() {
  const data = app.intelligence || {};
  const counts = data.counts || {};
  const events = data.events || [];
  const brief = $("[data-intelligence-brief]");
  const feed = $("[data-intelligence-feed]");
  const zones = $("[data-intelligence-zones]");
  const pulse = $("[data-operational-pulse]");
  const focus = $("[data-operational-focus]");
  const queues = $("[data-priority-queues]");
  const predictive = $("[data-predictive-cards]");
  const mode = $("[data-intelligence-mode]");
  if (!brief || !queues || !predictive) return;

  mode.textContent = data.mode === "persisted"
    ? `Last persisted scan${data.lastRun?.finished_at ? `: ${formatDate(data.lastRun.finished_at)}` : ""}.`
    : "Live preview is computed from current data. Run the SQL migration to persist signals and cron history.";

  const banner = data.stateBanner || {};
  const outcomes = data.outcomeFeedback || {};
  brief.innerHTML = `
    <div class="state-banner-copy">
      <span class="state-dot ${escapeHtml(banner.state || "stable")}"></span>
      <div>
        <strong>${escapeHtml(banner.title || counts.headline || "Operations are calm right now")}</strong>
        <small>${escapeHtml(banner.detail || counts.summary || "No active operational signals were found.")}</small>
      </div>
    </div>
    <div class="state-banner-meta">
      <span>${escapeHtml(banner.pressureLabel || "Low pressure")}</span>
      <span>${escapeHtml(outcomes.window || "Last 7 days")}</span>
      <strong>${escapeHtml(outcomes.summary || "Stability watch active")}</strong>
    </div>
  `;

  if (focus) focus.innerHTML = renderOperationalFocus(data.operationalFocus || {});

  const zoneData = data.zones || {
    now: events.filter((event) => ["critical", "high"].includes(event.severity)).slice(0, 3),
    watch: events.filter((event) => event.severity === "medium").slice(0, 4),
    healthy: []
  };
  if (zones) {
    zones.innerHTML = `
      ${renderZone("Now", "What needs attention", zoneData.now || [], "now")}
      ${renderZone("Watch", "Trends and opportunities", zoneData.watch || [], "watch")}
      ${renderHealthyZone(zoneData.healthy || [])}
    `;
  }

  if (feed) feed.innerHTML = events.length ? events.slice(0, 6).map(renderIntelligenceCard).join("") : "";

  const pulseItems = data.operationalPulse || [];
  const pulseCount = $("[data-pulse-count]");
  if (pulseCount) pulseCount.textContent = pulseItems.length;
  if (pulse) {
    pulse.innerHTML = pulseItems.length ? pulseItems.map((item) => `
      <article class="pulse-item ${escapeHtml(item.severity || "low")}">
        <span class="severity-dot ${escapeHtml(item.severity || "low")}"></span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(locationName(item.location_id))}${item.ago ? ` &middot; ${escapeHtml(item.ago)}` : ""}${item.count > 1 ? ` &middot; ${item.count} grouped` : ""}</small>
          ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}
        </div>
      </article>
    `).join("") : empty("No operational pulse yet.");
  }

  const q = data.queues || {};
  const queueItems = [
    ["Review overdue leads", q.overdueFollowUps?.length || 0, "followups"],
    ["Recover stale hot leads", q.staleRecovery?.length || 0, "leads"],
    ["Confirm upcoming tours", q.tourRisks?.length || 0, "tours"],
    ["Resolve inactive pipeline", q.inactivePipeline?.length || 0, "leads"]
  ];
  queues.innerHTML = queueItems.map(([label, count, view]) => `
    <button class="queue-card" data-intel-view="${view}">
      <span>${escapeHtml(label)}</span>
      <strong>${count}</strong>
    </button>
  `).join("");

  const cards = data.predictive || {};
  predictive.innerHTML = Object.values(cards).map((card) => `
    <article class="predictive-card">
      <small>${escapeHtml(card.label)}</small>
      <strong>${escapeHtml(card.value)}</strong>
      <span>${escapeHtml(card.detail)}</span>
    </article>
  `).join("");
  renderCoordinationStrip();
  renderExecutionSystem();
  iconRefresh();
}

function renderTodayWorkHome() {
  const target = $("[data-today-work-home]");
  if (!target) return;
  const now = Date.now();
  const commandItems = getCommandCenterItems();
  const activeCommand = resolveActiveCommand(commandItems);
  const toursToday = (app.operations?.tours || []).filter((tour) => sameDay(tour.scheduled_at, now) && !INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase()));
  const overdueFollowUps = (app.operations?.followUps || []).filter((item) => !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase()) && safeTime(item.due_at) && safeTime(item.due_at) < now);
  const newLeads = (app.leads || []).filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const roomWork = (app.operations?.rooms || []).filter((room) => ["maintenance", "offline"].includes(roomCurrentStatus(room)) || ["needs_cleaning", "maintenance", "damaged"].includes(String(room.condition || "").toLowerCase()));
  const escalations = (app.escalations?.items || app.escalations?.events || []).filter((item) => !["resolved", "dismissed"].includes(String(item.status || "").toLowerCase()));
  const queue = [
    { key: "call", label: "Call", count: newLeads.length, detail: newLeads[0]?.full_name || "No new leads", view: "leads", icon: "phone-call" },
    { key: "tour", label: "Tour", count: toursToday.length, detail: toursToday[0] ? `${leadName(toursToday[0].lead_id) || "Family"} at ${formatTime(toursToday[0].scheduled_at)}` : "No tours today", view: "tours", icon: "calendar-check" },
    { key: "follow", label: "Follow-up", count: overdueFollowUps.length, detail: overdueFollowUps[0] ? leadName(overdueFollowUps[0].lead_id) || overdueFollowUps[0].note || "Overdue" : "Nothing overdue", view: "followups", icon: "bell-ring" },
    { key: "room", label: "Room", count: roomWork.length, detail: roomWork[0] ? `Room ${roomWork[0].room_number || ""} needs readiness` : "Rooms clear", view: "rooms", icon: "door-open" },
    { key: "escalation", label: "Escalation", count: escalations.length, detail: escalations[0]?.title || escalations[0]?.event_type || "No escalations", view: "dashboard", icon: "shield-alert" }
  ];
  const active = queue.find((item) => item.count > 0) || queue[0];
  const commandLead = activeCommand?.leadId ? findLead(activeCommand.leadId) : null;
  const homeMode = roleHomeMode();
  const activeTitle = activeCommand?.title || (active.count ? `${active.label}: ${active.detail}` : homeMode.fallbackTitle);
  const activeDetail = activeCommand?.impact || activeCommand?.detail || (active.count ? "Work this queue before opening lower dashboards." : "No urgent blocker. Keep the pipeline warm.");
  const clearLabel = activeCommand ? clearSignalLabel(activeCommand) : "Next commitment is logged";
  const primaryActions = activeCommand
    ? commandActionButtons(activeCommand)
    : `<button data-view="${escapeHtml(active.view)}"><i data-lucide="arrow-right"></i>Open ${escapeHtml(active.label)}</button>`;
  target.innerHTML = `
    <section class="today-command-hero ${activeCommand ? escapeHtml(commandPressure(activeCommand)) : "calm"}">
      <div class="today-command-copy">
        <p class="eyebrow">${escapeHtml(homeMode.eyebrow)}</p>
        <h2>${escapeHtml(activeTitle)}</h2>
        <p>${escapeHtml(activeDetail)}</p>
        <div class="today-command-meta">
          <span>${escapeHtml(activeCommand ? commandLabel(activeCommand.type) : active.label)}</span>
          <span>${escapeHtml(commandLead ? locationName(commandLead.location_id) : app.selectedLocationId ? locationName(app.selectedLocationId) : "All assigned locations")}</span>
          <span>Clears when: ${escapeHtml(clearLabel)}</span>
        </div>
      </div>
      <div class="today-command-action">
        <span>Next action</span>
        <div class="today-command-buttons">${primaryActions}<button class="ghost" data-cc-next><i data-lucide="skip-forward"></i>Next</button></div>
      </div>
    </section>
    <section class="mobile-ops-now">
      <strong>${escapeHtml(activeTitle)}</strong>
      <small>${escapeHtml(activeDetail)}</small>
      <div class="mobile-ops-actions">${primaryActions}<button class="ghost" data-cc-next><i data-lucide="skip-forward"></i>Next</button></div>
    </section>
    <div class="today-work-grid">
      ${queue.map((item) => `
        <button class="today-work-tile ${item.count ? "active" : "quiet"}" data-view="${escapeHtml(item.view)}">
          <i data-lucide="${escapeHtml(item.icon)}"></i>
          <span>${escapeHtml(item.label)}</span>
          <strong>${item.count}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </button>
      `).join("")}
    </div>
  `;
  target.onclick = handleIntelligenceClick;
}

function roleHomeMode() {
  const role = app.user?.role || "";
  if (app.user?.isSuperAdmin || role === "super_admin") return { eyebrow: "Owner view", fallbackTitle: "Review portfolio escalations" };
  if (["regional_manager", "location_admin"].includes(role)) return { eyebrow: "Location health", fallbackTitle: "Review location work" };
  return { eyebrow: "My work", fallbackTitle: "Work your next assigned action" };
}

function renderSystemHealth() {
  const target = $("[data-system-health]");
  if (!target) return;
  const integrations = app.integrations?.integrations || [];
  const google = integrations.find((item) => item.provider === "google_calendar" && item.status === "connected");
  const gmail = integrations.find((item) => item.provider === "google_gmail" && item.status === "connected");
  const failedTour = (app.operations?.tours || []).find((tour) => tour.external_calendar_sync_status === "failed");
  const latest = latestOperationalActivity();
  const items = [
    {
      label: "Google",
      state: google ? (failedTour ? "Needs attention" : "Connected") : "Not connected",
      tone: google ? (failedTour ? "warn" : "good") : "muted",
      action: google ? "Reconnect" : "Link",
      attr: "data-connect-google-calendar"
    },
    {
      label: "Gmail",
      state: gmail ? "Connected" : "Not linked",
      tone: gmail ? "good" : "muted",
      action: gmail ? "Pull" : "Link",
      attr: gmail ? "data-pull-google-gmail" : "data-connect-google-gmail"
    },
    { label: "Email", state: "Live", tone: "good" },
    { label: "Data", state: latest ? `Fresh ${relativeTime(latest).text.replace(" late", " ago")}` : "Waiting", tone: latest ? "good" : "muted" },
    { label: "Sync", state: failedTour ? "Repair tour sync" : "Clean", tone: failedTour ? "warn" : "good" }
  ];
  target.innerHTML = items.map((item) => `
    <article class="${escapeHtml(item.tone)}">
      <div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.state)}</strong></div>
      ${item.action ? `<button class="ghost health-action" ${item.attr}><i data-lucide="${item.action === "Pull" ? "inbox" : "plug"}"></i>${escapeHtml(item.action)}</button>` : ""}
    </article>
  `).join("");
  target.onclick = handleScopeControlClick;
  iconRefresh();
}

function renderAppConnectionsHome() {
  const target = $("[data-app-connections]");
  if (!target) return;
  const data = app.integrations || {};
  const integrations = data.integrations || [];
  const calendar = integrations.find((item) => item.provider === "google_calendar" && item.status === "connected");
  const gmail = integrations.find((item) => item.provider === "google_gmail" && item.status === "connected");
  target.innerHTML = `
    <header>
      <div>
        <p class="eyebrow">App connections</p>
        <h2>Gmail + Google Calendar</h2>
      </div>
      <button class="ghost" data-refresh-integrations><i data-lucide="refresh-cw"></i>Refresh</button>
    </header>
    <div class="app-connection-grid">
      <article class="${gmail ? "connected" : ""}">
        <i data-lucide="mail"></i>
        <div>
          <strong>Gmail ${gmail ? "connected" : "not linked"}</strong>
          <small>${escapeHtml(gmail?.calendar_name || "Link Gmail to pull recent inbox messages.")}</small>
        </div>
        <div class="app-connection-actions">
          ${gmail ? `<button class="ghost" data-pull-google-gmail><i data-lucide="inbox"></i>Pull inbox</button><button class="danger-outline" data-disconnect-google-gmail><i data-lucide="unplug"></i>Unlink</button>` : `<button data-connect-google-gmail><i data-lucide="mail-plus"></i>Link Gmail</button>`}
        </div>
      </article>
      <article class="${calendar ? "connected" : ""}">
        <i data-lucide="calendar-days"></i>
        <div>
          <strong>Calendar ${calendar ? "connected" : "not linked"}</strong>
          <small>${escapeHtml(calendar?.calendar_name || "Link Calendar to sync tours.")}</small>
        </div>
        <div class="app-connection-actions">
          ${calendar ? `<button class="ghost" data-connect-google-calendar><i data-lucide="rotate-cw"></i>Reconnect</button><button class="danger-outline" data-disconnect-google-calendar><i data-lucide="unplug"></i>Unlink</button>` : `<button data-connect-google-calendar><i data-lucide="calendar-plus"></i>Link Calendar</button>`}
        </div>
      </article>
    </div>
  `;
  iconRefresh();
}

function renderExecutionSystem() {
  renderCommandCenter();
  renderWorkSession();
  renderAdmissionsCommandQueue();
  renderDailyAdmissionsPlan();
  renderTourReadiness();
  renderRevenueRisk();
  renderLocationAccountability();
  const sprint = $("[data-work-sprint-modal]");
  if (sprint?.open) renderWorkSprint();
}

function renderCommandCenter() {
  const target = $("[data-command-center]");
  if (!target) return;
  const items = getCommandCenterItems();
  const active = resolveActiveCommand(items);
  const state = commandCenterState(items);
  const stateNode = $("[data-cc-state]");
  const countNode = $("[data-cc-count]");
  if (stateNode) stateNode.textContent = state.line;
  const groups = getCommandQueueGroups(items);
  if (countNode) countNode.textContent = `${items.length} ${items.length === 1 ? "action" : "actions"} in ${groups.length || 0} ${groups.length === 1 ? "queue" : "queues"}`;
  renderMissionState(items, active, state);
  $("[data-cc-queue]").innerHTML = groups.length ? groups.map((group, index) => renderCommandRailGroup(group, index, active?.id)).join("") : renderCommandCenterEmptyQueue();
  $("[data-cc-active]").innerHTML = active ? renderActiveCaseFile(active) : renderStableCommandCenter();
  $("[data-cc-context]").innerHTML = active ? renderPlaybookPanel(active) : renderStablePlaybookPanel();
  iconRefresh();
}

function getCommandCenterItems() {
  const commands = buildAdmissionsCommands();
  if (commands.length) return commands;
  const leadReviews = app.leads
    .filter((lead) => !["archived", "move_in"].includes(String(lead.status || "").toLowerCase()))
    .sort((a, b) => estimateClientLeadScore(b) - estimateClientLeadScore(a) || new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 6)
    .map((lead) => ({
      id: `review:${lead.id}`,
      type: "lead_review",
      priority: Math.max(25, estimateClientLeadScore(lead)),
      title: `Review ${lead.full_name || "active family"}`,
      detail: "No urgent blocker. Keep the family journey moving.",
      locationId: lead.location_id,
      leadId: lead.id,
      impact: "A small next step prevents quiet leads from drifting.",
      primaryLabel: "Open case",
      status: "steady"
    }));
  if (leadReviews.length) return leadReviews;
  return [];
}

function resolveActiveCommand(items) {
  if (!items.length) {
    app.activeCommandId = "";
    localStorage.removeItem("ccsl:v2-active-command");
    return null;
  }
  const active = items.find((item) => item.id === app.activeCommandId) || items[0];
  app.activeCommandId = active.id;
  localStorage.setItem("ccsl:v2-active-command", active.id);
  return active;
}

function setActiveCommand(id) {
  app.activeCommandId = id || "";
  if (app.activeCommandId) localStorage.setItem("ccsl:v2-active-command", app.activeCommandId);
  else localStorage.removeItem("ccsl:v2-active-command");
  renderCommandCenter();
  renderWorkSession();
  renderTodayWorkHome();
  renderMissionContextRail();
}

function commandCenterState(items) {
  const now = items.filter((item) => item.priority >= 95).length;
  const recoveries = items.filter((item) => item.type === "lead_recovery").length;
  const tours = items.filter((item) => item.type === "tour").length;
  if (now) return { tone: "pressure", line: `${now} high-priority admission ${now === 1 ? "action needs" : "actions need"} focus now.` };
  if (recoveries) return { tone: "recovery", line: `${recoveries} recovery ${recoveries === 1 ? "opportunity" : "opportunities"} ready for outreach.` };
  if (tours) return { tone: "tour", line: `${tours} tour ${tours === 1 ? "workflow" : "workflows"} need preparation.` };
  if (items.length) return { tone: "steady", line: "Admissions flow is steady. Work the next best action." };
  return { tone: "calm", line: "Operations are calm. No forced action is waiting." };
}

function renderMissionState(items, active, state) {
  const target = $("[data-cc-mission]");
  if (!target) return;
  const urgent = items.filter((item) => commandPressure(item) === "critical").length;
  const soon = items.filter((item) => commandPressure(item) === "elevated").length;
  const calls = items.filter((item) => ["follow_up", "lead_contact"].includes(item.type)).length;
  const tours = items.filter((item) => item.type === "tour").length;
  const recoveries = items.filter((item) => item.type === "lead_recovery").length;
  const flow = [
    { label: "Call", value: calls },
    { label: "Tour", value: tours },
    { label: "Recover", value: recoveries }
  ];
  const clearSignal = active ? clearSignalLabel(active) : "Keep notes current";
  target.innerHTML = `
    <article class="mission-state-card ${escapeHtml(state.tone || "steady")}">
      <span>Now</span>
      <strong>${escapeHtml(urgent ? `${urgent} urgent` : soon ? `${soon} soon` : "Clear")}</strong>
      <small>${escapeHtml(state.line)}</small>
    </article>
    <article class="mission-state-card">
      <span>Work first</span>
      <strong>${escapeHtml(active?.title || "No forced action")}</strong>
      <small>${escapeHtml(active?.impact || "Use the calm window to prepare upcoming work.")}</small>
    </article>
    <article class="mission-state-card mission-flow">
      <span>Flow</span>
      <div>
        ${flow.map((item) => `<span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.label)}</small></span>`).join("")}
      </div>
    </article>
    <article class="mission-state-card">
      <span>Clears when</span>
      <strong>${escapeHtml(clearSignal)}</strong>
      <small>The signal refreshes after the workflow action completes.</small>
    </article>
  `;
}

function clearSignalLabel(command = {}) {
  if (command.type === "follow_up") return command.status === "overdue" ? "Follow-up is completed" : "Next touch is logged";
  if (command.type === "lead_contact") return "Lead is marked Contacted";
  if (command.type === "lead_recovery") return "Recovery touch is sent";
  if (command.type === "tour") return command.status === "overdue" ? "Tour is completed" : "Tour is confirmed or prep is ready";
  if (command.type === "lead_review") return "Case has a next step";
  return "Workflow owner is assigned";
}

function getCommandQueueGroups(items) {
  const groups = new Map();
  items.forEach((command) => {
    const key = commandGroupKey(command);
    if (!groups.has(key)) groups.set(key, { key, items: [], priority: 0, locationId: command.locationId, type: command.type, status: command.status });
    const group = groups.get(key);
    group.items.push(command);
    group.priority = Math.max(group.priority, Number(command.priority || 0));
    group.locationId = group.locationId || command.locationId;
  });
  return [...groups.values()]
    .map((group) => ({ ...group, items: group.items.sort((a, b) => b.priority - a.priority || (a.dueAt || Infinity) - (b.dueAt || Infinity)) }))
    .sort((a, b) => b.priority - a.priority || b.items.length - a.items.length);
}

function commandGroupKey(command = {}) {
  const status = command.status === "overdue" ? "overdue" : command.type;
  const locationScope = ["follow_up", "tour"].includes(command.type) ? command.locationId || "all" : "all";
  return `${status}:${command.type}:${locationScope}`;
}

function renderCommandRailGroup(group, index, activeId) {
  const first = group.items[0];
  const active = group.items.some((item) => item.id === activeId);
  const pressure = commandPressure(first);
  const count = group.items.length;
  const label = commandGroupLabel(group);
  const sample = group.items.slice(0, 2).map((item) => leadName(item.leadId)).filter(Boolean).join(", ");
  return `
    <button class="rail-command ${escapeHtml(pressure)} ${active ? "active" : ""}" data-cc-command="${escapeHtml(first.id)}">
      <span class="rail-rank">${index + 1}</span>
      <span class="rail-body">
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(sample || locationName(group.locationId))}${count > 2 ? ` and ${count - 2} more` : ""}</small>
      </span>
      <span class="rail-score">${escapeHtml(pressureLabel(pressure))}</span>
    </button>
  `;
}

function commandGroupLabel(group = {}) {
  const count = group.items?.length || 0;
  const first = group.items?.[0] || {};
  const plural = count === 1 ? "" : "s";
  const loc = group.locationId ? ` at ${locationName(group.locationId)}` : "";
  if (first.type === "follow_up" && first.status === "overdue") return `${count} overdue follow-up${plural}${loc}`;
  if (first.type === "follow_up") return `${count} follow-up${plural} due today${loc}`;
  if (first.type === "lead_contact") return `${count} new lead${plural} ${count === 1 ? "needs" : "need"} first contact`;
  if (first.type === "lead_recovery") return `${count} stale lead${plural} ready for recovery`;
  if (first.type === "tour" && first.status === "overdue") return `${count} tour${plural} ${count === 1 ? "needs" : "need"} close-out${loc}`;
  if (first.type === "tour") return `${count} upcoming tour${plural} ${count === 1 ? "needs" : "need"} prep${loc}`;
  if (first.type === "lead_review") return `${count} lead review${plural} ready`;
  return `${count} admissions action${plural}`;
}

function renderCommandCenterEmptyQueue() {
  return `
    <article class="rail-empty">
      <i data-lucide="check-circle-2"></i>
      <strong>No urgent work waiting</strong>
      <small>New leads, follow-ups, and tours will appear here automatically.</small>
    </article>
  `;
}

function renderActiveCaseFile(command) {
  const lead = findLead(command.leadId);
  if (!lead) return renderLocationCommand(command);
  const score = estimateClientLeadScore(lead);
  const priority = commandPriorityLabel(command, score);
  const playbook = playbookForCommand(command, lead);
  const journey = leadJourneyStages(lead, command);
  const timeline = caseTimelineItems(lead.id);
  return `
    <section class="case-hero ${escapeHtml(commandPressure(command))}">
      <div class="case-hero-top">
        <div>
          <p class="eyebrow">Active family case</p>
          <h3>${escapeHtml(lead.full_name || "Unnamed lead")}</h3>
          <span>${escapeHtml(locationName(lead.location_id))} &middot; ${escapeHtml(lead.care_type || "Care need not set")}</span>
        </div>
        <div class="case-score priority-${escapeHtml(priority.tone)}">
          <strong>${escapeHtml(priority.label)}</strong>
          <span>${escapeHtml(priority.detail)}</span>
        </div>
      </div>
      <div class="case-next-action">
        <span>Next best action</span>
        <strong>${escapeHtml(command.title)}</strong>
        <p>${escapeHtml(command.impact || command.detail || "Move the family to the next clear step.")}</p>
        <div class="case-clearance">
          <i data-lucide="badge-check"></i>
          <div><span>Clears when</span><strong>${escapeHtml(clearSignalLabel(command))}</strong></div>
        </div>
        <div class="command-actions">${commandActionButtons(command)}</div>
      </div>
    </section>
    <section class="case-intel-grid">
      ${caseInfoTile("Status", statusLabel(lead.status), leadSlaState(lead)?.text || "SLA healthy")}
      ${caseInfoTile("Contact", primaryContactLine(lead), lead.best_contact_time || lead.preferred_contact_method || "Preferred time not set")}
      ${caseInfoTile("Timeline", lead.move_timeline || "Timeline unknown", lead.payment_type || "Payment path not captured")}
      ${caseInfoTile("Source", lead.source || "Unknown", formatDate(lead.created_at))}
    </section>
    <section class="journey-map">
      ${journey.map((step) => `
        <article class="${escapeHtml(step.state)}">
          <span>${step.state === "done" ? "&#10003;" : step.state === "active" ? "&bull;" : ""}</span>
          <strong>${escapeHtml(step.label)}</strong>
          <small>${escapeHtml(step.detail)}</small>
        </article>
      `).join("")}
    </section>
    <section class="family-context">
      <div>
        <p class="eyebrow">Family situation</p>
        <p>${escapeHtml(lead.current_situation || lead.notes_summary || command.detail || "No situation summary captured yet. Capture care need, urgency, decision-maker, and timeline on the next touch.")}</p>
      </div>
      <div>
        <p class="eyebrow">${escapeHtml(playbook.name)}</p>
        <p>${escapeHtml(playbook.objective)}</p>
      </div>
    </section>
    <section class="case-timeline-preview">
      <div class="case-section-head"><p class="eyebrow">Relationship timeline</p><strong>Recent signals</strong></div>
      <div class="case-timeline-list">
        ${timeline.length ? timeline.map((item) => `
          <article>
            <span>${escapeHtml(item.icon)}</span>
            <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)} &middot; ${escapeHtml(formatDate(item.at))}</small></div>
          </article>
        `).join("") : `<article><span>&bull;</span><div><strong>Lead created</strong><small>${escapeHtml(formatDate(lead.created_at))}</small></div></article>`}
      </div>
    </section>
  `;
}

function renderLocationCommand(command) {
  return `
    <section class="case-hero ${escapeHtml(commandPressure(command))}">
      <div class="case-hero-top">
        <div>
          <p class="eyebrow">Operational signal</p>
          <h3>${escapeHtml(command.title || "Location attention needed")}</h3>
          <span>${escapeHtml(locationName(command.locationId))}</span>
        </div>
        <div class="case-score"><strong>${Math.round(command.priority || 0)}</strong><span>Priority</span></div>
      </div>
      <div class="case-next-action">
        <span>Recommended action</span>
        <strong>${escapeHtml(command.primaryLabel || "Open workflow")}</strong>
        <p>${escapeHtml(command.impact || command.detail || "Review the related workflow and assign ownership.")}</p>
        <div class="case-clearance">
          <i data-lucide="badge-check"></i>
          <div><span>Clears when</span><strong>${escapeHtml(clearSignalLabel(command))}</strong></div>
        </div>
        <div class="command-actions">${commandActionButtons(command)}</div>
      </div>
    </section>
    <section class="family-context">
      <div><p class="eyebrow">Why it matters</p><p>${escapeHtml(command.detail || "This signal affects admissions momentum.")}</p></div>
      <div><p class="eyebrow">Operating principle</p><p>Resolve the bottleneck, assign the next owner, and confirm the signal clears on refresh.</p></div>
    </section>
  `;
}

function renderPlaybookPanel(command) {
  const lead = findLead(command.leadId);
  const playbook = playbookForCommand(command, lead || {});
  return `
    <div class="playbook-head">
      <p class="eyebrow">Guided playbook</p>
      <h3>${escapeHtml(playbook.name)}</h3>
      <span>${escapeHtml(playbook.objective)}</span>
    </div>
    <div class="playbook-steps">
      ${playbook.steps.map((step, index) => `
        <article>
          <span>${index + 1}</span>
          <div><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.detail)}</small></div>
        </article>
      `).join("")}
    </div>
    <section class="talk-track">
      <p class="eyebrow">Suggested talk track</p>
      <p>${escapeHtml(playbook.talkTrack)}</p>
    </section>
    <section class="capture-box">
      <p class="eyebrow">Capture before closing</p>
      <ul>${playbook.capture.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function renderStableCommandCenter() {
  const stable = stableAdmissionsState();
  return `
    <section class="case-hero calm">
      <div class="case-hero-top">
        <div>
          <p class="eyebrow">Stable operations</p>
          <h3>Admissions flow is stable</h3>
          <span>${escapeHtml(stable.summary)}</span>
        </div>
        <div class="case-score"><strong>&#10003;</strong><span>Clear</span></div>
      </div>
      <div class="case-next-action">
        <span>Recommended action</span>
        <strong>${escapeHtml(stable.nextReview)}</strong>
        <p>${escapeHtml(stable.lastAction)}</p>
        <div class="stable-signal-grid">
          ${stable.signals.map((item) => `
            <article>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </article>
          `).join("")}
        </div>
        <div class="command-actions"><button class="ghost" data-intel-view="${escapeHtml(stable.view)}"><i data-lucide="${escapeHtml(stable.icon)}"></i>${escapeHtml(stable.cta)}</button></div>
      </div>
    </section>
  `;
}

function stableAdmissionsState() {
  const now = Date.now();
  const upcomingTours = (app.operations?.tours || [])
    .filter((tour) => !INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase()) && tour.scheduled_at && new Date(tour.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const overdueFollowUps = (app.operations?.followUps || [])
    .filter((item) => !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase()) && item.due_at && new Date(item.due_at).getTime() < now).length;
  const latest = latestOperationalActivity();
  return {
    summary: "No urgent lead, tour, or follow-up requires immediate action.",
    nextReview: upcomingTours.length ? "Next recommended review: upcoming tours" : "Next recommended review: active leads",
    lastAction: latest ? `Last action completed ${relativeTime(latest).text.replace(" late", " ago")}.` : "No recent completed action is available yet.",
    view: upcomingTours.length ? "tours" : "leads",
    icon: upcomingTours.length ? "calendar-check" : "users",
    cta: upcomingTours.length ? "Review tours" : "Review leads",
    signals: [
      { label: "Overdue follow-ups", value: overdueFollowUps ? `${overdueFollowUps} open` : "None" },
      { label: "Upcoming tours", value: `${upcomingTours.length}` },
      { label: "Pressure", value: "Stable" }
    ]
  };
}

function latestOperationalActivity() {
  const dates = [
    ...(app.dashboard?.recentActivity || []).map((row) => row.created_at),
    ...(app.operations?.notes || []).map((row) => row.created_at),
    ...(app.operations?.followUps || []).filter((row) => INACTIVE_FOLLOWUP_STATUSES.has(String(row.status || "").toLowerCase())).map((row) => row.updated_at || row.created_at),
    ...(app.operations?.tours || []).filter((row) => INACTIVE_TOUR_STATUSES.has(String(row.status || "").toLowerCase())).map((row) => row.updated_at || row.created_at)
  ].filter(Boolean).map((value) => new Date(value).getTime()).filter((value) => !Number.isNaN(value));
  return dates.length ? Math.max(...dates) : null;
}

function renderStablePlaybookPanel() {
  return `
    <div class="playbook-head">
      <p class="eyebrow">Operating rhythm</p>
      <h3>Keep the pipeline warm</h3>
      <span>When there is no pressure, protect tomorrow's momentum.</span>
    </div>
    <div class="playbook-steps">
      <article><span>1</span><div><strong>Check recent new leads</strong><small>Make sure every family has a clear next step.</small></div></article>
      <article><span>2</span><div><strong>Prepare tours</strong><small>Confirm directions, decision-makers, and talking points.</small></div></article>
      <article><span>3</span><div><strong>Clean notes</strong><small>Capture care need, timeline, budget path, and objections.</small></div></article>
    </div>
  `;
}

function caseInfoTile(label, value, detail) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not set")}</strong>
      <small>${escapeHtml(detail || "")}</small>
    </article>
  `;
}

function playbookForCommand(command, lead = {}) {
  const text = [lead.care_type, lead.current_situation, lead.notes_summary, lead.payment_type, lead.move_timeline, command.detail].join(" ").toLowerCase();
  if (command.type === "tour") {
    return {
      name: "Tour conversion playbook",
      objective: "Make the visit feel prepared, personal, and easy to say yes to.",
      steps: [
        { label: "Confirm logistics", detail: "Verify time, directions, parking, arrival contact, and who is attending." },
        { label: "Prepare care context", detail: "Know the resident need, timeline, family concern, and likely objection." },
        { label: "Close the loop", detail: "After the tour, set the next decision step before the family goes quiet." }
      ],
      talkTrack: "Before your visit, I wanted to make sure we understand what matters most so we can focus the tour around your family, not just the building.",
      capture: ["Decision-maker attending", "Primary concern", "Move-in timeline", "Post-tour follow-up date"]
    };
  }
  if (text.includes("memory")) {
    return {
      name: "Memory care urgency playbook",
      objective: "Reduce family overwhelm and move quickly toward a safe next step.",
      steps: [
        { label: "Acknowledge stress", detail: "Start with reassurance and listen for safety concerns." },
        { label: "Qualify risk", detail: "Ask about wandering, falls, medication, caregiver burnout, and discharge timing." },
        { label: "Offer concrete next step", detail: "Recommend a tour or clinical conversation, not a vague follow-up." }
      ],
      talkTrack: "I know memory care decisions can feel urgent and emotional. Let me understand what changed recently, then we can help you decide the safest next step.",
      capture: ["Safety concern", "Diagnosis or symptoms", "Caregiver pressure", "Tour readiness"]
    };
  }
  if (text.includes("medicaid") || text.includes("waiver")) {
    return {
      name: "Medicaid waiver inquiry playbook",
      objective: "Clarify eligibility and keep the family from feeling priced out too early.",
      steps: [
        { label: "Clarify payment path", detail: "Ask whether waiver is active, pending, or being explored." },
        { label: "Set expectations", detail: "Explain what the community can support and what documents may be needed." },
        { label: "Schedule next step", detail: "Assign follow-up with a clear date so paperwork does not stall." }
      ],
      talkTrack: "We can walk through the payment path together. The first step is understanding where you are in the waiver process.",
      capture: ["Waiver status", "Current residence", "Timeline", "Documents needed"]
    };
  }
  if (command.type === "lead_recovery") {
    return {
      name: "Recovery outreach playbook",
      objective: "Restart the conversation without sounding automated or pushy.",
      steps: [
        { label: "Reference context", detail: "Mention the community or care need they originally asked about." },
        { label: "Make it easy", detail: "Offer two simple options: quick call or tour time." },
        { label: "Set follow-up", detail: "If no response, schedule one final warm touch." }
      ],
      talkTrack: "I wanted to check in personally. If senior living is still on your mind, I can help you compare options or set up a quiet tour.",
      capture: ["Still looking?", "Barrier", "Preferred contact", "Next touch"]
    };
  }
  return {
    name: "New inquiry response playbook",
    objective: "Respond quickly, understand the family situation, and create the next scheduled step.",
    steps: [
      { label: "Call first", detail: "Speed matters most while intent is fresh." },
      { label: "Identify need", detail: "Capture care type, urgency, relationship, and decision-maker." },
      { label: "Create next commitment", detail: "Schedule tour, send pricing info, or set a follow-up before ending." }
    ],
    talkTrack: "Thanks for reaching out. I want to understand what is happening and what kind of support would make this easier for your family.",
    capture: ["Care type", "Timeline", "Budget/payment path", "Next scheduled action"]
  };
}

function leadJourneyStages(lead = {}, command = {}) {
  const status = String(lead.status || "").toLowerCase();
  const hasTour = (app.operations?.tours || []).some((tour) => tour.lead_id === lead.id);
  const hasFollowUp = (app.operations?.followUps || []).some((item) => item.lead_id === lead.id && !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase()));
  return [
    { label: "Inquiry", detail: lead.source || "Lead captured", state: "done" },
    { label: "Contact", detail: status === "new" ? "Waiting for first touch" : "Conversation started", state: status === "new" ? "active" : "done" },
    { label: "Tour", detail: hasTour || status === "tour_scheduled" ? "Tour workflow active" : "Not scheduled yet", state: hasTour || status === "tour_scheduled" ? "active" : "waiting" },
    { label: "Decision", detail: status === "move_in" ? "Moved in" : hasFollowUp ? "Follow-up assigned" : "Needs next commitment", state: status === "move_in" ? "done" : hasFollowUp ? "active" : "waiting" }
  ];
}

function caseTimelineItems(leadId) {
  if (!leadId) return [];
  const lead = findLead(leadId);
  const items = [];
  if (lead?.created_at) items.push({ icon: "*", title: "Lead created", detail: lead.source || "Inquiry received", at: lead.created_at });
  (app.operations?.followUps || []).filter((row) => row.lead_id === leadId).forEach((row) => {
    items.push({ icon: "FU", title: `Follow-up ${row.status || "open"}`, detail: row.note || "Follow-up activity", at: row.updated_at || row.due_at || row.created_at });
  });
  (app.operations?.tours || []).filter((row) => row.lead_id === leadId).forEach((row) => {
    items.push({ icon: "T", title: `Tour ${row.status || "scheduled"}`, detail: row.notes || "Tour workflow", at: row.updated_at || row.scheduled_at || row.created_at });
  });
  (app.operations?.emailHistory || []).filter((row) => row.lead_id === leadId).forEach((row) => {
    items.push({ icon: "@", title: "Email sent", detail: row.subject || row.status || "Email activity", at: row.sent_at || row.created_at });
  });
  return items
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);
}

function primaryContactLine(lead = {}) {
  if (lead.phone && lead.email) return `${lead.phone} / ${lead.email}`;
  return lead.phone || lead.email || "No contact captured";
}

function commandPressure(command = {}) {
  if (["overdue", "hot"].includes(command.status) || Number(command.priority || 0) >= 110) return "critical";
  if (["stale", "tour_ready", "due_today"].includes(command.status) || Number(command.priority || 0) >= 80) return "elevated";
  return "steady";
}

function pressureLabel(pressure) {
  return pressure === "critical" ? "Now" : pressure === "elevated" ? "Soon" : "Steady";
}

function leadTemperatureLabel(score) {
  const value = Number(score) || 0;
  if (value >= 70) return "Hot";
  if (value >= 35) return "Warm";
  return "Cold";
}

function commandPriorityLabel(command = {}, score = 0) {
  const value = Math.max(Number(command.priority || 0), Number(score || 0));
  if (value >= 105) return { label: "High", detail: "Priority", tone: "high" };
  if (value >= 75) return { label: "Medium", detail: "Priority", tone: "medium" };
  return { label: "Low", detail: "Priority", tone: "low" };
}

function renderWorkSession() {
  const target = $("[data-work-session]");
  if (!target) return;
  const commands = buildAdmissionsCommands();
  const outcomes = app.intelligence?.outcomeFeedback || {};
  const active = commands.length;
  const high = commands.filter((item) => item.priority >= 95).length;
  const doneSignals = (outcomes.outcomes || []).length;
  const total = Math.max(active + doneSignals, active, 1);
  const progress = Math.min(100, Math.round((doneSignals / total) * 100));
  const first = commands.find((item) => item.id === app.activeCommandId) || commands[0] || null;
  const mode = high ? "Recovery sprint" : active ? "Execution mode" : "Calm operations";
  const title = high ? "Admissions pressure needs action"
    : active ? "Today's admissions work is queued"
    : "Admissions flow is under control";
  const summary = active
    ? `${active} priority action${active === 1 ? "" : "s"} remaining. ${high ? `${high} should happen first.` : "Work the queue from top to bottom."}`
    : "No urgent work is waiting. Keep planned follow-ups moving.";
  const outcome = app.workflowOutcome;
  target.innerHTML = `
    <div class="work-session-copy">
      <p class="eyebrow">${escapeHtml(mode)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(summary)}</p>
      <div class="work-progress" aria-label="Work session progress">
        <span style="width:${progress}%"></span>
      </div>
      <small>${escapeHtml(outcomes.summary || "Progress updates as actions are completed.")}</small>
      ${outcome ? `
        <article class="outcome-feedback ${escapeHtml(outcome.tone)}">
          <i data-lucide="trending-down"></i>
          <div><strong>${escapeHtml(outcome.title)}</strong><small>${escapeHtml(outcome.detail)}</small></div>
        </article>
      ` : ""}
    </div>
    <div class="work-session-next ${first ? "live" : "stable"}">
      <small>Current task</small>
      <strong>${escapeHtml(first?.title || "No immediate action needed")}</strong>
      <p>${escapeHtml(first?.impact || "Operations are calm. Use the dashboard to review planned work.")}</p>
      <div class="work-session-actions">
        ${first ? renderWorkSessionControls(first) : `<button class="ghost" data-intel-view="leads"><i data-lucide="users"></i>Review leads</button>`}
      </div>
      ${first ? `<small class="operator-keys">N next action &middot; D done &middot; / search</small>` : ""}
    </div>
  `;
}

function renderWorkSessionControls(command) {
  const openLead = command.leadId ? `<button class="ghost" data-intel-open-lead="${escapeHtml(command.leadId)}"><i data-lucide="panel-right-open"></i>Open lead</button>` : "";
  const snooze = command.type === "follow_up" ? `<button class="ghost" data-command-snooze-followup="${escapeHtml(command.sourceId)}"><i data-lucide="clock-3"></i>Snooze</button>` : "";
  const completeLabel = completeCommandLabel(command);
  const complete = completeLabel ? `<button data-command-complete-active="${escapeHtml(command.id)}"><i data-lucide="check"></i>${escapeHtml(completeLabel)}</button>` : "";
  const prep = command.type === "tour" && command.status !== "overdue" ? `<button data-tour-prep="${escapeHtml(command.sourceId)}"><i data-lucide="wand-sparkles"></i>Prep tour</button>` : "";
  return `${complete || prep}${snooze}${openLead}<button class="ghost" data-cc-next><i data-lucide="skip-forward"></i>Next</button>`;
}

function completeCommandLabel(command = {}) {
  if (command.type === "follow_up") return "Complete";
  if (command.type === "lead_contact") return "Mark contacted";
  if (command.type === "tour" && command.status === "overdue") return "Complete tour";
  return "";
}

function buildWorkflowOutcome({ title = "Workflow updated", beforeCount = 0, afterCount = 0, command = null } = {}) {
  const delta = Number(beforeCount || 0) - Number(afterCount || 0);
  const location = command?.locationId ? locationName(command.locationId) : "";
  const pressure = delta > 0 ? "Admissions pressure decreasing" : "Queue recalculated";
  const queueLine = beforeCount ? `Queue ${delta > 0 ? "reduced" : "updated"} from ${beforeCount} to ${afterCount}.` : "Queue refreshed against current signals.";
  const locationLine = location ? `${location} signal refreshed.` : "Operational signal refreshed.";
  return {
    title,
    detail: `${queueLine} ${locationLine} ${pressure}.`,
    tone: delta > 0 ? "positive" : "neutral"
  };
}

function openWorkSprint() {
  renderWorkSprint();
  $("[data-work-sprint-modal]")?.showModal();
  iconRefresh();
}

function renderWorkSprint() {
  const target = $("[data-work-sprint]");
  if (!target) return;
  const commands = buildAdmissionsCommands();
  const high = commands.filter((item) => item.priority >= 95).length;
  const followUps = commands.filter((item) => item.type === "follow_up").length;
  const tours = commands.filter((item) => item.type === "tour").length;
  const recoveries = commands.filter((item) => item.type === "lead_recovery").length;
  if (!commands.length) {
    target.innerHTML = `
      <article class="sprint-calm">
        <i data-lucide="check-circle-2"></i>
        <div>
          <strong>Operations are clear right now.</strong>
          <p>No urgent admissions sprint is needed. Keep planned follow-ups moving and monitor new inquiries.</p>
        </div>
      </article>
    `;
    return;
  }
  target.innerHTML = `
    <section class="sprint-overview">
      <article><strong>${commands.length}</strong><span>actions queued</span></article>
      <article><strong>${high}</strong><span>high priority</span></article>
      <article><strong>${followUps}</strong><span>follow-ups</span></article>
      <article><strong>${tours}</strong><span>tour tasks</span></article>
      <article><strong>${recoveries}</strong><span>recoveries</span></article>
    </section>
    <section class="sprint-sequence">
      ${commands.slice(0, 7).map((command, index) => renderSprintStep(command, index)).join("")}
    </section>
    <p class="helper-text">Work from top to bottom. The queue refreshes after actions are completed, so the next best action stays current.</p>
  `;
}

function renderSprintStep(command, index) {
  return `
    <article class="sprint-step ${escapeHtml(command.status || "next")}">
      <div class="sprint-rank">${index + 1}</div>
      <div class="sprint-step-main">
        <div class="sprint-step-head">
          <span>${escapeHtml(commandLabel(command.type))}</span>
          <small>${escapeHtml(locationName(command.locationId))}${command.dueAt ? ` - ${escapeHtml(relativeTime(command.dueAt).text || "soon")}` : ""}</small>
        </div>
        <strong>${escapeHtml(command.title)}</strong>
        <p>${escapeHtml(command.impact || command.detail || "")}</p>
        <ul class="sprint-checklist">
          ${sprintChecklist(command).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      <div class="command-actions">
        ${commandActionButtons(command)}
      </div>
    </article>
  `;
}

function sprintChecklist(command) {
  if (command.type === "follow_up") {
    return [
      "Review the latest note before contacting the family.",
      "Complete the promised call, text, or email.",
      "Record the result and schedule the next follow-up."
    ];
  }
  if (command.type === "lead_contact") {
    return [
      "Call first while interest is fresh.",
      "Confirm care need, timeline, payment path, and preferred community.",
      "Move to contacted, schedule tour, or create a follow-up."
    ];
  }
  if (command.type === "lead_recovery") {
    return [
      "Open the lead and generate a human-reviewed recovery email.",
      "Personalize around the community and care type.",
      "Set a follow-up so the lead does not go quiet again."
    ];
  }
  if (command.type === "tour") {
    return [
      "Confirm the family has date, time, directions, and arrival instructions.",
      "Review care context and prepare talking points.",
      "After the tour, mark completed and set the next step."
    ];
  }
  return [
    "Open the related workflow.",
    "Resolve the operational blocker.",
    "Refresh the dashboard to confirm the signal cleared."
  ];
}

function renderAdmissionsCommandQueue() {
  const target = $("[data-command-queue]");
  if (!target) return;
  const commands = buildAdmissionsCommands();
  const count = $("[data-command-count]");
  if (count) count.textContent = `${commands.length} action${commands.length === 1 ? "" : "s"}`;
  target.innerHTML = commands.length ? commands.slice(0, 8).map(renderCommandItem).join("") : `
    <article class="command-item calm">
      <div>
        <strong>Admissions flow is clear</strong>
        <small>No urgent calls, overdue follow-ups, or tour confirmations need action right now.</small>
      </div>
    </article>
  `;
}

function buildAdmissionsCommands() {
  const commands = [];
  const now = Date.now();
  const leadById = new Map(app.leads.map((lead) => [lead.id, lead]));

  (app.operations?.followUps || []).forEach((item) => {
    if (INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase())) return;
    const due = item.due_at ? new Date(item.due_at).getTime() : 0;
    if (!due) return;
    const lead = leadById.get(item.lead_id);
    const late = due < now;
    if (late || due <= now + 24 * 3600000) {
      commands.push({
        id: `follow:${item.id}`,
        type: "follow_up",
        priority: late ? 120 : 82,
        title: late ? `Recover overdue follow-up: ${leadName(item.lead_id) || "Family"}` : `Follow up today: ${leadName(item.lead_id) || "Family"}`,
        detail: item.note || "Complete the promised follow-up and record the next step.",
        locationId: item.location_id,
        leadId: item.lead_id,
        sourceId: item.id,
        dueAt: due,
        impact: late ? "Protects trust and keeps the family from going cold." : "Keeps admissions momentum moving today.",
        primaryLabel: late ? "Mark done" : "Open lead",
        status: late ? "overdue" : "due_today"
      });
    }
  });

  app.leads.forEach((lead) => {
    if (["archived", "move_in"].includes(lead.status)) return;
    const score = estimateClientLeadScore(lead);
    const hoursOpen = hoursSince(lead.updated_at || lead.created_at);
    if (lead.status === "new" && (score >= 70 || hoursSince(lead.created_at) >= 2)) {
      commands.push({
        id: `lead:${lead.id}:contact`,
        type: "lead_contact",
        priority: score >= 70 ? 112 : 88,
        title: `Call ${lead.full_name || "new lead"}`,
        detail: score >= 70 ? "High-intent lead is still new." : "New inquiry is waiting for first contact.",
        locationId: lead.location_id,
        leadId: lead.id,
        phone: lead.phone,
        impact: "Fast first response is the highest-leverage admissions action.",
        primaryLabel: "Call + contact",
        status: score >= 70 ? "hot" : "new"
      });
    } else if (hoursOpen >= 96 && score >= 35) {
      commands.push({
        id: `lead:${lead.id}:recover`,
        type: "lead_recovery",
        priority: score >= 70 ? 96 : 72,
        title: `Recover ${lead.full_name || "stale lead"}`,
        detail: "Warm lead has not moved recently.",
        locationId: lead.location_id,
        leadId: lead.id,
        impact: "A personal recovery touch can bring this family back into motion.",
        primaryLabel: "Email draft",
        status: "stale"
      });
    }
  });

  (app.operations?.tours || []).forEach((tour) => {
    if (INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase())) return;
    const scheduled = tour.scheduled_at ? new Date(tour.scheduled_at).getTime() : 0;
    if (!scheduled) return;
    const hoursUntil = (scheduled - now) / 3600000;
    if (hoursUntil <= 48) {
      commands.push({
        id: `tour:${tour.id}`,
        type: "tour",
        priority: hoursUntil < 0 ? 118 : hoursUntil <= 24 ? 98 : 76,
        title: hoursUntil < 0 ? `Close out tour: ${leadName(tour.lead_id) || "Family"}` : `Prepare tour: ${leadName(tour.lead_id) || "Family"}`,
        detail: tour.notes || "Confirm timing, prepare talking points, and plan post-tour follow-up.",
        locationId: tour.location_id,
        leadId: tour.lead_id,
        sourceId: tour.id,
        dueAt: scheduled,
        impact: "Tours are the main path to move-ins.",
        primaryLabel: hoursUntil < 0 ? "Complete tour" : "Prep brief",
        status: hoursUntil < 0 ? "overdue" : "tour_ready"
      });
    }
  });

  (app.intelligence?.nextBestActions || []).forEach((action) => {
    if (!action?.id) return;
    commands.push({
      id: `intel:${action.id}`,
      type: "intelligence",
      priority: action.priority || 60,
      title: action.title,
      detail: action.why,
      locationId: action.locationId,
      leadId: action.leadId,
      eventId: action.eventId,
      impact: action.impact,
      primaryLabel: action.actionLabel || "Open",
      targetView: action.targetView || "leads",
      status: action.state || "next"
    });
  });

  const seen = new Set();
  return commands
    .sort((a, b) => b.priority - a.priority || (a.dueAt || Infinity) - (b.dueAt || Infinity))
    .filter((command) => {
      const key = [command.type, command.leadId || command.sourceId || command.id].join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderCommandItem(command) {
  return `
    <article class="command-item ${escapeHtml(command.status || "next")}">
      <div class="command-main">
        <div class="command-rank">${escapeHtml(commandLabel(command.type))}</div>
        <strong>${escapeHtml(command.title)}</strong>
        <small>${escapeHtml(locationName(command.locationId))}${command.dueAt ? ` - ${escapeHtml(relativeTime(command.dueAt).text || "soon")}` : ""}</small>
        <p>${escapeHtml(command.detail || "")}</p>
        <span>${escapeHtml(command.impact || "")}</span>
      </div>
      <div class="command-actions">
        ${commandActionButtons(command)}
      </div>
    </article>
  `;
}

function commandActionButtons(command) {
  if (command.type === "follow_up") {
    return `
      ${command.status === "overdue" ? `<button data-command-done-followup="${escapeHtml(command.sourceId)}"><i data-lucide="check"></i>Mark done</button>` : `<button data-intel-open-lead="${escapeHtml(command.leadId || "")}"><i data-lucide="panel-right-open"></i>Open lead</button>`}
      <button class="ghost" data-command-snooze-followup="${escapeHtml(command.sourceId)}"><i data-lucide="clock-3"></i>Snooze</button>
    `;
  }
  if (command.type === "lead_contact") {
    return `
      <button data-command-call="${escapeHtml(command.leadId)}"><i data-lucide="phone-call"></i>${escapeHtml(command.primaryLabel)}</button>
      <button class="ghost" data-command-email="${escapeHtml(command.leadId)}"><i data-lucide="mail"></i>Email</button>
    `;
  }
  if (command.type === "lead_recovery") {
    return `
      <button data-command-email="${escapeHtml(command.leadId)}"><i data-lucide="mail"></i>Email draft</button>
      <button class="ghost" data-intel-open-lead="${escapeHtml(command.leadId)}"><i data-lucide="panel-right-open"></i>Open</button>
    `;
  }
  if (command.type === "lead_review") {
    return `
      <button data-intel-open-lead="${escapeHtml(command.leadId)}"><i data-lucide="panel-right-open"></i>Open case</button>
      <button class="ghost" data-command-email="${escapeHtml(command.leadId)}"><i data-lucide="mail"></i>Email</button>
    `;
  }
  if (command.type === "tour") {
    return `
      <button data-tour-prep="${escapeHtml(command.sourceId)}"><i data-lucide="wand-sparkles"></i>${escapeHtml(command.primaryLabel)}</button>
      <button class="ghost" data-tour-link="${escapeHtml(command.sourceId)}"><i data-lucide="link"></i>Family link</button>
      ${command.status === "overdue" ? `<button class="ghost" data-command-complete-tour="${escapeHtml(command.sourceId)}"><i data-lucide="check-circle"></i>Complete</button>` : ""}
    `;
  }
  return `<button data-intel-view="${escapeHtml(command.targetView || "leads")}"><i data-lucide="arrow-right"></i>${escapeHtml(command.primaryLabel || "Open")}</button>`;
}

function renderDailyAdmissionsPlan() {
  const target = $("[data-daily-plan]");
  if (!target) return;
  const commands = buildAdmissionsCommands();
  const calls = commands.filter((item) => ["lead_contact", "follow_up"].includes(item.type)).length;
  const tours = commands.filter((item) => item.type === "tour").length;
  const recoveries = commands.filter((item) => item.type === "lead_recovery").length;
  const escalations = (app.intelligence?.events || []).filter((event) => ["critical", "high"].includes(event.severity)).length;
  const plan = [
    { label: "Calls and follow-ups", value: calls, detail: calls ? "Work these before new admin work." : "No urgent calls queued.", view: "followups", icon: "phone-call" },
    { label: "Tour confirmations", value: tours, detail: tours ? "Protect scheduled visits." : "No near-term tour risk.", view: "tours", icon: "calendar-check" },
    { label: "Recovery touches", value: recoveries, detail: recoveries ? "Bring stale families back into motion." : "No stale recovery push needed.", view: "leads", icon: "rotate-ccw" },
    { label: "Manager escalations", value: escalations, detail: escalations ? "High-pressure items need ownership." : "No high-pressure escalation.", view: "dashboard", icon: "send" }
  ];
  target.innerHTML = plan.map((item) => `
    <button class="plan-step ${item.value ? "active" : "calm"}" data-intel-view="${escapeHtml(item.view)}">
      <i data-lucide="${escapeHtml(item.icon)}"></i>
      <span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.label)}</small></span>
      <em>${escapeHtml(item.detail)}</em>
    </button>
  `).join("");
}

function renderTourReadiness() {
  const target = $("[data-tour-readiness]");
  if (!target) return;
  const now = Date.now();
  const upcoming = (app.operations?.tours || [])
    .filter((tour) => !INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase()))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 5);
  target.innerHTML = upcoming.length ? upcoming.map((tour) => {
    const lead = findLead(tour.lead_id) || {};
    const scheduled = tour.scheduled_at ? new Date(tour.scheduled_at).getTime() : 0;
    const followUpReady = (app.operations?.followUps || []).some((item) => item.lead_id === tour.lead_id && item.due_at && new Date(item.due_at).getTime() > scheduled);
    const checks = [
      { label: "Scheduled", done: Boolean(tour.scheduled_at) },
      { label: "Family confirmed", done: Boolean(tour.family_confirmed_at) || /confirm/i.test(`${tour.notes || ""}`) },
      { label: "Profile context", done: Boolean(lead.care_type || lead.notes_summary || lead.current_situation) },
      { label: "Post-tour follow-up", done: followUpReady }
    ];
    const ready = checks.filter((check) => check.done).length;
    return `
      <article class="tour-workflow-card">
        <div>
          <strong>${escapeHtml(lead.full_name || leadName(tour.lead_id) || "Scheduled tour")}</strong>
          <small>${escapeHtml(locationName(tour.location_id))} - ${escapeHtml(formatDate(tour.scheduled_at))}</small>
        </div>
        <div class="readiness-meter"><span style="width:${Math.round((ready / checks.length) * 100)}%"></span></div>
        <div class="readiness-checks">
          ${checks.map((check) => `<span class="${check.done ? "done" : "open"}">${check.done ? "&#10003;" : "&bull;"} ${escapeHtml(check.label)}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button class="ghost" data-tour-prep="${escapeHtml(tour.id)}"><i data-lucide="wand-sparkles"></i>Prep</button>
          <button class="ghost" data-tour-link="${escapeHtml(tour.id)}"><i data-lucide="link"></i>Family link</button>
          ${scheduled < now ? `<button data-command-complete-tour="${escapeHtml(tour.id)}"><i data-lucide="check-circle"></i>Complete</button>` : ""}
        </div>
      </article>
    `;
  }).join("") : empty("No upcoming tours need readiness work.");
}

function renderRevenueRisk() {
  const target = $("[data-risk-economics]");
  if (!target) return;
  const averageMonthlyRate = 5000;
  const atRiskLeads = app.leads.filter((lead) => {
    if (["move_in", "archived"].includes(lead.status)) return false;
    const score = estimateClientLeadScore(lead);
    const stale = hoursSince(lead.updated_at || lead.created_at) >= 72;
    return score >= 60 || stale || lead.status === "new";
  });
  const tourRisk = (app.operations?.tours || []).filter((tour) => !INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase()) && tour.scheduled_at && new Date(tour.scheduled_at).getTime() < Date.now() + 48 * 3600000).length;
  const overdue = (app.operations?.followUps || []).filter((item) => !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase()) && item.due_at && new Date(item.due_at).getTime() < Date.now()).length;
  const riskValue = atRiskLeads.length * averageMonthlyRate;
  target.innerHTML = `
    <div class="risk-hero">
      <small>Estimated monthly pipeline at risk</small>
      <strong>${formatMoney(riskValue)}</strong>
      <span>${atRiskLeads.length} active lead${atRiskLeads.length === 1 ? "" : "s"} need protection</span>
    </div>
    <div class="risk-grid">
      <button data-intel-view="leads"><strong>${atRiskLeads.length}</strong><span>Lead risks</span></button>
      <button data-intel-view="tours"><strong>${tourRisk}</strong><span>Tour risks</span></button>
      <button data-intel-view="followups"><strong>${overdue}</strong><span>Overdue</span></button>
    </div>
    <p>Use the command queue to protect response time, tour show-rate, and move-in probability.</p>
  `;
}

function renderLocationAccountability() {
  const target = $("[data-location-accountability]");
  if (!target) return;
  const comparison = app.dashboard?.locationComparison || [];
  const commands = buildAdmissionsCommands();
  target.innerHTML = comparison.length ? `
    <div class="accountability-row head">
      <span>Location</span><span>Risk</span><span>Open leads</span><span>Overdue</span><span>Tours</span><span>Move-ins</span><span></span>
    </div>
    ${comparison.map((row) => {
      const localCommands = commands.filter((command) => command.locationId === row.locationId).length;
      const localLeads = app.leads.filter((lead) => lead.location_id === row.locationId && !["move_in", "archived"].includes(lead.status)).length;
      const slaBreaches = app.leads.filter((lead) => lead.location_id === row.locationId && leadSlaState(lead)?.kind === "breach").length;
      const risk = row.overdueFollowUps + localCommands + slaBreaches >= 5 ? "High" : row.overdueFollowUps + localCommands + slaBreaches >= 2 ? "Watch" : "Stable";
      return `
        <div class="accountability-row ${risk.toLowerCase()}">
          <strong>${escapeHtml(row.name)}</strong>
          <span class="risk-pill ${risk.toLowerCase()}">${escapeHtml(risk)}</span>
          <span>${localLeads}</span>
          <span>${row.overdueFollowUps}</span>
          <span>${row.tours}</span>
          <span>${row.moveIns}</span>
          <button class="ghost" data-command-location="${escapeHtml(row.locationId)}">Focus</button>
        </div>
      `;
    }).join("")}
  ` : empty("No location accountability data yet.");
}

function renderOperationalFocus(focus) {
  const sequence = focus.recommendedSequence || [];
  const primary = focus.primaryAction || sequence[0] || null;
  const steps = focus.progressSteps || [];
  const progress = focus.progress || {};
  return `
    <article class="focus-surface ${escapeHtml(focus.state || "stable")}">
      <div class="focus-main">
        <div class="focus-state">
          <span>${escapeHtml(focus.mode || "Calm mode")}</span>
          <h3>${escapeHtml(focus.title || "Operations are stable")}</h3>
          <p>${escapeHtml(focus.summary || "No urgent admissions coordination issues are active right now.")}</p>
        </div>
        <div class="focus-why">
          <small>Why this matters</small>
          <p>${escapeHtml(focus.whyThisMatters || "Stable operations keep follow-ups predictable and families supported.")}</p>
        </div>
        <div class="mission-progress">
          <div class="mission-progress-head">
            <small>${escapeHtml(progress.label || "Mission progress")}</small>
            <strong>${escapeHtml(progress.summary || "Admissions flow is being monitored.")}</strong>
          </div>
          <div class="progress-steps">
            ${steps.length ? steps.map((step) => `
              <span class="progress-step ${escapeHtml(step.state || "active")}" title="${escapeHtml(step.detail || "")}">
                ${step.state === "complete" ? `<i data-lucide="check"></i>` : `<i data-lucide="loader-circle"></i>`}
                ${escapeHtml(step.label)}
              </span>
            `).join("") : `<span class="progress-step complete"><i data-lucide="check"></i>Flow stable</span>`}
          </div>
        </div>
        ${primary ? `
          <div class="focus-primary">
            <small>Highest priority &middot; ${escapeHtml(focus.focusWindow || "Today")}</small>
            <strong>${escapeHtml(primary.title)}</strong>
            <p>${escapeHtml(primary.impact)}</p>
            ${focusActionButton(primary)}
          </div>
        ` : ""}
      </div>
      <div class="focus-sequence">
        <div class="sequence-head">
          <strong>Recommended sequence</strong>
          <small>${sequence.length ? "Follow this order to stabilize admissions flow." : "No guided sequence needed."}</small>
        </div>
        ${sequence.length ? sequence.map(renderFocusAction).join("") : `
          <article class="sequence-item stable">
            <span>&#10003;</span>
            <div><strong>Continue planned follow-ups</strong><small>Operations are calm. No forced action needed.</small></div>
          </article>
        `}
      </div>
    </article>
  `;
}

function renderFocusAction(action) {
  return `
    <article class="sequence-item ${escapeHtml(action.state || "next")}">
      <span>${escapeHtml(action.rank || "")}</span>
      <div>
        <strong>${escapeHtml(action.title)}</strong>
        <small>${escapeHtml(action.why)} ${action.timeContext ? `&middot; ${escapeHtml(compactTimeContext(action.timeContext))}` : ""}</small>
        <p>${escapeHtml(action.impact || "")}</p>
      </div>
      ${focusActionButton(action)}
    </article>
  `;
}

function focusActionButton(action) {
  if (action.eventId && action.actionType === "generate_recovery") {
    return `<button data-intel-recovery="${action.eventId}"><i data-lucide="wand-sparkles"></i>${escapeHtml(action.actionLabel || "Generate Recovery Outreach")}</button>`;
  }
  if (action.eventId && action.actionType === "escalate") {
    return `<button data-intel-escalate="${action.eventId}"><i data-lucide="send"></i>${escapeHtml(action.actionLabel || "Escalate")}</button>`;
  }
  if (action.leadId) {
    return `<button data-intel-open-lead="${action.leadId}"><i data-lucide="panel-right-open"></i>${escapeHtml(action.actionLabel || "Open Lead")}</button>`;
  }
  return `<button data-intel-view="${escapeHtml(action.targetView || "leads")}"><i data-lucide="arrow-right"></i>${escapeHtml(action.actionLabel || "Open")}</button>`;
}

function renderZone(label, subtitle, rows, tone) {
  return `
    <section class="intel-zone ${tone}">
      <div class="zone-head">
        <div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(subtitle)}</small></div>
        <span>${rows.length}</span>
      </div>
      <div class="zone-list">
        ${rows.length ? rows.map(renderIntelligenceCard).join("") : empty(label === "Now" ? "Nothing urgent right now." : "No watch items in this scope.")}
      </div>
    </section>
  `;
}

function renderHealthyZone(rows) {
  return `
    <section class="intel-zone healthy">
      <div class="zone-head">
        <div><strong>Healthy</strong><small>Quiet signals</small></div>
        <span>${rows.filter((row) => row.status === "Healthy").length}</span>
      </div>
      <div class="healthy-grid">
        ${rows.length ? rows.map((row) => `
          <article class="healthy-chip ${row.status === "Healthy" ? "good" : "watch"}">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.status)}</span>
            <small>${escapeHtml(row.detail)}</small>
          </article>
        `).join("") : `<article class="healthy-chip good"><strong>Operations</strong><span>Healthy</span><small>No healthy indicators returned yet.</small></article>`}
      </div>
    </section>
  `;
}

function renderIntelligenceCard(event) {
  const timeText = compactTimeContext(event.time_context || event.detectedAgo || "");
  return `
    <article class="intelligence-card ${escapeHtml(event.severity)} ${escapeHtml(event.urgency || "watch")}">
      <div class="card-head">
        <span class="severity-dot ${escapeHtml(event.severity)}"></span>
        <strong>${escapeHtml(event.title)}</strong>
        <span class="badge">${escapeHtml(eventTypeLabel(event.event_type))}</span>
      </div>
      <div class="intel-meta">
        <span>${escapeHtml(locationName(event.location_id))}</span>
        <span>${escapeHtml(confidenceLabel(event.confidence))}</span>
        ${timeText ? `<span>${escapeHtml(timeText)}</span>` : ""}
      </div>
      <p>${escapeHtml(event.reason || event.description)}</p>
      ${event.escalation_context ? `<small class="escalation">${escapeHtml(event.escalation_context)}</small>` : ""}
      <p class="recommendation">${escapeHtml(event.recommendation || event.primaryActionLabel || "View details")}</p>
      <div class="card-actions">
        ${primaryActionButton(event)}
        ${event.entity_type === "lead" && event.entity_id ? `<button class="ghost" data-intel-open-lead="${event.entity_id}"><i data-lucide="panel-right-open"></i>View Details</button>` : ""}
        ${!event.transient ? `<button class="ghost" data-intel-status="${event.id}" data-status="resolved"><i data-lucide="check-circle"></i>Resolve</button>` : ""}
      </div>
      <output class="card-output" data-intel-output="${event.id}"></output>
    </article>
  `;
}

function primaryActionButton(event) {
  const label = event.primaryActionLabel || "View Details";
  const action = event.recommended_action_type || "view_details";
  if (action === "contact_lead" && event.entity_id) return `<button data-intel-open-lead="${event.entity_id}"><i data-lucide="phone-call"></i>${escapeHtml(label)}</button>`;
  if (action === "generate_recovery" && !event.transient) return `<button data-intel-recovery="${event.id}"><i data-lucide="wand-sparkles"></i>${escapeHtml(label)}</button>`;
  if (action === "generate_recovery" && event.entity_id) return `<button data-intel-open-lead="${event.entity_id}"><i data-lucide="panel-right-open"></i>Open Lead</button>`;
  if (action === "confirm_tour") return `<button data-intel-view="tours"><i data-lucide="calendar-check"></i>${escapeHtml(label)}</button>`;
  if (action === "open_queue") return `<button data-intel-view="${event.event_type === "follow_up_overdue" ? "followups" : "leads"}"><i data-lucide="list-checks"></i>${escapeHtml(label)}</button>`;
  if (action === "escalate" && !event.transient) return `<button data-intel-escalate="${event.id}"><i data-lucide="send"></i>${escapeHtml(label)}</button>`;
  return `<button data-intel-view="reports"><i data-lucide="bar-chart-3"></i>${escapeHtml(label)}</button>`;
}

function confidenceLabel(confidence = "medium") {
  return `${titleCase(confidence)} confidence`;
}

function compactTimeContext(value = "") {
  const text = String(value || "").replace(/^Detected\s+/i, "").trim();
  if (!text || text === "just now") return "";
  return text;
}

function severityPill(label, count) {
  return `<span class="severity-pill">${escapeHtml(label)} <strong>${escapeHtml(count)}</strong></span>`;
}

function eventTypeLabel(type = "") {
  return titleCase(String(type).replaceAll("_", " "));
}

function findLead(id) {
  return app.leads.find((lead) => lead.id === id) || null;
}

function findCommand(id) {
  return getCommandCenterItems().find((command) => command.id === id) || null;
}

function hoursSince(value) {
  const time = value ? new Date(value).getTime() : 0;
  if (!time || Number.isNaN(time)) return 0;
  return (Date.now() - time) / 3600000;
}

function estimateClientLeadScore(lead = {}) {
  if (Number.isFinite(Number(lead.lead_score))) return Number(lead.lead_score);
  if (Number.isFinite(Number(lead.score))) return Number(lead.score);
  const text = [
    lead.notes_summary,
    lead.current_situation,
    lead.move_timeline,
    lead.payment_type,
    lead.care_type,
    Array.isArray(lead.priority_tags) ? lead.priority_tags.join(" ") : lead.priority_tags,
    lead.status,
    lead.source
  ].join(" ").toLowerCase();
  let score = 0;
  if (text.includes("urgent") || text.includes("asap") || text.includes("immediate")) score += 32;
  if (text.includes("within 30") || text.includes("30 days")) score += 24;
  if (text.includes("memory")) score += 15;
  if (text.includes("tour") || text.includes("visit")) score += 16;
  if (text.includes("pricing") || text.includes("cost") || text.includes("rate")) score += 10;
  if (text.includes("hospital") || text.includes("discharge") || text.includes("unsafe") || text.includes("wandering")) score += 18;
  if (lead.source === "Tablet") score += 8;
  if (lead.phone) score += 6;
  if (lead.email) score += 4;
  if (lead.status === "tour_scheduled") score += 24;
  return Math.max(0, Math.min(100, score));
}

function commandLabel(type = "") {
  return {
    follow_up: "Follow-up",
    lead_contact: "Call",
    lead_recovery: "Recovery",
    lead_review: "Review",
    tour: "Tour",
    intelligence: "Signal"
  }[type] || "Action";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

async function snoozeFollowUp(id) {
  const item = (app.operations?.followUps || []).find((row) => row.id === id);
  if (!item) return pushToast("Follow-up not found.", "error");
  const command = getCommandCenterItems().find((entry) => entry.sourceId === id);
  const beforeCount = buildAdmissionsCommands().length;
  const due = new Date(Date.now() + 24 * 3600000);
  await fetchJson("/api/v2/follow-ups", {
    method: "POST",
    body: {
      locationId: item.location_id,
      leadId: item.lead_id || "",
      residentId: item.resident_id || "",
      dueAt: due.toISOString(),
      note: `Snoozed: ${item.note || "Follow up with this lead"}`
    }
  });
  await fetchJson(`/api/v2/follow-ups/${id}/status`, { method: "PATCH", body: { status: "completed" } });
  await refreshAfterWorkflowChange({ title: "Follow-up snoozed", beforeCount, command });
}

async function completeCommand(command) {
  if (!command) return pushToast("No active command is selected.", "error");
  const beforeCount = buildAdmissionsCommands().length;
  if (command.type === "follow_up" && command.sourceId) {
    await updateOperationStatus(`/api/v2/follow-ups/${command.sourceId}/status`, "completed", {
      title: "Follow-up recovered",
      beforeCount,
      command
    });
    return;
  }
  if (command.type === "lead_contact" && command.leadId) {
    await fetchJson(`/api/v2/leads/${command.leadId}/status`, { method: "PATCH", body: { status: "contacted" } });
    await refreshAfterWorkflowChange({
      title: "Lead marked contacted",
      beforeCount,
      command
    });
    return;
  }
  if (command.type === "tour" && command.sourceId && command.status === "overdue") {
    await updateOperationStatus(`/api/v2/tours/${command.sourceId}/status`, "completed", {
      title: "Tour completed",
      beforeCount,
      command
    });
    return;
  }
  pushToast("Open this workflow to complete the next step.", "info");
}

async function handleIntelligenceClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches("[data-intelligence-scan]")) {
    button.disabled = true;
    setStatus("Scanning operational signals...");
    try {
      const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
      const result = await fetchJson(`/api/v2/intelligence/scan${query}`, { method: "POST", timeoutMs: 30000 });
      setStatus(result.warning || "Operational scan complete.");
      await loadIntelligence();
    } finally {
      button.disabled = false;
    }
  }
  if (button.matches("[data-open-work-sprint]")) {
    openWorkSprint();
  }
  if (button.matches("[data-cc-command]")) {
    setActiveCommand(button.dataset.ccCommand);
  }
  if (button.matches("[data-cc-next]")) {
    moveToNextCommand();
  }
  if (button.matches("[data-intelligence-digest]")) {
    button.disabled = true;
    setStatus("Generating manager digest...");
    try {
      const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
      const result = await fetchJson(`/api/v2/intelligence/digest${query}`, { method: "POST", timeoutMs: 30000 });
      renderStructuredDigest(result);
      setStatus("");
    } finally {
      button.disabled = false;
    }
  }
  if (button.matches("[data-intel-status]")) {
    await fetchJson(`/api/v2/intelligence/events/${button.dataset.intelStatus}/status`, {
      method: "PATCH",
      body: { status: button.dataset.status }
    });
    await loadIntelligence();
  }
  if (button.matches("[data-intel-open-lead]")) {
    openLeadDetail(button.dataset.intelOpenLead);
  }
  if (button.matches("[data-intel-view]")) {
    setView(button.dataset.intelView);
  }
  if (button.matches("[data-view]")) {
    setView(button.dataset.view);
  }
  if (button.matches("[data-refresh]")) {
    await refreshAll();
  }
  if (button.matches("[data-operating-open-lead]")) {
    openLeadDetail(button.dataset.operatingOpenLead);
  }
  if (button.matches("[data-operating-action]")) {
    await updateOperatingPlanAction(button.dataset.operatingAction, button.dataset.action);
  }
  if (button.matches("[data-clear-operating-outcome]")) {
    app.operatingOutcome = null;
    renderDailyOperatingPlanHome();
  }
  if (button.matches("[data-intel-escalate]")) {
    await fetchJson(`/api/v2/intelligence/events/${button.dataset.intelEscalate}/status`, {
      method: "PATCH",
      body: { status: "acknowledged" }
    });
    const output = $(`[data-intel-output="${button.dataset.intelEscalate}"]`);
    if (output) output.textContent = "Escalated for manager review.";
    await loadIntelligence();
  }
  if (button.matches("[data-intel-recovery]")) {
    const output = $(`[data-intel-output="${button.dataset.intelRecovery}"]`);
    button.disabled = true;
    if (output) output.textContent = "Generating human-reviewed recovery draft...";
    try {
      const result = await fetchJson(`/api/v2/intelligence/events/${button.dataset.intelRecovery}/recovery-draft`, { method: "POST", timeoutMs: 30000 });
      if (output) output.textContent = result.draft || "No draft returned.";
    } finally {
      button.disabled = false;
    }
  }
  if (button.matches("[data-reserve-room]")) {
    await reserveRoomForLead(button.dataset.reserveRoom, button.dataset.leadId);
  }
  if (button.matches("[data-command-call]")) {
    const lead = findLead(button.dataset.commandCall);
    const command = getCommandCenterItems().find((item) => item.leadId === lead?.id && item.type === "lead_contact");
    const beforeCount = buildAdmissionsCommands().length;
    if (lead?.phone) window.location.href = `tel:${String(lead.phone).replace(/[^\d+]/g, "")}`;
    if (lead?.id) {
      await fetchJson(`/api/v2/leads/${lead.id}/status`, { method: "PATCH", body: { status: "contacted" } });
      await refreshAfterWorkflowChange({ title: "Lead marked contacted", beforeCount, command });
    }
  }
  if (button.matches("[data-command-email]")) {
    openLeadDetail(button.dataset.commandEmail);
  }
  if (button.matches("[data-command-done-followup]")) {
    const command = getCommandCenterItems().find((item) => item.sourceId === button.dataset.commandDoneFollowup);
    await updateOperationStatus(`/api/v2/follow-ups/${button.dataset.commandDoneFollowup}/status`, "completed", {
      title: "Follow-up recovered",
      beforeCount: buildAdmissionsCommands().length,
      command
    });
  }
  if (button.matches("[data-command-snooze-followup]")) {
    await snoozeFollowUp(button.dataset.commandSnoozeFollowup);
  }
  if (button.matches("[data-command-complete-tour]")) {
    const command = getCommandCenterItems().find((item) => item.sourceId === button.dataset.commandCompleteTour);
    await updateOperationStatus(`/api/v2/tours/${button.dataset.commandCompleteTour}/status`, "completed", {
      title: "Tour completed",
      beforeCount: buildAdmissionsCommands().length,
      command
    });
  }
  if (button.matches("[data-command-complete-active]")) {
    await completeCommand(findCommand(button.dataset.commandCompleteActive));
  }
  if (button.matches("[data-tour-prep]")) {
    openTourPrep(button.dataset.tourPrep);
  }
  if (button.matches("[data-tour-link]")) {
    copyTourFamilyLink(button.dataset.tourLink);
  }
  if (button.matches("[data-command-location]")) {
    app.selectedLocationId = button.dataset.commandLocation || "";
    const switcher = $("[data-location-switcher]");
    if (switcher) switcher.value = app.selectedLocationId;
    await refreshAll();
  }
}

function renderStructuredDigest(result) {
  const summary = result.summary || {};
  const sections = result.sections || [];
  $("[data-intelligence-brief]").innerHTML = `
    <div class="digest-summary">
      <strong>${escapeHtml(summary.title || "Today's Operational Summary")}</strong>
      <ul>
        ${(summary.bullets || [result.digest || "No digest returned."]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <small>${escapeHtml(summary.primaryAction || "Review operational signals")}</small>
      ${summary.whyThisMatters ? `<small>${escapeHtml(summary.whyThisMatters)}</small>` : ""}
    </div>
    <div class="severity-pills">
      <span class="severity-pill">${summary.cached || result.cached ? "Cached" : "Fresh"}</span>
      <span class="severity-pill">${escapeHtml(summary.provider || result.provider || "deterministic")}</span>
    </div>
  `;
  const target = $("[data-intelligence-zones]");
  if (!target || !sections.length) return;
  target.innerHTML = sections.map((section) => `
    <details class="digest-section ${escapeHtml(section.severity || "medium")}" ${section.severity === "high" ? "open" : ""}>
      <summary>
        <strong>${escapeHtml(section.label)}</strong>
        <span>${section.items?.length || 0}</span>
      </summary>
      <div class="digest-items">
        ${(section.items || []).length ? section.items.map((item) => `
          <article>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.timeContext || confidenceLabel(item.confidence || "medium"))}</small>
            <p>${escapeHtml(item.detail || "")}</p>
            <button class="ghost" data-intel-view="${item.actionType === "open_queue" ? "followups" : item.actionType === "confirm_tour" ? "tours" : "leads"}">${escapeHtml(item.action || "Open Queue")}</button>
          </article>
        `).join("") : empty("No items in this section.")}
      </div>
    </details>
  `).join("");
  iconRefresh();
}

function renderLeads() {
  const tbody = $("[data-leads-table]");
  if (!app.leads.length) {
    tbody.innerHTML = `<tr><td colspan="8">${empty("No leads found. Add a lead, check website form wiring, or import test data.")}</td></tr>`;
    renderLeadPipeline();
    setLeadView(app.leadView);
    renderOutreachPreview();
    return;
  }
  tbody.innerHTML = app.leads.map((lead) => {
    const selected = app.selectedLeadIds.has(lead.id);
    return `
    <tr class="${selected ? "row-selected" : ""}">
      <td><input type="checkbox" class="row-select" data-row-select="${lead.id}" ${selected ? "checked" : ""}></td>
      <td><strong>${escapeHtml(lead.full_name)}</strong>${leadBadgesHtml(lead)}<br><small>${escapeHtml(lead.email || "No email")}</small></td>
      <td>${escapeHtml(lead.phone)}</td>
      <td>${escapeHtml(locationName(lead.location_id))}</td>
      <td><span class="badge">${escapeHtml(lead.source)}</span></td>
      <td>
        <select class="status-select" data-status-select="${lead.id}">
          ${statusOptions(lead.status)}
        </select>
      </td>
      <td>${formatDate(lead.created_at)}</td>
      <td class="row-actions">
        <button class="ghost" data-open-lead="${lead.id}"><i data-lucide="panel-right-open"></i>Details</button>
        <button class="ghost" data-quick-followup="${lead.id}"><i data-lucide="bell-plus"></i>Follow up</button>
        ${lead.status === "archived" ? `<button class="ghost" data-restore-lead="${escapeHtml(lead.id)}"><i data-lucide="archive-restore"></i>Restore</button>` : ""}
        ${superDeleteButton("lead", lead.id)}
      </td>
    </tr>
  `;
  }).join("");
  $$("[data-row-select]").forEach((cb) => cb.addEventListener("change", (event) => {
    const id = event.target.dataset.rowSelect;
    const row = event.target.closest("tr");
    if (event.target.checked) { app.selectedLeadIds.add(id); row?.classList.add("row-selected"); }
    else { app.selectedLeadIds.delete(id); row?.classList.remove("row-selected"); }
    // Only update bulk bar counts, not full re-render
    const bar = $("[data-bulk-bar]");
    if (bar) bar.hidden = app.selectedLeadIds.size === 0;
    const countEl = $("[data-bulk-count]");
    if (countEl) countEl.textContent = app.selectedLeadIds.size;
    const sel = $("[data-bulk-select-all]");
    if (sel) sel.checked = app.selectedLeadIds.size > 0 && app.selectedLeadIds.size === app.leads.length;
  }));
  const bar = $("[data-bulk-bar]");
  const count = app.selectedLeadIds.size;
  bar.hidden = count === 0;
  $("[data-bulk-count]").textContent = count;
  const sel = $("[data-bulk-select-all]");
  if (sel) sel.checked = count > 0 && count === app.leads.length;

  $$("[data-status-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      if (select.dataset.updating === "true") return;
      const lead = app.leads.find((l) => l.id === select.dataset.statusSelect);
      const nextStatus = select.value;
      if (lead) select.value = lead.status;
      select.dataset.updating = "true";
      select.disabled = true;
      try {
        await moveLeadToStatus(select.dataset.statusSelect, nextStatus);
      } finally {
        select.dataset.updating = "";
        select.disabled = false;
      }
    });
  });
  $$("[data-quick-followup]").forEach((button) => {
    button.addEventListener("click", () => setQuickFollowUp(button.dataset.quickFollowup));
  });
  $$("[data-open-lead]").forEach((button) => {
    button.addEventListener("click", () => openLeadDetail(button.dataset.openLead));
  });
  $$("[data-restore-lead]").forEach((button) => {
    button.addEventListener("click", () => restoreLead(button.dataset.restoreLead));
  });
  bindHardDeleteButtons();
  renderLeadPipeline();
  setLeadView(app.leadView);
  renderExecutionSystem();
  renderOutreachPreview();
  renderLeadsPagination();
  iconRefresh();
}

function renderLeadsPagination() {
  const bar = $("[data-leads-pagination]");
  if (!bar) return;
  const { page, pageCount, total } = app.leadsPagination;
  if (pageCount <= 1) { bar.hidden = true; return; }
  bar.hidden = false;
  $("[data-leads-page-info]", bar).textContent = `Page ${page} of ${pageCount} (${total} leads)`;
  const prevBtn = $("[data-leads-prev]", bar);
  const nextBtn = $("[data-leads-next]", bar);
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= pageCount;
}

function hydrateOutreachFilters() {
  const source = $("[data-outreach-source]");
  const careType = $("[data-outreach-care-type]");
  if (!source || !careType) return;
  replaceSelectOptions(source, "All sources", uniqueSorted(app.leads.map((lead) => lead.source)));
  replaceSelectOptions(careType, "All care types", uniqueSorted(app.leads.map((lead) => lead.care_type)));
}

function replaceSelectOptions(select, defaultLabel, values) {
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(defaultLabel)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(current)) select.value = current;
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function currentOutreachFilters() {
  const filters = {};
  if (app.selectedLocationId) filters.locationId = app.selectedLocationId;
  const status = $("[data-outreach-status]")?.value || "";
  const source = $("[data-outreach-source]")?.value || "";
  const careType = $("[data-outreach-care-type]")?.value || "";
  const search = $("[data-outreach-search]")?.value.trim() || "";
  if (status) filters.status = status;
  if (source) filters.source = source;
  if (careType) filters.careType = careType;
  if (search) filters.search = search;
  if ($("[data-outreach-selected-only]")?.checked) filters.ids = [...app.selectedLeadIds];
  return filters;
}

function matchingOutreachLeads(filters = currentOutreachFilters()) {
  const ids = Array.isArray(filters.ids) ? new Set(filters.ids) : null;
  const needle = String(filters.search || "").toLowerCase();
  return app.leads.filter((lead) => {
    if (ids && !ids.has(lead.id)) return false;
    if (!ids && lead.status === "archived") return false;
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.careType && lead.care_type !== filters.careType) return false;
    if (needle) {
      const haystack = `${lead.full_name || ""} ${lead.email || ""} ${lead.phone || ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function renderOutreachPreview() {
  const stats = $("[data-outreach-stats]");
  if (!stats) return;
  const selectedCount = app.selectedLeadIds.size;
  const selectedLabel = $("[data-outreach-selected-count]");
  if (selectedLabel) selectedLabel.textContent = `${selectedCount} selected`;
  const filters = currentOutreachFilters();
  const leads = matchingOutreachLeads(filters);
  const mailable = leads.filter((lead) => isLikelyEmail(lead.email)).length;
  const invalid = leads.length - mailable;
  const selectedOnly = Boolean(filters.ids);
  const recipientBadge = $("[data-outreach-recipient-count]");
  if (recipientBadge) recipientBadge.textContent = `${mailable} mailable`;
  stats.innerHTML = `
    <article><strong>${leads.length}</strong><span>${selectedOnly ? "Selected match" : "Matching leads"}</span></article>
    <article><strong>${mailable}</strong><span>Valid emails</span></article>
    <article><strong>${invalid}</strong><span>Missing/invalid emails</span></article>
    <article><strong>${Math.min(mailable, 75)}</strong><span>Send cap</span></article>
  `;
}

async function draftMassOutreach() {
  const button = $("[data-outreach-draft]");
  const subject = $("[data-outreach-subject]");
  const body = $("[data-outreach-body]");
  button.disabled = true;
  setOutreachStatus("Generating campaign draft...");
  try {
    const data = await fetchJson("/api/v2/outreach/draft", {
      method: "POST",
      body: { filters: currentOutreachFilters(), subjectHint: subject.value },
      timeoutMs: 30000
    });
    subject.value = data.subject || "";
    body.value = data.body || "";
    setOutreachStatus(`Template ready for ${data.recipients || 0} mailable lead${data.recipients === 1 ? "" : "s"}.`);
    renderOutreachPreview();
  } catch (err) {
    setOutreachStatus(err.message || "Could not draft campaign.", true);
  } finally {
    button.disabled = false;
  }
}

async function sendMassOutreachTest() {
  const testRecipient = $("[data-outreach-test-recipient]").value.trim();
  if (!testRecipient) return setOutreachStatus("Enter a test recipient first.", true);
  await submitMassOutreach({
    testRecipient,
    statusText: "Sending test email...",
    button: $("[data-outreach-test]"),
    successRefresh: false
  });
}

async function sendMassOutreachCampaign({ demoOnly }) {
  const filters = currentOutreachFilters();
  const count = matchingOutreachLeads(filters).filter((lead) => isLikelyEmail(lead.email)).length;
  const subject = $("[data-outreach-subject]").value.trim();
  if (!subject || !$("[data-outreach-body]").value.trim()) return setOutreachStatus("Subject and email body are required.", true);
  const action = demoOnly ? "log a demo campaign for" : "send LIVE emails to";
  const confirmed = await showConfirm(
    demoOnly ? "Demo campaign" : "Send live campaign",
    `This will ${action} ${Math.min(count, 75)} lead${count === 1 ? "" : "s"} matching the current filters. Subject: "${subject}"`
  );
  if (!confirmed) return;
  await submitMassOutreach({
    demoOnly,
    statusText: demoOnly ? "Logging demo campaign..." : "Sending live campaign...",
    button: demoOnly ? $("[data-outreach-demo]") : $("[data-outreach-live]"),
    successRefresh: true
  });
}

async function submitMassOutreach({ demoOnly = false, testRecipient = "", statusText, button, successRefresh }) {
  const subject = $("[data-outreach-subject]").value.trim();
  const body = $("[data-outreach-body]").value.trim();
  const campaignName = $("[data-outreach-campaign-name]").value.trim() || subject;
  if (!subject || !body) return setOutreachStatus("Subject and email body are required.", true);
  button.disabled = true;
  setOutreachStatus(statusText);
  try {
    const data = await fetchJson("/api/v2/outreach/send", {
      method: "POST",
      body: { filters: currentOutreachFilters(), subject, body, campaignName, demoOnly, testRecipient },
      timeoutMs: 120000
    });
    setOutreachStatus(data.message || "Outreach complete.");
    pushToast(data.message || "Outreach complete.", "success");
    if (successRefresh) await refreshAll();
    else await loadOutreachHistory();
  } catch (err) {
    setOutreachStatus(err.message || "Outreach failed.", true);
  } finally {
    button.disabled = false;
  }
}

function renderOutreachHistory() {
  const target = $("[data-outreach-history]");
  if (!target) return;
  const campaigns = app.outreach?.campaigns || [];
  if (!campaigns.length) {
    target.innerHTML = empty($("[data-outreach-show-archived]")?.checked ? "No archived campaigns." : "No campaigns logged yet.");
    return;
  }
  target.innerHTML = campaigns.map((campaign) => {
    const recipients = campaign.recipients || [];
    const recipientPreview = recipients.length
      ? recipients.slice(0, 6).map((recipient) => `
        <li><span>${escapeHtml(recipient.email || "Recipient")}</span><small>${escapeHtml([recipient.status, formatDate(recipient.createdAt)].filter(Boolean).join(" - "))}</small></li>
      `).join("")
      : `<li><span>No recipient details yet</span><small>Campaign marker only</small></li>`;
    return `
      <details class="campaign-history-item">
        <summary>
          <span>
            <strong>${escapeHtml(campaign.name || campaign.subject || "Mass outreach campaign")}</strong>
            <small>${escapeHtml(formatDate(campaign.createdAt))}${campaign.archived ? " - Archived" : ""}</small>
          </span>
          <span class="campaign-pill">${escapeHtml(campaign.mode || "Campaign")} - ${Number(campaign.recipientCount || 0)} leads</span>
        </summary>
        <div class="campaign-history-detail">
          <dl>
            <div><dt>Sent</dt><dd>${Number(campaign.sent || 0)}</dd></div>
            <div><dt>Failed</dt><dd>${Number(campaign.failed || 0)}</dd></div>
            <div><dt>Total</dt><dd>${Number(campaign.recipientCount || 0)}</dd></div>
          </dl>
          <p><strong>Subject:</strong> ${escapeHtml(campaign.subject || "No subject")}</p>
          <ul>${recipientPreview}</ul>
          <button class="ghost" type="button" data-outreach-archive="${escapeHtml(campaign.id)}" data-archived="${campaign.archived ? "true" : "false"}">
            <i data-lucide="${campaign.archived ? "archive-restore" : "archive"}"></i>${campaign.archived ? "Restore" : "Archive"}
          </button>
        </div>
      </details>
    `;
  }).join("");
  $$("[data-outreach-archive]", target).forEach((button) => {
    button.addEventListener("click", () => archiveMassOutreachCampaign(button));
  });
  iconRefresh();
}

async function archiveMassOutreachCampaign(button) {
  const campaignId = button.dataset.outreachArchive;
  const isArchived = button.dataset.archived === "true";
  if (!campaignId) return;
  const actionText = isArchived ? "restore" : "archive";
  const confirmed = await showConfirm(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)} campaign`, `Are you sure you want to ${actionText} this campaign?`);
  if (!confirmed) return;
  button.disabled = true;
  try {
    await fetchJson("/api/v2/outreach/archive", {
      method: "POST",
      body: { campaignId, archived: !isArchived, locationId: app.selectedLocationId }
    });
    await loadOutreachHistory();
    pushToast(isArchived ? "Campaign restored." : "Campaign archived.", "success");
  } catch (err) {
    setOutreachStatus(err.message || "Could not update campaign.", true);
    button.disabled = false;
  }
}

function setOutreachStatus(message, isError = false) {
  const out = $("[data-outreach-status-output]");
  if (!out) return;
  out.textContent = message || "";
  out.classList.toggle("error", Boolean(isError));
}

function setLeadView(view) {
  app.leadView = view === "pipeline" ? "pipeline" : "table";
  localStorage.setItem("ccsl:v2-lead-view", app.leadView);
  $$("[data-lead-view]").forEach((btn) => {
    const on = btn.dataset.leadView === app.leadView;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  $("[data-lead-table-wrap]").hidden = app.leadView !== "table";
  $("[data-lead-pipeline]").hidden = app.leadView !== "pipeline";
  if (app.leadView === "pipeline") renderLeadPipeline();
}

function renderLeadPipeline() {
  const pipeline = $("[data-lead-pipeline]");
  if (!pipeline) return;
  const groups = new Map(PIPELINE_COLUMNS.map((c) => [c.status, []]));
  app.leads.forEach((lead) => {
    if (groups.has(lead.status)) groups.get(lead.status).push(lead);
  });
  pipeline.innerHTML = PIPELINE_COLUMNS.map((col) => {
    const items = groups.get(col.status) || [];
    return `
      <section class="pipeline-column ${col.muted ? "archived" : ""}" data-status="${col.status}">
        <div class="pipeline-col-head"><strong>${escapeHtml(col.label)}</strong><span>${items.length}</span></div>
        ${items.length ? items.map(renderPipelineCard).join("") : `<div class="pipeline-empty">No ${escapeHtml(col.label.toLowerCase())} leads. New form submissions appear automatically.</div>`}
      </section>
    `;
  }).join("");
  $$(".pipeline-card", pipeline).forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", card.dataset.leadId);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openLeadDetail(card.dataset.leadId);
    });
  });
  iconRefresh();
}

function renderPipelineCard(lead) {
  const stageTime = lead.updated_at || lead.created_at;
  const rel = relativeTime(stageTime);
  const ageMin = Math.abs(rel.diffMin || 0);
  const aging = ageMin >= 60 * 24 * 3 ? "aging-high" : ageMin >= 60 * 24 ? "aging-warn" : "";
  const ageText = ageMin < 60 ? `${ageMin}m in stage` : ageMin < 60 * 24 ? `${Math.round(ageMin / 60)}h in stage` : `${Math.round(ageMin / (60 * 24))}d in stage`;
  return `
    <article class="pipeline-card ${aging}" draggable="true" data-lead-id="${escapeHtml(lead.id)}">
      <div class="pipeline-card-name">
        <strong>${escapeHtml(lead.full_name || "Unnamed lead")}${leadBadgesHtml(lead)}</strong>
        <span class="pipeline-stage-age">${escapeHtml(ageText)}</span>
      </div>
      <div class="pipeline-card-meta">
        <span>${escapeHtml(locationName(lead.location_id))}</span>
        ${lead.care_type ? `<span>${escapeHtml(lead.care_type)}</span>` : ""}
        ${lead.source ? `<span>${escapeHtml(lead.source)}</span>` : ""}
      </div>
      <div class="pipeline-card-actions">
        <button data-pipeline-open="${escapeHtml(lead.id)}"><i data-lucide="panel-right-open"></i>Open</button>
        <details class="card-more">
          <summary>More</summary>
          <button class="ghost" data-pipeline-followup="${escapeHtml(lead.id)}"><i data-lucide="bell-plus"></i>Follow up</button>
        </details>
      </div>
    </article>
  `;
}

async function moveLeadToStatus(leadId, status) {
  const lead = app.leads.find((l) => l.id === leadId);
  if (!lead || lead.status === status) return;
  if (status === "archived") return openArchiveModal(leadId);
  if (["contacted", "tour_scheduled", "move_in"].includes(status)) return openPipelineTransition(leadId, status);
  return applyLeadStatusOnly(leadId, status);
}

async function applyLeadStatusOnly(leadId, status) {
  const lead = app.leads.find((l) => l.id === leadId);
  if (!lead || lead.status === status) return;
  const previous = lead.status;
  lead.status = status;
  lead.updated_at = new Date().toISOString();
  renderLeadPipeline();
  try {
    await fetchJson(`/api/v2/leads/${leadId}/status`, { method: "PATCH", body: { status } });
    pushToast(`Moved to ${statusLabel(status)}`, "success");
    refreshAfterWorkflowChange().catch(() => {});
  } catch (err) {
    lead.status = previous;
    renderLeadPipeline();
    pushToast(err.message || "Failed to update status", "error");
  }
}

function openPipelineTransition(leadId, status) {
  const lead = app.leads.find((item) => item.id === leadId);
  if (!lead) return;
  app.pendingPipelineTransition = { leadId, status };
  const form = $("[data-pipeline-transition-form]");
  form?.reset();
  $$("[data-pipeline-transition-section]").forEach((section) => {
    const active = section.dataset.pipelineTransitionSection === status;
    section.hidden = !active;
    section.querySelectorAll("input, select").forEach((input) => {
      input.required = active && ((status === "tour_scheduled" && input.name === "tourAt") || (status === "move_in" && input.name === "roomId"));
    });
  });
  const copy = {
    contacted: "Log contact outcome. Optional follow-up keeps next commitment visible.",
    tour_scheduled: "Schedule real tour date/time before moving lead to Tour scheduled.",
    move_in: "Choose room before move-in so lead, resident, room, revenue, and workflow stay synced."
  }[status] || "Capture needed details before changing stage.";
  $("[data-pipeline-transition-title]").textContent = `${lead.full_name || "Lead"} -> ${statusLabel(status)}`;
  $("[data-pipeline-transition-copy]").textContent = copy;
  hydratePipelineRoomSelect(lead);
  $("[data-pipeline-transition-modal]")?.showModal();
  iconRefresh();
}

function hydratePipelineRoomSelect(lead = {}) {
  const select = $("[data-pipeline-room]");
  if (!select) return;
  const rooms = (app.operations?.rooms || []).filter((room) => {
    const status = roomCurrentStatus(room);
    return room.location_id === lead.location_id && ["available", "reserved"].includes(status) && !room.current_resident_id && (!room.reserved_for_lead_id || room.reserved_for_lead_id === lead.id);
  });
  select.innerHTML = `<option value="">Choose room...</option>${rooms.map((room) => `
    <option value="${escapeHtml(room.id)}">Room ${escapeHtml(room.room_number || "")} - ${escapeHtml(roomStatusLabel(roomCurrentStatus(room)))}${room.monthly_rate ? ` - ${formatMoney(room.monthly_rate)}/mo` : ""}</option>
  `).join("")}`;
}

async function handlePipelineTransitionSubmit(event) {
  event.preventDefault();
  const pending = app.pendingPipelineTransition;
  if (!pending) return;
  const lead = app.leads.find((item) => item.id === pending.leadId);
  if (!lead) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    if (button) button.disabled = true;
    if (pending.status === "contacted") {
      await fetchJson(`/api/v2/leads/${lead.id}/status`, { method: "PATCH", body: { status: "contacted" } });
      if (body.followUpAt) {
        await fetchJson("/api/v2/follow-ups", { method: "POST", body: { leadId: lead.id, dueAt: body.followUpAt, note: body.contactNote || "Follow up from pipeline transition" } });
      }
    } else if (pending.status === "tour_scheduled") {
      await fetchJson("/api/v2/tours", { method: "POST", body: { leadId: lead.id, scheduledAt: body.tourAt, notes: body.tourNotes || "Scheduled from admissions pipeline" } });
    } else if (pending.status === "move_in") {
      await fetchJson("/api/v2/residents", { method: "POST", body: { leadId: lead.id, roomId: body.roomId, fullName: lead.full_name, moveInDate: body.moveInDate || "", notes: "Move-in completed from admissions pipeline." } });
    }
    $("[data-pipeline-transition-modal]")?.close();
    app.pendingPipelineTransition = null;
    pushToast(`Moved to ${statusLabel(pending.status)}.`, "success");
    await refreshAll();
  } catch (err) {
    pushToast(err.message || "Could not move lead.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function openCommandPalette() {
  const dialog = $("[data-cmdk]");
  const input = $("[data-cmdk-input]");
  if (!dialog || !input || !app.session) return;
  if (!dialog.open) dialog.showModal();
  input.value = "";
  app.cmdk.activeIndex = 0;
  renderCommandPalette();
  setTimeout(() => input.focus(), 0);
}

function buildCmdkItems(query) {
  const q = query.trim().toLowerCase();
  const views = [
    { kind: "view", title: "Dashboard",  detail: "Operational intelligence", icon: "layout-dashboard", view: "dashboard" },
    { kind: "view", title: "Leads",      detail: "Admissions CRM",          icon: "users",             view: "leads" },
    { kind: "view", title: "Tours",      detail: "Tour calendar",           icon: "calendar-days",     view: "tours" },
    { kind: "view", title: "Follow-ups", detail: "Reminders queue",         icon: "bell-ring",         view: "followups" },
    { kind: "view", title: "Tasks",      detail: "Staff tasks",             icon: "list-checks",       view: "tasks" },
    { kind: "view", title: "Rooms",      detail: "Room inventory",          icon: "door-open",         view: "rooms" },
    { kind: "view", title: "Residents",  detail: "Move-ins",                icon: "bed-double",        view: "residents" },
    { kind: "view", title: "Activity",   detail: "Audit timeline",          icon: "history",           view: "activity" },
    { kind: "view", title: "Reports",    detail: "Performance",             icon: "bar-chart-3",       view: "reports" }
  ];
  const actions = [
    { kind: "action", title: "Add lead",        detail: "Create new lead",     icon: "user-plus",  run: openCreateLead },
    { kind: "action", title: "Refresh data",    detail: "Reload all panels",   icon: "refresh-cw", run: () => refreshAll() },
    { kind: "action", title: "Run intel scan",  detail: "Manual signal scan",  icon: "radar",      run: () => $("[data-intelligence-scan]").click() },
    { kind: "action", title: "Morning brief",   detail: "AI summary for today", icon: "sun",       run: openMorningBrief },
    { kind: "action", title: "Triage inbound",  detail: "Paste a message",     icon: "wand-sparkles", run: openTriage },
    { kind: "action", title: "Merge leads",     detail: "Combine duplicates",  icon: "git-merge",     run: openMergeModal },
    { kind: "action", title: "Export leads CSV",detail: "Download current",    icon: "download",   run: handleLeadExport },
    { kind: "action", title: "Toggle pipeline", detail: "Switch lead view",    icon: "kanban-square", run: () => { setView("leads"); setLeadView(app.leadView === "table" ? "pipeline" : "table"); } },
    { kind: "action", title: "Log out",         detail: "End session",         icon: "log-out",    run: handleLogout }
  ];
  const leads = app.leads.slice(0, 80).map((lead) => ({
    kind: "lead",
    title: lead.full_name || "Unnamed lead",
    detail: `${statusLabel(lead.status)} - ${locationName(lead.location_id)}${lead.phone ? ` - ${lead.phone}` : ""}`,
    icon: "user",
    leadId: lead.id,
    haystack: `${lead.full_name || ""} ${lead.email || ""} ${lead.phone || ""}`.toLowerCase()
  }));
  const all = [...views, ...actions, ...leads];
  if (!q) return all.slice(0, 30);
  return all.filter((item) => (item.haystack || `${item.title} ${item.detail}`.toLowerCase()).includes(q)).slice(0, 30);
}

function renderCommandPalette() {
  const results = $("[data-cmdk-results]");
  const input = $("[data-cmdk-input]");
  if (!results || !input) return;
  const items = buildCmdkItems(input.value);
  app.cmdk.items = items;
  if (app.cmdk.activeIndex >= items.length) app.cmdk.activeIndex = 0;
  if (!items.length) { results.innerHTML = `<div class="cmdk-empty">No matches</div>`; return; }
  const sections = { view: [], action: [], lead: [] };
  items.forEach((item, idx) => sections[item.kind]?.push({ ...item, idx }));
  const labels = { view: "Views", action: "Actions", lead: "Leads" };
  results.innerHTML = ["view", "action", "lead"].map((kind) => {
    if (!sections[kind].length) return "";
    return `
      <div class="cmdk-section">
        <div class="cmdk-section-label">${labels[kind]}</div>
        ${sections[kind].map((item) => `
          <div class="cmdk-item ${item.idx === app.cmdk.activeIndex ? "active" : ""}" data-cmdk-index="${item.idx}">
            <i data-lucide="${item.icon}"></i>
            <div class="cmdk-item-body">
              <span class="cmdk-item-title">${escapeHtml(item.title)}</span>
              <span class="cmdk-item-detail">${escapeHtml(item.detail || "")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
  iconRefresh();
}

function moveCmdkActive(delta) {
  const len = app.cmdk.items.length;
  if (!len) return;
  app.cmdk.activeIndex = (app.cmdk.activeIndex + delta + len) % len;
  renderCommandPalette();
  const active = $(".cmdk-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

async function copyTourFamilyLink(tourId) {
  try {
    const data = await fetchJson(`/api/v2/tours/${tourId}/public-link`);
    const url = `${location.origin}${data.path}`;
    await navigator.clipboard.writeText(url);
    pushToast("Family link copied to clipboard", "success");
  } catch (err) {
    pushToast(err.message || "Could not copy link", "error");
  }
}

function runActiveCmdk() {
  const item = app.cmdk.items[app.cmdk.activeIndex];
  if (!item) return;
  $("[data-cmdk]").close();
  if (item.kind === "view") setView(item.view);
  else if (item.kind === "action") item.run();
  else if (item.kind === "lead") openLeadDetail(item.leadId);
}

async function loadCheckIns() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  const data = await fetchJson(`/api/v2/check-ins${query}`);
  app.checkIns = data.checkIns || [];
  markFresh("checkIns");
  renderCheckIns();
}

function renderOperations() {
  renderTodayWorkHome();
  renderSystemHealth();
  renderRoomOccupancy();
  renderRoomReadinessSla();
  renderRooms();
  renderDashboardRoomBoard();
  renderMoveInWorkflows();
  hydrateResidentRoomSelect();
  renderRevenueCommand();
  renderCalendarIntegration();
  renderTourConversionCoach();
  renderTourWorkflowBoard();
  renderCards("[data-tours-list]", app.operations.tours, (tour) => `
    <div class="card-head"><strong>${escapeHtml(leadName(tour.lead_id))}</strong><span class="badge">${escapeHtml(tour.status)}</span></div>
    <small>${formatDate(tour.scheduled_at)} &middot; ${escapeHtml(locationName(tour.location_id))}</small>
    <small>${escapeHtml(tour.notes || "")}</small>
    ${renderTourCalendarStatus(tour)}
    <div class="tour-sync-edit">
      <input type="datetime-local" data-tour-time="${escapeHtml(tour.id)}" value="${escapeHtml(toLocalDatetime(new Date(tour.scheduled_at || Date.now())))}">
      <input data-tour-notes="${escapeHtml(tour.id)}" value="${escapeHtml(tour.notes || "")}" placeholder="Tour notes">
      <button class="ghost" data-tour-reschedule="${escapeHtml(tour.id)}"><i data-lucide="calendar-clock"></i>Update + sync</button>
    </div>
    <div class="card-actions">
      <button data-tour-status="${tour.id}" data-status="completed"><i data-lucide="check-circle"></i>Complete</button>
      <button class="ghost" data-tour-link="${tour.id}"><i data-lucide="link"></i>Family link</button>
      <button class="ghost" data-tour-prep="${tour.id}"><i data-lucide="wand-sparkles"></i>Prep brief</button>
      <details class="card-more">
        <summary>More</summary>
        <button class="ghost" data-tour-status="${tour.id}" data-status="no_show"><i data-lucide="circle-off"></i>No-show</button>
        <button class="ghost" data-tour-status="${tour.id}" data-status="cancelled"><i data-lucide="x-circle"></i>Cancel</button>
        <button class="ghost" data-tour-calendar-push="${escapeHtml(tour.id)}"><i data-lucide="upload-cloud"></i>Push to Google</button>
        <button class="ghost" data-tour-calendar-pull="${escapeHtml(tour.id)}"><i data-lucide="download-cloud"></i>Pull from Google</button>
      </details>
      ${superDeleteButton("tour", tour.id)}
    </div>
  `);
  $$("[data-tour-link]").forEach((btn) => btn.addEventListener("click", () => copyTourFamilyLink(btn.dataset.tourLink)));
  $$("[data-tour-prep]").forEach((btn) => btn.addEventListener("click", () => openTourPrep(btn.dataset.tourPrep)));
  renderCards("[data-followups-list]", app.operations.followUps, (item) => `
    <div class="card-head"><strong>${escapeHtml(leadName(item.lead_id) || "Resident follow-up")}</strong><span class="badge">${escapeHtml(item.status)}</span></div>
    <small>${formatDate(item.due_at)} &middot; ${escapeHtml(locationName(item.location_id))}</small>
    <small>${escapeHtml(item.note || "")}</small>
    <div class="card-actions">
      <button data-followup-status="${item.id}" data-status="completed"><i data-lucide="check"></i>Done</button>
      <details class="card-more">
        <summary>More</summary>
        <button class="ghost" data-followup-status="${item.id}" data-status="missed"><i data-lucide="clock-alert"></i>Missed</button>
        <button class="ghost" data-followup-status="${item.id}" data-status="archived"><i data-lucide="archive"></i>Archive</button>
        ${superDeleteButton("follow-up", item.id)}
      </details>
    </div>
  `);
  renderCards("[data-tasks-list]", app.operations.tasks, (task) => `
    <div class="card-head"><strong>${escapeHtml(task.title)}</strong><span class="badge">${escapeHtml(task.status)}</span></div>
    <small>${escapeHtml(locationName(task.location_id))}${task.due_at ? ` &middot; ${formatDate(task.due_at)}` : ""}</small>
    <small>${escapeHtml(task.notes || "")}</small>
    <div class="card-actions">
      ${task.status === "in_progress"
        ? `<button data-task-status="${task.id}" data-status="done"><i data-lucide="check"></i>Done</button>`
        : `<button data-task-status="${task.id}" data-status="in_progress"><i data-lucide="play"></i>Start</button>`}
      <details class="card-more">
        <summary>More</summary>
        <button class="ghost" data-task-status="${task.id}" data-status="done"><i data-lucide="check"></i>Done</button>
        <button class="ghost" data-task-status="${task.id}" data-status="archived"><i data-lucide="archive"></i>Archive</button>
        ${superDeleteButton("task", task.id)}
      </details>
    </div>
  `);
  renderCards("[data-residents-list]", app.operations.residents, renderResidentCard);
  renderCards("[data-documents-list]", app.operations.documents, (doc) => `
    <div class="card-head"><strong>${escapeHtml(doc.file_name)}</strong><span class="badge">${escapeHtml(doc.document_type)}</span></div>
    <small>${escapeHtml(locationName(doc.location_id))} &middot; ${escapeHtml(doc.file_type || "file")}</small>
    <button class="ghost" data-open-doc="${doc.id}"><i data-lucide="external-link"></i>Open</button>
  `);
  $$("[data-tour-status]").forEach((button) => {
    button.addEventListener("click", () => updateOperationStatus(`/api/v2/tours/${button.dataset.tourStatus}/status`, button.dataset.status));
  });
  $$("[data-tour-reschedule]").forEach((button) => {
    button.addEventListener("click", () => updateTourDetails(button.dataset.tourReschedule));
  });
  $$("[data-tour-calendar-push]").forEach((button) => {
    button.addEventListener("click", () => resyncTourCalendar(button.dataset.tourCalendarPush));
  });
  $$("[data-tour-calendar-pull]").forEach((button) => {
    button.addEventListener("click", () => pullTourCalendar(button.dataset.tourCalendarPull));
  });
  $$("[data-followup-status]").forEach((button) => {
    button.addEventListener("click", () => updateOperationStatus(`/api/v2/follow-ups/${button.dataset.followupStatus}/status`, button.dataset.status));
  });
  $$("[data-task-status]").forEach((button) => {
    button.addEventListener("click", () => updateOperationStatus(`/api/v2/tasks/${button.dataset.taskStatus}/status`, button.dataset.status));
  });
  $$("[data-resident-left]").forEach((button) => {
    button.addEventListener("click", () => openRoomConditionModal(button.dataset.residentLeft));
  });
  $$("[data-resident-active]").forEach((button) => {
    button.addEventListener("click", () => updateResidentStatus(button.dataset.residentActive, { status: "active" }));
  });
  $$("[data-open-doc]").forEach((button) => {
    button.addEventListener("click", async () => {
      await withButtonLoading(button, async () => {
        const data = await fetchJson(`/api/v2/documents/${button.dataset.openDoc}/signed-url`);
        if (!data.url) { window.open("#", "_blank"); return; }
        const docName = button.closest(".card")?.querySelector("strong")?.textContent || "Document";
        const preview = $("[data-doc-preview]");
        const frame = $("[data-doc-preview-frame]");
        const link = $("[data-doc-preview-link]");
        const nameEl = $("[data-doc-preview-name]");
        if (preview && frame) {
          frame.src = data.url;
          if (link) link.href = data.url;
          if (nameEl) nameEl.textContent = docName;
          preview.hidden = false;
        } else {
          window.open(data.url, "_blank", "noopener");
        }
      });
    });
  });
  $("[data-close-doc-preview]")?.addEventListener("click", () => {
    const preview = $("[data-doc-preview]");
    const frame = $("[data-doc-preview-frame]");
    if (preview) preview.hidden = true;
    if (frame) frame.src = "about:blank";
  });
  renderFilteredActivity();
  renderCoordinationStrip();
  renderExecutionSystem();
  iconRefresh();
}

function renderCalendarIntegration() {
  const target = $("[data-calendar-integration]");
  if (!target) return;
  const data = app.integrations || {};
  const google = (data.integrations || []).find((item) => item.provider === "google_calendar" && item.status === "connected");
  const lastUpdated = google?.updated_at ? `Updated ${formatDate(google.updated_at)}` : "";
  if (data.schemaInstalled === false) {
    target.innerHTML = `
      <div class="integration-copy">
        <p class="eyebrow">Calendar sync</p>
        <strong>Google Calendar unavailable</strong>
        <span>${escapeHtml(data.message || "Run google-calendar-v2.sql before users can connect Google Calendar.")}</span>
        <div class="integration-steps">
          <span>1. Run google-calendar-v2.sql</span>
          <span>2. Add Google OAuth env vars</span>
          <span>3. Come back and connect</span>
        </div>
      </div>
      <div class="integration-actions">
        <button class="ghost" data-refresh-integrations><i data-lucide="refresh-cw"></i>Refresh</button>
        <button class="ghost" disabled><i data-lucide="calendar-x"></i>Install SQL first</button>
      </div>
    `;
  } else if (google) {
    target.innerHTML = `
      <div class="integration-copy">
        <p class="eyebrow">Calendar sync</p>
        <strong>Google Calendar connected</strong>
        <span class="integration-state connected"><i data-lucide="check-circle-2"></i>${escapeHtml(google.calendar_name || "Primary calendar")}</span>
        <span>${escapeHtml([lastUpdated, google.last_error ? `Last error: ${google.last_error}` : ""].filter(Boolean).join(" - ") || "New tours sync automatically.")}</span>
      </div>
      <div class="integration-actions">
        <button class="ghost" data-refresh-integrations><i data-lucide="refresh-cw"></i>Refresh</button>
        <button class="ghost" data-connect-google-calendar><i data-lucide="rotate-cw"></i>Reconnect</button>
        <button class="danger-outline" data-disconnect-google-calendar><i data-lucide="unplug"></i>Unlink</button>
      </div>
    `;
  } else {
    target.innerHTML = `
      <div class="integration-copy">
        <p class="eyebrow">Calendar sync</p>
        <strong>Connect Google Calendar</strong>
        <span>One user click links the calendar. New scheduled tours then create events automatically.</span>
        <div class="integration-steps">
          <span>1. Connect</span>
          <span>2. Approve Google access</span>
          <span>3. Schedule tours</span>
        </div>
      </div>
      <div class="integration-actions">
        <button class="ghost" data-refresh-integrations><i data-lucide="refresh-cw"></i>Refresh</button>
        <button data-connect-google-calendar><i data-lucide="calendar-plus"></i>Connect Google</button>
      </div>
    `;
  }
  iconRefresh();
}

function renderTourConversionCoach() {
  const target = $("[data-tour-conversion-coach]");
  if (!target) return;
  const coach = valueLayer().tourConversionCoach || {};
  const cards = coach.cards || [];
  target.innerHTML = `
    <header>
      <div><p class="eyebrow">Tour conversion coach</p><strong>Outcome, objection, next commitment</strong></div>
      <span>${Number(coach.conversionRate || 0)}% close</span>
    </header>
    <div class="tour-coach-grid">
      ${cards.length ? cards.slice(0, 4).map((card) => `
        <article>
          <span>${escapeHtml(card.stage || "Prep")}</span>
          <strong>${escapeHtml(card.leadName || "Family tour")}</strong>
          <small>${escapeHtml(formatDate(card.scheduledAt))} &middot; ${escapeHtml(card.status || "")}</small>
          <p>${escapeHtml(card.nextAction || "")}</p>
          <ul>${(card.checklist || []).slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          <button class="ghost" data-tour-prep="${escapeHtml(card.tourId)}"><i data-lucide="wand-sparkles"></i>Prep</button>
        </article>
      `).join("") : empty("No tours need coaching right now.")}
    </div>
  `;
  target.querySelectorAll("[data-tour-prep]").forEach((button) => button.addEventListener("click", () => openTourPrepBrief(button.dataset.tourPrep)));
  iconRefresh();
}

function renderTourWorkflowBoard() {
  const target = $("[data-tour-workflow]");
  if (!target) return;
  const tours = (app.operations?.tours || []).slice().sort((a, b) => safeTime(a.scheduled_at) - safeTime(b.scheduled_at));
  const stages = [
    { key: "scheduled", label: "Scheduled" },
    { key: "confirmed", label: "Confirmed" },
    { key: "prepared", label: "Prepared" },
    { key: "completed", label: "Completed" },
    { key: "followup", label: "Follow-up" }
  ];
  target.innerHTML = `
    <header class="tour-workflow-head">
      <div><p class="eyebrow">Tour checklist</p><strong>Scheduled -> Confirmed -> Prepared -> Completed -> Follow-up</strong></div>
      <small>Move every tour to next commitment before it goes cold.</small>
    </header>
    <div class="tour-stage-grid">
      ${stages.map((stage) => {
        const rows = tours.filter((tour) => tourWorkflowStage(tour) === stage.key).slice(0, 5);
        return `
          <section class="tour-stage ${escapeHtml(stage.key)}">
            <header><strong>${escapeHtml(stage.label)}</strong><span>${rows.length}</span></header>
            ${rows.length ? rows.map(renderTourStageCard).join("") : empty(tourStageEmpty(stage.key))}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function tourWorkflowStage(tour = {}) {
  // Use explicit DB column if present, fall back to derivation
  if (tour.workflow_stage) return tour.workflow_stage;
  const status = String(tour.status || "").toLowerCase();
  if (status === "completed") {
    const hasFollowUp = (app.operations?.followUps || []).some((item) => item.lead_id === tour.lead_id && safeTime(item.due_at) > safeTime(tour.scheduled_at));
    return hasFollowUp ? "followup" : "completed";
  }
  if (["cancelled", "no_show"].includes(status)) return "followup";
  if (tour.external_calendar_sync_status === "synced" && tour.prep_completed_at) return "prepared";
  if (tour.family_confirmed_at) return "confirmed";
  return "scheduled";
}

function renderTourStageCard(tour = {}) {
  const calendar = tour.external_calendar_sync_status === "synced" ? "Synced"
    : tour.external_calendar_sync_status === "failed" ? "Needs attention"
      : "Calendar pending";
  return `
    <article>
      <strong>${escapeHtml(leadName(tour.lead_id) || "Family tour")}</strong>
      <span>${escapeHtml(formatTime(tour.scheduled_at))} &middot; ${escapeHtml(calendar)}</span>
      <div class="tour-stage-actions">
        <button data-tour-prep="${escapeHtml(tour.id)}"><i data-lucide="wand-sparkles"></i>Prep</button>
        <details class="card-more">
          <summary>More</summary>
          <button class="ghost" data-tour-link="${escapeHtml(tour.id)}"><i data-lucide="link"></i>Family link</button>
        </details>
      </div>
    </article>
  `;
}

function tourStageEmpty(stage) {
  return {
    scheduled: "No tours waiting to confirm.",
    confirmed: "No confirmed tours waiting for prep.",
    prepared: "No prepared tours queued.",
    completed: "No completed tours waiting closeout.",
    followup: "No post-tour follow-up gaps."
  }[stage] || "Nothing here.";
}

function renderTourCalendarStatus(tour = {}) {
  const status = tour.external_calendar_sync_status || "not_connected";
  const label = status === "synced" ? "Synced"
    : status === "failed" ? "Needs attention"
      : status === "deleted" ? "Event removed"
        : "Not connected";
  const fix = status === "failed"
    ? `Reconnect Google or use More > Push to Google. ${tour.external_calendar_error || ""}`
    : status === "not_connected"
      ? "Connect Google from Apps."
      : status === "deleted"
        ? "Create a new event with More > Push to Google."
        : "Google event matches this tour.";
  return `<small class="calendar-sync-status ${escapeHtml(status)}"><i data-lucide="calendar-check"></i><strong>${escapeHtml(label)}</strong><span>${escapeHtml(fix)}</span></small>`;
}

async function updateTourDetails(tourId) {
  const time = $(`[data-tour-time="${CSS.escape(tourId)}"]`)?.value || "";
  const notes = $(`[data-tour-notes="${CSS.escape(tourId)}"]`)?.value || "";
  try {
    await fetchJson(`/api/v2/tours/${encodeURIComponent(tourId)}`, {
      method: "PATCH",
      body: { scheduledAt: time, notes }
    });
    pushToast("Tour updated and pushed to Google.", "success");
    await refreshAll();
  } catch (err) {
    pushToast(err.message || "Could not update tour.", "error");
  }
}

async function resyncTourCalendar(tourId) {
  try {
    await fetchJson(`/api/v2/tours/${encodeURIComponent(tourId)}/calendar/resync`, { method: "POST" });
    pushToast("Tour pushed to Google Calendar.", "success");
    await refreshAll();
  } catch (err) {
    pushToast(err.message || "Could not push tour to Google Calendar.", "error");
  }
}

async function pullTourCalendar(tourId) {
  try {
    await fetchJson(`/api/v2/tours/${encodeURIComponent(tourId)}/calendar/pull`, { method: "POST" });
    pushToast("Tour pulled from Google Calendar.", "success");
    await refreshAll();
  } catch (err) {
    pushToast(err.message || "Could not pull from Google Calendar.", "error");
  }
}

async function handleCalendarIntegrationClick(event) {
  const connect = event.target.closest("[data-connect-google-calendar]");
  const disconnect = event.target.closest("[data-disconnect-google-calendar]");
  const refresh = event.target.closest("[data-refresh-integrations]");
  if (refresh) {
    try {
      await loadIntegrations();
      pushToast("App connections refreshed.", "success");
    } catch (err) {
      pushToast(err.message || "Could not refresh app connections.", "error");
    }
    return;
  }
  if (connect) {
    try {
      const data = await fetchJson("/api/v2/integrations/google-calendar/connect", { method: "POST" });
      window.open(data.authUrl, "google-calendar-connect", "width=620,height=720");
      pushToast("Google Calendar connect opened.", "success");
      setTimeout(() => loadIntegrations().catch(() => {}), 2500);
    } catch (err) {
      pushToast(err.message || "Could not start Google Calendar connection.", "error");
    }
    return;
  }
  if (disconnect) {
    try {
      await fetchJson("/api/v2/integrations/google-calendar/disconnect", { method: "POST" });
      await loadIntegrations();
      pushToast("Google Calendar unlinked.", "success");
    } catch (err) {
      pushToast(err.message || "Could not unlink Google Calendar.", "error");
    }
  }
}

function findMatchingLead(row) {
  const name = (row.visitor_name || row.name || "").trim().toLowerCase();
  const email = (row.email || "").trim().toLowerCase();
  return (app.leads || []).find((l) => {
    if (email && l.email && l.email.trim().toLowerCase() === email) return true;
    if (name && l.name && l.name.trim().toLowerCase() === name) return true;
    return false;
  }) || null;
}

function renderCheckIns() {
  renderCards("[data-checkins-list]", app.checkIns, (row) => {
    const match = findMatchingLead(row);
    return `
    <div class="card-head"><strong>${escapeHtml(row.visitor_name || row.name || "Visitor")}</strong><span class="badge">${escapeHtml(row.visit_purpose || "Visit")}</span></div>
    <small>${escapeHtml(row.community || "")} &middot; ${formatDate(row.created_at)}</small>
    <small>${escapeHtml(row.phone || "")}${row.email ? ` &middot; ${escapeHtml(row.email)}` : ""}</small>
    <small>${escapeHtml(row.visiting_resident || row.resident || "")}</small>
    ${match ? `<div class="card-actions"><button class="ghost" data-checkin-lead="${escapeHtml(match.id)}"><i data-lucide="user"></i>View lead</button></div>` : ""}
  `;
  });
  $$("[data-checkin-lead]").forEach((btn) => btn.addEventListener("click", () => openLeadDetail(btn.dataset.checkinLead)));
  iconRefresh();
}

function renderMoveInWorkflows() {
  const target = $("[data-move-in-workflows]");
  if (!target) return;
  const workflows = app.workflows?.workflows || [];
  if (app.workflows?.schemaInstalled === false) {
    target.innerHTML = `
      <article class="workflow-empty">
        <strong>Move-in workflow engine not installed</strong>
        <span>Run supabase/workflow-v2.sql to persist move-in workflows, steps, events, and audit records.</span>
      </article>
    `;
    return;
  }
  if (!workflows.length) {
    target.innerHTML = empty("No move-in workflows yet. Completing a room-bound resident move-in creates one.");
    return;
  }
  target.innerHTML = workflows.slice(0, 8).map((workflow) => {
    const steps = workflow.steps || [];
    const done = steps.filter((step) => ["completed", "skipped"].includes(String(step.status || "").toLowerCase())).length;
    return `
      <article class="workflow-card ${escapeHtml(workflow.status || "active")}">
        <div class="card-head">
          <strong>${escapeHtml(workflow.title || "Move-in workflow")}</strong>
          <span class="badge">${escapeHtml(workflow.status || "active")}</span>
        </div>
        <small>${escapeHtml(locationName(workflow.location_id))}${workflow.due_at ? ` &middot; Due ${formatShortDate(workflow.due_at)}` : ""}</small>
        <div class="workflow-progress"><span style="width:${steps.length ? Math.round((done / steps.length) * 100) : 0}%"></span></div>
        <div class="workflow-steps">
          ${steps.map((step) => `
            <button class="workflow-step ${escapeHtml(step.status || "todo")}" data-workflow-step="${escapeHtml(step.id)}" data-status="${step.status === "completed" ? "in_progress" : "completed"}">
              <i data-lucide="${step.status === "completed" ? "check-circle" : step.status === "blocked" ? "circle-alert" : "circle"}"></i>
              <span>${escapeHtml(step.title)}</span>
            </button>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
  $$("[data-workflow-step]", target).forEach((button) => {
    button.addEventListener("click", () => updateWorkflowStep(button.dataset.workflowStep, button.dataset.status));
  });
  bindHardDeleteButtons();
  iconRefresh();
}

async function updateWorkflowStep(id, status) {
  try {
    await fetchJson(`/api/v2/workflows/steps/${id}`, { method: "PATCH", body: { status } });
    pushToast("Workflow step updated.", "success");
    await loadWorkflows();
  } catch (err) {
    pushToast(err.message || "Could not update workflow step.", "error");
  }
}

function renderRooms() {
  const target = $("[data-room-inventory]");
  if (!target) return;
  hydrateRoomLocationSelect();
  const allRooms = app.operations?.rooms || [];
  renderRoomAvailabilityCounts(allRooms);
  const rooms = filterRooms(allRooms);
  const count = $("[data-room-count]");
  if (count) count.textContent = `${rooms.length} shown / ${allRooms.length} total`;
  if (!rooms.length) {
    target.innerHTML = empty("No rooms yet. Add rooms to unlock room matching, occupancy, and move-in workflows.");
    return;
  }
  const grouped = rooms.reduce((acc, room) => {
    const key = roomCurrentStatus(room);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(room);
    return acc;
  }, new Map());
  const lanes = ["available", "reserved", "occupied", "maintenance", "offline"].filter((status) => grouped.has(status));
  target.innerHTML = `
    <header class="room-board-head">
      <div><p class="eyebrow">Room Board</p><strong>Visual inventory first. Table stays secondary for detail work.</strong></div>
      <span>${rooms.length} visible</span>
    </header>
    ${renderRoomSpatialMap(rooms)}
    <section class="room-board-workspace">
      ${lanes.map((status) => {
        const rows = grouped.get(status) || [];
        return `
    <section class="room-board-lane ${escapeHtml(status)}">
      <header>
        <strong>${escapeHtml(roomStatusLabel(status))}</strong>
        <span>${rows.length} room${rows.length === 1 ? "" : "s"} &middot; ${roomInventorySummary(rows)}</span>
      </header>
      <div class="room-card-grid">
        ${rows.map(renderRoomCard).join("")}
      </div>
    </section>`;
      }).join("")}
    </section>
  `;
  $$("[data-room-status]", target).forEach((select) => {
    select.addEventListener("change", () => updateRoom(select.dataset.roomStatus, { status: select.value }));
  });
  $$("[data-room-condition]", target).forEach((select) => {
    select.addEventListener("change", () => updateRoom(select.dataset.roomCondition, { condition: select.value }));
  });
  $$("[data-open-room]", target).forEach((button) => {
    button.addEventListener("click", () => openRoomDetail(button.dataset.openRoom));
  });
  $$("[data-room-offline]", target).forEach((button) => {
    button.addEventListener("click", () => markRoomOffline(button.dataset.roomOffline));
  });
  $$("[data-room-restore]", target).forEach((button) => {
    button.addEventListener("click", () => updateRoom(button.dataset.roomRestore, { status: "available", condition: "ready" }));
  });
  bindHardDeleteButtons(target);
  iconRefresh();
}

function renderRoomReadinessSla() {
  const target = $("[data-room-readiness-sla]");
  if (!target) return;
  const sla = valueLayer().roomReadinessSla || {};
  const rooms = sla.worstRooms || [];
  target.innerHTML = `
    <header>
      <div><p class="eyebrow">Room readiness SLA</p><strong>Blocked room clock</strong></div>
      <span>${Number(sla.avgHours || 0)}h avg / ${Number(sla.targetHours || 24)}h target</span>
    </header>
    <div class="room-sla-grid">
      <article><strong>${Number(sla.readyRooms || 0)}</strong><span>ready rooms</span></article>
      <article><strong>${Number(sla.blockedCount || 0)}</strong><span>blocked rooms</span></article>
      <article><strong>${formatMoney(sla.monthlyRevenueBlocked || 0)}</strong><span>monthly blocked</span></article>
    </div>
    <div class="room-sla-list">
      ${rooms.length ? rooms.slice(0, 5).map((room) => `
        <article class="${escapeHtml(room.risk || "medium")}">
          <strong>Room ${escapeHtml(room.roomNumber || "")}</strong>
          <span>${escapeHtml(titleCase(room.status || "blocked"))} &middot; ${Number(room.hoursBlocked || 0)}h blocked</span>
          <small>${formatMoney(room.monthlyRate || 0)} monthly risk</small>
        </article>
      `).join("") : empty("No rooms are blocking readiness SLA.")}
    </div>
  `;
}

function renderDashboardRoomBoard() {
  const target = $("[data-dashboard-room-board]");
  if (!target) return;
  const rooms = app.operations?.rooms || [];
  if (!rooms.length) {
    target.innerHTML = `
      <header>
        <div><p class="eyebrow">Room Board</p><h2>Visual inventory</h2></div>
        <button class="ghost" data-view="rooms"><i data-lucide="door-open"></i>Rooms</button>
      </header>
      ${empty("No rooms loaded yet.")}
    `;
    bindDashboardRoomBoard(target);
    return;
  }
  const statuses = ["available", "reserved", "occupied", "maintenance", "offline"];
  const byStatus = new Map(statuses.map((status) => [status, []]));
  rooms.forEach((room) => {
    const status = statuses.includes(roomCurrentStatus(room)) ? roomCurrentStatus(room) : "available";
    byStatus.get(status).push(room);
  });
  const readyRooms = byStatus.get("available") || [];
  const blockedRooms = [...(byStatus.get("maintenance") || []), ...(byStatus.get("offline") || [])];
  target.innerHTML = `
    <header>
      <div>
        <p class="eyebrow">Room Board</p>
        <h2>Spatial room inventory</h2>
      </div>
      <button class="ghost" data-view="rooms"><i data-lucide="door-open"></i>Open board</button>
    </header>
    <div class="dashboard-room-summary">
      <article><strong>${readyRooms.length}</strong><span>ready</span></article>
      <article><strong>${(byStatus.get("reserved") || []).length}</strong><span>held</span></article>
      <article><strong>${blockedRooms.length}</strong><span>blocked</span></article>
      <article><strong>${formatMoney(readyRooms.reduce((sum, room) => sum + (Number(room.monthly_rate) || AVG_MONTHLY_REVENUE), 0))}</strong><span>open/month</span></article>
    </div>
    <div class="dashboard-room-wall">
      ${statuses.map((status) => {
        const rows = (byStatus.get(status) || []).slice(0, 10);
        return `
          <section class="${escapeHtml(status)}">
            <div><strong>${escapeHtml(roomStatusLabel(status))}</strong><span>${(byStatus.get(status) || []).length}</span></div>
            <div class="dashboard-room-mini-grid">
              ${rows.length ? rows.map((room) => `
                <button class="dashboard-room-mini ${escapeHtml(status)}" data-view="rooms" title="Room ${escapeHtml(room.room_number || "")}">
                  <strong>${escapeHtml(room.room_number || "")}</strong>
                  <span>${escapeHtml(locationName(room.location_id) || "")}</span>
                </button>
              `).join("") : `<p class="dashboard-room-empty">None</p>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
  bindDashboardRoomBoard(target);
}

function bindDashboardRoomBoard(target) {
  $$("[data-view]", target).forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  iconRefresh();
}

function renderRoomSpatialMap(rooms = []) {
  const byLocation = rooms.reduce((acc, room) => {
    const key = locationName(room.location_id) || "Community";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(room);
    return acc;
  }, new Map());
  return `
    <section class="room-spatial-map">
      <header>
        <div><p class="eyebrow">Spatial inventory</p><strong>Community room map</strong></div>
        <span>${rooms.length} rooms visible</span>
      </header>
      <div class="room-map-locations">
        ${[...byLocation.entries()].map(([name, rows]) => `
          <article>
            <strong>${escapeHtml(name)}</strong>
            <div class="room-map-grid">
              ${rows.map((room) => `<button class="room-map-cell ${escapeHtml(roomCurrentStatus(room))}" data-open-room="${escapeHtml(room.id)}" title="Room ${escapeHtml(room.room_number || "")}">${escapeHtml(room.room_number || "")}</button>`).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderRoomCard(room) {
  const resident = room.current_resident_id ? (app.operations?.residents || []).find((item) => item.id === room.current_resident_id) : null;
  const status = roomCurrentStatus(room);
  const matches = status === "available" ? buildRoomMatches([room], app.leads || []).length : 0;
  const reservationLead = room.reserved_for_lead_id ? (app.leads || []).find((lead) => lead.id === room.reserved_for_lead_id) : null;
  const context = status === "occupied"
    ? resident?.full_name || "Occupied"
    : status === "reserved"
      ? reservationLead?.full_name || "Reserved lead"
      : status === "maintenance" || status === "offline"
        ? room.notes || "Readiness work needed"
        : `${matches} compatible lead${matches === 1 ? "" : "s"}`;
  return `
    <article class="room-inventory-card room-board-tile ${escapeHtml(status)}">
      <div class="card-head">
        <strong>Room ${escapeHtml(room.room_number || "")}</strong>
        <span class="badge">${escapeHtml(roomStatusLabel(status))}</span>
      </div>
      <small>${escapeHtml(locationName(room.location_id))}${room.floor ? ` &middot; Floor ${escapeHtml(room.floor)}` : ""}</small>
      <small>${escapeHtml(room.room_name || roomTypeLabel(room.room_type))} &middot; ${escapeHtml(room.capacity || 1)} bed${Number(room.capacity || 1) === 1 ? "" : "s"}</small>
      <small>${escapeHtml(room.care_level_supported || room.care_level || "Any care level")}${room.monthly_rate ? ` &middot; ${formatMoney(room.monthly_rate)}/mo` : ""}</small>
      <div class="room-condition-line">
        <span class="room-condition ${escapeHtml(room.condition || "ready")}">${escapeHtml(roomConditionLabel(room.condition || "ready"))}</span>
        <small>${escapeHtml(context)}</small>
      </div>
      <div class="room-card-controls">
        <select data-room-status="${escapeHtml(room.id)}" aria-label="Room status">
          ${roomStatusOptions(status)}
        </select>
        <select data-room-condition="${escapeHtml(room.id)}" aria-label="Room condition">
          ${roomConditionOptions(room.condition)}
        </select>
      </div>
      <div class="card-actions">
        <button data-open-room="${escapeHtml(room.id)}"><i data-lucide="panel-right-open"></i>Details</button>
        <details class="card-more">
          <summary>More</summary>
          ${status !== "offline" ? `<button class="ghost" data-room-offline="${escapeHtml(room.id)}"><i data-lucide="archive"></i>Offline</button>` : ""}
          ${status === "offline" ? `<button class="ghost" data-room-restore="${escapeHtml(room.id)}"><i data-lucide="archive-restore"></i>Restore</button>` : ""}
          ${superDeleteButton("room", room.id)}
        </details>
      </div>
    </article>
  `;
}

function handleRoomFilters() {
  app.roomFilters = {
    status: $("[data-room-status-filter]")?.value || "",
    careLevel: $("[data-room-care-filter]")?.value.trim() || "",
    roomType: $("[data-room-type-filter]")?.value || ""
  };
  renderRooms();
}

function filterRooms(rooms = []) {
  const care = app.roomFilters.careLevel.toLowerCase();
  return rooms.filter((room) => {
    if (app.roomFilters.status && roomCurrentStatus(room) !== app.roomFilters.status) return false;
    if (app.roomFilters.roomType && room.room_type !== app.roomFilters.roomType) return false;
    if (care && !String(room.care_level_supported || room.care_level || "").toLowerCase().includes(care)) return false;
    return true;
  });
}

function renderRoomAvailabilityCounts(rooms = []) {
  const target = $("[data-room-availability-counts]");
  if (!target) return;
  const counts = ["available", "occupied", "reserved", "maintenance", "offline"].map((status) => ({
    status,
    count: rooms.filter((room) => roomCurrentStatus(room) === status).length
  }));
  const total = Math.max(1, rooms.filter((room) => roomCurrentStatus(room) !== "offline").length);
  const occupied = rooms.filter((room) => roomCurrentStatus(room) === "occupied").length;
  target.innerHTML = `
    ${counts.map((item) => `<article><strong>${item.count}</strong><span>${escapeHtml(roomStatusLabel(item.status))}</span></article>`).join("")}
    <article><strong>${Math.round((occupied / total) * 100)}%</strong><span>Occupancy</span></article>
  `;
}

async function openRoomDetail(id) {
  try {
    const detail = await fetchJson(`/api/v2/rooms/${id}`);
    app.selectedRoomDetail = detail;
    const room = detail.room;
    const matches = buildRoomMatches([room], app.leads || []).slice(0, 5);
    $("[data-room-detail-body]").innerHTML = `
      <div class="room-detail-grid">
        <article><span>Status</span><strong>${escapeHtml(roomStatusLabel(roomCurrentStatus(room)))}</strong></article>
        <article><span>Condition</span><strong>${escapeHtml(roomConditionLabel(room.condition))}</strong></article>
        <article><span>Rate</span><strong>${room.monthly_rate ? formatMoney(room.monthly_rate) : "Not set"}</strong></article>
        <article><span>Care fit</span><strong>${escapeHtml(room.care_level_supported || room.care_level || "Any")}</strong></article>
      </div>
      <p class="helper-text">${escapeHtml(room.notes || "No room notes yet.")}</p>
      <h3>Lead matches</h3>
      <div class="room-match-list">
        ${matches.length ? matches.map(renderRoomMatch).join("") : empty("No matching active leads found.")}
      </div>
    `;
    $("[data-room-detail-modal]")?.showModal();
    iconRefresh();
  } catch (err) {
    pushToast(err.message || "Could not load room detail.", "error");
  }
}

async function markRoomOffline(id) {
  try {
    await fetchJson(`/api/v2/rooms/${id}`, { method: "DELETE", body: { note: "Marked offline from admin-v2." } });
    pushToast("Room marked offline.", "success");
    await loadOperations();
  } catch (err) {
    pushToast(err.message || "Could not mark room offline.", "error");
  }
}

function hydrateRoomLocationSelect() {
  const select = $("[data-room-location]");
  if (!select) return;
  const current = app.selectedLocationId || select.value || "";
  const canSwitch = app.user?.isSuperAdmin || ["super_admin", "regional_manager"].includes(app.user?.role);
  const locationOptions = app.selectedLocationId
    ? app.locations.filter((location) => location.id === app.selectedLocationId)
    : app.locations;
  const options = locationOptions.map((location) => `<option value="${escapeHtml(location.id)}">${escapeHtml(location.name)}</option>`).join("");
  select.innerHTML = canSwitch && !app.selectedLocationId
    ? `<option value="">Choose location...</option>${options}`
    : options;
  select.value = current || app.selectedLocationId || app.locations[0]?.id || "";
}

async function handleRoomSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    if (submit) submit.disabled = true;
    await fetchJson("/api/v2/rooms", { method: "POST", body });
    form.reset();
    hydrateRoomLocationSelect();
    pushToast("Room added.", "success");
    await loadOperations();
  } catch (err) {
    pushToast(err.message || "Could not add room.", "error");
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function updateRoom(id, patch) {
  const existing = (app.operations?.rooms || []).find((room) => room.id === id);
  if (!existing) return;
  const body = {
    locationId: existing.location_id,
    roomNumber: existing.room_number,
    roomName: existing.room_name,
    roomType: existing.room_type,
    floor: existing.floor || "",
    capacity: existing.capacity || 1,
    currentStatus: roomCurrentStatus(existing),
    condition: existing.condition || "ready",
    monthlyRate: existing.monthly_rate || "",
    budgetMin: existing.budget_min || "",
    budgetMax: existing.budget_max || "",
    careLevel: existing.care_level || "",
    careLevelSupported: existing.care_level_supported || existing.care_level || "",
    currentResidentId: existing.current_resident_id || "",
    reservedForLeadId: existing.reserved_for_lead_id || "",
    targetMoveInDate: existing.target_move_in_date || "",
    notes: existing.notes || "",
    ...patch
  };
  try {
    await fetchJson(`/api/v2/rooms/${id}`, { method: "PATCH", body });
    pushToast("Room updated.", "success");
    await loadOperations();
    await loadWorkflows().catch(() => {});
  } catch (err) {
    pushToast(err.message || "Could not update room.", "error");
    renderRooms();
  }
}

async function reserveRoomForLead(roomId, leadId) {
  if (!roomId || !leadId) return;
  await updateRoom(roomId, { status: "reserved", reservedForLeadId: leadId });
}

function renderRoomOccupancy() {
  const target = $("[data-room-occupancy]");
  if (!target) return;
  const rooms = buildRoomOccupancy();
  const occupied = rooms.filter((room) => room.activeResident).length;
  const turnover = rooms.filter((room) => room.needsTurnover).length;
  const ready = rooms.filter((room) => !room.activeResident && !room.needsTurnover).length;
  target.innerHTML = `
    <article class="room-summary-card occupied"><strong>${occupied}</strong><span>Occupied rooms</span></article>
    <article class="room-summary-card turnover"><strong>${turnover}</strong><span>Need condition follow-up</span></article>
    <article class="room-summary-card ready"><strong>${ready}</strong><span>Open / ready rooms</span></article>
    <div class="room-board">
      ${rooms.length ? rooms.map(renderRoomTile).join("") : `<p class="empty">No rooms assigned yet.</p>`}
    </div>
  `;
}

function buildRoomOccupancy() {
  const inventory = app.operations?.rooms || [];
  if (inventory.length) {
    return inventory.map((room) => {
      const activeResident = room.current_resident_id
        ? (app.operations?.residents || []).find((resident) => resident.id === room.current_resident_id && residentStatus(resident) === "active") || null
        : (app.operations?.residents || []).find((resident) => residentStatus(resident) === "active" && String(resident.room_number || "") === String(room.room_number || "") && resident.location_id === room.location_id) || null;
      const status = roomCurrentStatus(room);
      const condition = String(room.condition || "ready").toLowerCase();
      const needsTurnover = ["maintenance", "offline"].includes(status) || ["needs_cleaning", "maintenance", "damaged", "offline", "lived_in"].includes(condition);
      return {
        number: room.room_number || room.room_name || "Unassigned",
        room,
        residents: activeResident ? [activeResident] : [],
        activeResident,
        latest: activeResident || {},
        condition,
        needsTurnover,
        inventoryStatus: status
      };
    }).sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  }
  const rooms = new Map();
  (app.operations?.residents || []).forEach((resident) => {
    const number = resident.room_number || "Unassigned";
    if (!rooms.has(number)) rooms.set(number, { number, residents: [] });
    rooms.get(number).residents.push(resident);
  });
  return [...rooms.values()].map((room) => {
    const activeResident = room.residents.find((resident) => residentStatus(resident) === "active") || null;
    const latest = room.residents
      .slice()
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0] || {};
    const condition = roomCondition(latest);
    const needsTurnover = !activeResident && ["needs_cleaning", "maintenance", "damaged", "lived_in"].includes(condition);
    return { ...room, activeResident, latest, condition, needsTurnover };
  }).sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
}

function renderRoomTile(room) {
  const status = room.activeResident ? "occupied" : room.needsTurnover ? "turnover" : room.inventoryStatus === "reserved" ? "reserved" : "ready";
  const resident = room.activeResident || room.latest;
  return `
    <article class="room-tile ${escapeHtml(status)}">
      <div>
        <strong>Room ${escapeHtml(room.number)}</strong>
        <small>${escapeHtml(room.activeResident ? resident.full_name : status === "turnover" ? "Turnover needed" : "Available")}</small>
      </div>
      <span>${escapeHtml(roomConditionLabel(room.condition))}</span>
    </article>
  `;
}

function renderResidentCard(resident) {
  const status = residentStatus(resident);
  const condition = roomCondition(resident);
  return `
    <div class="card-head">
      <strong>${escapeHtml(resident.full_name)}</strong>
      <span class="badge">${escapeHtml(status === "moved_out" ? "moved out" : status)}</span>
    </div>
    <small>${escapeHtml(locationName(resident.location_id))} &middot; Room ${escapeHtml(resident.room_number || "not set")}</small>
    <small>${resident.move_in_date ? `Move-in: ${escapeHtml(resident.move_in_date)}` : ""}</small>
    <div class="room-condition-line">
      <span class="room-condition ${escapeHtml(condition)}">${escapeHtml(roomConditionLabel(condition))}</span>
      <small>${escapeHtml(status === "active" ? "Occupied" : "Room needs review before reuse")}</small>
    </div>
    <div class="card-actions">
      ${status === "active"
        ? `<button data-resident-left="${escapeHtml(resident.id)}"><i data-lucide="door-open"></i>Resident left</button>`
        : `<button data-resident-active="${escapeHtml(resident.id)}"><i data-lucide="undo-2"></i>Mark active</button>`}
      ${app.user?.isSuperAdmin ? `<details class="card-more"><summary>More</summary>${superDeleteButton("resident", resident.id)}</details>` : ""}
    </div>
  `;
}

function residentStatus(resident = {}) {
  return String(resident.status || "active").toLowerCase();
}

function roomCondition(resident = {}) {
  const explicit = String(resident.room_condition || resident.roomCondition || "").toLowerCase();
  if (explicit) return explicit;
  const notes = String(resident.notes || "").toLowerCase();
  if (notes.includes("damaged")) return "damaged";
  if (notes.includes("maintenance")) return "maintenance";
  if (notes.includes("needs_cleaning") || notes.includes("needs cleaning")) return "needs_cleaning";
  if (notes.includes("lived_in") || notes.includes("lived-in")) return "lived_in";
  return "ready";
}

function roomConditionLabel(value = "") {
  return {
    ready: "Ready",
    lived_in: "Lived-in",
    needs_cleaning: "Needs cleaning",
    maintenance: "Maintenance",
    damaged: "Damaged",
    offline: "Offline"
  }[value] || "Condition unknown";
}

function roomStatusLabel(value = "") {
  return {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    turnover: "Turnover",
    maintenance: "Maintenance",
    offline: "Offline"
  }[value] || titleCase(String(value || "available").replaceAll("_", " "));
}

function roomTypeLabel(value = "") {
  return {
    private: "Private",
    semi_private: "Semi-private",
    memory_care: "Memory care",
    respite: "Respite"
  }[value] || titleCase(String(value || "Room").replaceAll("_", " "));
}

function roomStatusOptions(current = "") {
  return ["available", "occupied", "reserved", "maintenance", "offline"]
    .map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${escapeHtml(roomStatusLabel(value))}</option>`)
    .join("");
}

function roomConditionOptions(current = "") {
  return ["ready", "lived_in", "needs_cleaning", "maintenance", "damaged", "offline"]
    .map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${escapeHtml(roomConditionLabel(value))}</option>`)
    .join("");
}

function roomInventorySummary(rows = []) {
  const available = rows.filter((room) => roomCurrentStatus(room) === "available").length;
  const occupied = rows.filter((room) => roomCurrentStatus(room) === "occupied").length;
  const blocked = rows.filter((room) => ["maintenance", "offline"].includes(roomCurrentStatus(room))).length;
  return `${available} available / ${occupied} occupied / ${blocked} blocked`;
}

function roomCurrentStatus(room = {}) {
  return String(room.current_status || room.status || "available").toLowerCase();
}

function renderReports() {
  const target = $("[data-report-grid]");
  if (!target) return;
  const rows = app.dashboard?.locationComparison || [];
  const maxLeads = Math.max(1, ...rows.map((row) => row.leads));
  target.innerHTML = `
    <article class="card report-card">
      <strong>Leads by location</strong>
      <div class="report-list">
        ${rows.map((row) => reportBar(row.name, row.leads, maxLeads)).join("")}
      </div>
    </article>
    <article class="card report-card">
      <strong>Conversion by location</strong>
      <div class="report-list">
        ${rows.map((row) => reportBar(row.name, `${row.conversionRate}%`, 100, row.conversionRate)).join("")}
      </div>
    </article>
  `;
  renderMarketingActions();
  renderLostRecoveryPanel();
}

function renderLostRecoveryPanel() {
  const target = $("[data-lost-recovery]");
  if (!target) return;
  const recovery = valueLayer().lostLeadRecovery || {};
  const candidates = recovery.candidates || [];
  target.innerHTML = `
    <section class="recovery-engine">
      <header>
        <div><p class="eyebrow">Lost lead recovery</p><h3>Recovery buckets + scripts</h3></div>
        <span>${Number(recovery.total || 0)} recoverable</span>
      </header>
      <div class="recovery-buckets">
        ${(recovery.buckets || []).map((bucket) => `
          <article>
            <strong>${Number(bucket.count || 0)}</strong>
            <span>${escapeHtml(bucket.label || "")}</span>
          </article>
        `).join("")}
      </div>
      <div class="recovery-list">
        ${candidates.length ? candidates.slice(0, 6).map((item) => `
          <article>
            <div>
              <strong>${escapeHtml(item.leadName)}</strong>
              <small>${escapeHtml(titleCase(String(item.bucket || "").replaceAll("_", " ")))} &middot; ${Number(item.ageDays || 0)}d quiet</small>
              <p>${escapeHtml(item.script || "")}</p>
            </div>
            <button class="ghost" data-revenue-lead="${escapeHtml(item.leadId)}"><i data-lucide="folder-open"></i>Open</button>
          </article>
        `).join("") : empty("No stale leads need recovery right now.")}
      </div>
    </section>
  `;
  $$("[data-revenue-lead]", target).forEach((button) => button.addEventListener("click", () => openLeadDetail(button.dataset.revenueLead)));
  iconRefresh();
}

function renderMarketingActions() {
  const target = $("[data-marketing-actions]");
  if (!target) return;
  const rows = (app.scopeControl?.marketing || []).length ? app.scopeControl.marketing : buildMarketingActionsFromReferrals();
  if (!rows.length) { target.innerHTML = ""; return; }
  const top = rows[0] || {};
  const weak = rows.find((row) => Number(row.leads || 0) >= 3 && Number(row.qualityScore || row.conversionRate || 0) < 30) || rows[1] || top;
  const unknown = rows.find((row) => /unknown|website|web/i.test(row.source || "")) || rows[2] || top;
  const cards = [
    { label: "Scale winner", source: top.source, action: top.recommendation || "Push budget and staff follow-up toward this source." },
    { label: "Fix weak source", source: weak.source, action: weak.recommendation || "Review call speed, tour conversion, and room fit before spending more." },
    { label: "Audit attribution", source: unknown.source, action: "Clean source names so web forms, calls, and partners report separately." }
  ].filter((card) => card.source);
  target.innerHTML = `
    <section class="marketing-actions-panel">
      <div>
        <p class="eyebrow">Marketing command</p>
        <h3>Campaign ROI actions</h3>
      </div>
      <div class="marketing-actions-list">
        ${cards.map((card) => `
          <article>
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.source)}</strong>
            <small>${escapeHtml(card.action)}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function buildMarketingActionsFromReferrals() {
  return (app.referrals || []).map((row) => ({
    ...row,
    recommendation: row.recommendation || (Number(row.qualityScore || row.conversionRate || 0) >= 50
      ? "High quality. Increase outreach and protect response speed."
      : "Needs review. Check source quality before adding spend.")
  }));
}

async function loadUsers() {
  if (!app.user?.isSuperAdmin) return;
  if (isFresh("users", 120000)) return;
  try {
    const data = await fetchJson("/api/v2/users");
    markFresh("users");
    renderCards("[data-users-list]", data.users || [], (user) => `
      <div class="card-head"><strong>${escapeHtml(user.full_name || user.email)}</strong><span class="badge">${escapeHtml(user.role)}</span></div>
      <small>${escapeHtml(user.email)} &middot; ${user.active ? "Active" : "Inactive"}</small>
      <small>${(user.user_location_access || []).map((row) => row.locations?.name).filter(Boolean).join(", ") || "All only if super admin"}</small>
      <div class="card-actions">
        <button class="ghost" data-user-active="${user.id}" data-active="${user.active ? "false" : "true"}">
          <i data-lucide="${user.active ? "user-x" : "user-check"}"></i>${user.active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    `);
    $$("[data-user-active]").forEach((button) => {
      button.addEventListener("click", () => updateUserActive(button.dataset.userActive, button.dataset.active === "true"));
    });
    iconRefresh();
  } catch (err) {
    $("[data-users-list]").innerHTML = empty(err.message);
  }
}

async function loadIntelligenceRules() {
  if (!app.user?.isSuperAdmin) return;
  if (isFresh("intelligenceRules", 120000)) return;
  try {
    app.intelligenceRules = await fetchJson("/api/v2/intelligence/rules");
    markFresh("intelligenceRules");
    renderIntelligenceRules();
  } catch (err) {
    const target = $("[data-intelligence-rules]");
    if (target) target.innerHTML = empty(err.message || "Could not load intelligence rules.");
  }
}

function renderIntelligenceRules() {
  const target = $("[data-intelligence-rules]");
  if (!target) return;
  const data = app.intelligenceRules || {};
  const note = $("[data-rule-schema-note]");
  if (note) {
    note.hidden = data.schemaInstalled !== false;
    note.textContent = data.message || "";
  }
  const rules = data.rules || [];
  target.innerHTML = rules.length ? rules.map(renderRuleCard).join("") : empty("No intelligence rules configured.");
  iconRefresh();
}

function renderRuleCard(rule) {
  const settingInputs = Object.entries(rule.settings || {})
    .filter(([key]) => key !== "description")
    .map(([key, value]) => `
      <label>${escapeHtml(titleCase(key.replaceAll("_", " ")))}
        <input data-rule-setting="${escapeHtml(key)}" value="${escapeHtml(value)}">
      </label>
    `).join("");
  return `
    <article class="rule-card" data-rule-card="${escapeHtml(rule.eventType)}">
      <header>
        <div>
          <strong>${escapeHtml(rule.label)}</strong>
          <span>${escapeHtml(rule.description || rule.eventType)}</span>
        </div>
        <label class="switch-row">
          <input type="checkbox" data-rule-enabled ${rule.enabled ? "checked" : ""}>
          Enabled
        </label>
      </header>
      <div class="rule-grid">
        <label>Severity
          <select data-rule-severity>
            ${["low", "medium", "high", "critical"].map((severity) => `<option value="${severity}"${rule.severity === severity ? " selected" : ""}>${escapeHtml(titleCase(severity))}</option>`).join("")}
          </select>
        </label>
        <label>Threshold hours
          <input data-rule-threshold type="number" min="0" step="0.25" value="${escapeHtml(rule.thresholdHours ?? "")}" placeholder="None">
        </label>
        <label>Cooldown hours
          <input data-rule-cooldown type="number" min="0" step="0.25" value="${escapeHtml(rule.cooldownHours ?? 24)}">
        </label>
        ${settingInputs}
      </div>
      <div class="card-actions">
        <button class="ghost" data-save-rule="${escapeHtml(rule.eventType)}"><i data-lucide="save"></i>Save rule</button>
      </div>
    </article>
  `;
  hydrateReferralPartnerLocationSelect();
  renderReferralPartners();
}

function hydrateReferralPartnerLocationSelect() {
  const select = $("[data-referral-partner-location]");
  if (!select) return;
  const current = select.value || app.selectedLocationId || app.locations[0]?.id || "";
  select.innerHTML = app.locations.map((location) => `<option value="${escapeHtml(location.id)}">${escapeHtml(location.name)}</option>`).join("");
  select.value = app.locations.some((location) => location.id === current) ? current : app.locations[0]?.id || "";
}

function renderReferralPartners() {
  const target = $("[data-referral-partners]");
  if (!target) return;
  const data = app.referralPartners || {};
  const note = $("[data-referral-partner-note]");
  if (note) {
    note.hidden = data.schemaInstalled !== false;
    note.textContent = data.message || "";
  }
  const partners = data.partners || [];
  target.innerHTML = partners.length ? partners.slice(0, 12).map((partner) => {
    const metrics = partner.metrics || {};
    return `
      <article class="card referral-partner-card">
        <div class="card-head"><strong>${escapeHtml(partner.source_name || partner.source)}</strong><span class="badge">${escapeHtml(partner.status || "watch")}</span></div>
        <small>${escapeHtml(locationName(partner.location_id) || "Derived source")} &middot; ${escapeHtml(partner.contact_name || "No contact")}</small>
        <small>${escapeHtml(partner.phone || partner.email || partner.notes || "")}</small>
        <div class="partner-score-row">
          <span>${metrics.leads || 0} leads</span>
          <span>${metrics.roomFitRate || 0}% room fit</span>
          <span>${metrics.qualityScore || 0} quality</span>
        </div>
      </article>
    `;
  }).join("") : empty("No referral partners yet.");
}

async function handleReferralPartnerSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await fetchJson("/api/v2/referral-partners", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) });
  form.reset();
  hydrateReferralPartnerLocationSelect();
  await loadReferralPartners();
  pushToast("Referral partner saved.", "success");
}

async function handleRuleAction(event) {
  const button = event.target.closest("[data-save-rule]");
  if (!button) return;
  const card = button.closest("[data-rule-card]");
  const eventType = button.dataset.saveRule;
  if (!card || !eventType) return;
  const settings = {};
  $$("[data-rule-setting]", card).forEach((input) => {
    settings[input.dataset.ruleSetting] = input.value;
  });
  const body = {
    enabled: card.querySelector("[data-rule-enabled]")?.checked,
    severity: card.querySelector("[data-rule-severity]")?.value,
    thresholdHours: card.querySelector("[data-rule-threshold]")?.value,
    cooldownHours: card.querySelector("[data-rule-cooldown]")?.value,
    settings
  };
  await withButtonLoading(button, async () => {
    await fetchJson(`/api/v2/intelligence/rules/${encodeURIComponent(eventType)}`, { method: "PATCH", body });
    pushToast("Rule updated.", "success");
    await loadIntelligenceRules();
    await loadIntelligence().catch(() => {});
  }).catch((err) => pushToast(err.message || "Could not update rule.", "error"));
}

function openCreateUser() {
  const select = $("[data-create-user-location]");
  select.innerHTML = app.locations.map((location) => `<option value="${location.id}">${escapeHtml(location.name)}</option>`).join("");
  select.value = app.selectedLocationId || app.locations[0]?.id || "";
  $("[data-create-user-modal]").showModal();
}

async function handleCreateUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  setStatus("Creating user...");
  await fetchJson("/api/v2/users", { method: "POST", body });
  form.reset();
  $("[data-create-user-modal]").close();
  invalidate("users");
  await loadUsers();
  setStatus("User created.");
}

async function updateUserActive(id, active) {
  setStatus(active ? "Reactivating user..." : "Deactivating user...");
  await fetchJson(`/api/v2/users/${id}/active`, { method: "PATCH", body: { active } });
  invalidate("users");
  await loadUsers();
  setStatus("");
}

function openCreateLead() {
  const select = $("[data-create-lead-location]");
  select.innerHTML = app.locations.map((location) => `<option value="${location.id}">${escapeHtml(location.name)}</option>`).join("");
  select.value = app.selectedLocationId || app.locations[0]?.id || "";
  $("[data-create-lead-modal]").showModal();
}

async function handleCreateLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  await fetchJson("/api/v2/leads", { method: "POST", body: { ...body, source: "Admin" } });
  form.reset();
  $("[data-create-lead-modal]").close();
  await refreshAll();
}

async function handleLeadExport() {
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  const status = $("[data-lead-status-filter]").value;
  const search = $("[data-lead-search]").value.trim();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const headers = {};
  if (app.session?.access_token) headers.Authorization = `Bearer ${app.session.access_token}`;
  const response = await fetch(`/api/v2/leads/export?${params.toString()}`, { headers });
  if (!response.ok) throw new Error("Unable to export leads.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "comfort-care-v2-leads.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function openLeadDetail(id) {
  const modal = $("[data-lead-detail-modal]");
  const detailStatus = $("[data-detail-status]");
  if (modal) {
    $("[data-detail-name]").textContent = "Loading…";
    if (detailStatus) detailStatus.textContent = "";
    modal.showModal();
  }
  let detail;
  try {
    detail = await fetchJson(`/api/v2/leads/${id}`);
  } catch (err) {
    if (detailStatus) detailStatus.textContent = err.message || "Could not load lead.";
    return;
  }
  app.selectedLeadDetail = detail;
  const lead = detail.lead;
  $("[data-detail-name]").textContent = lead.full_name;
  $("[data-detail-notes]").value = lead.notes_summary || "";
  $("[data-detail-email-subject]").value = "";
  $("[data-detail-email-body]").value = "";
  setLeadDetailTab("timeline");
  $("[data-detail-meta]").innerHTML = `
    <article><span>Phone</span><strong>${escapeHtml(lead.phone)}</strong></article>
    <article><span>Email</span><strong>${escapeHtml(lead.email || "No email")}</strong></article>
    <article><span>Location</span><strong>${escapeHtml(locationName(lead.location_id))}</strong></article>
    <article><span>Status</span><strong>${escapeHtml(statusLabel(lead.status))}</strong></article>
    <article><span>Care type</span><strong>${escapeHtml(lead.care_type || "")}</strong></article>
    <article><span>Source</span><strong>${escapeHtml(lead.source || "")}</strong></article>
  `;
  const journey = $("[data-detail-journey]");
  if (journey) journey.innerHTML = renderFamilyJourney(lead, detail);
  renderLeadTimeline(detail.timeline || buildClientLeadTimeline(detail), $("[data-detail-activity]"));
  renderCards("[data-detail-emails]", detail.emailHistory || [], (email) => `
    <div class="card-head"><strong>${escapeHtml(email.subject)}</strong><span class="badge">${escapeHtml(email.status)}</span></div>
    <small>${formatDate(email.created_at)} &middot; ${escapeHtml(email.recipient_email || "")}</small>
    <small>${escapeHtml(email.body || "").slice(0, 180)}${String(email.body || "").length > 180 ? "..." : ""}</small>
  `);
  renderCards("[data-detail-tours]", [...(detail.tours || []), ...(detail.followUps || [])], (item) => {
    const isTour = Boolean(item.scheduled_at);
    return `
      <div class="card-head"><strong>${isTour ? "Tour" : "Follow-up"}</strong><span class="badge">${escapeHtml(item.status || "open")}</span></div>
      <small>${formatDate(item.scheduled_at || item.due_at || item.created_at)}${isTour ? "" : ` &middot; ${escapeHtml(item.note || "")}`}</small>
      ${item.notes || item.outcome ? `<small>${escapeHtml(item.notes || item.outcome || "")}</small>` : ""}
    `;
  });
  if (detailStatus) detailStatus.textContent = "";
  iconRefresh();
}

function renderFamilyJourney(lead = {}, detail = {}) {
  const tours = detail.tours || [];
  const followUps = detail.followUps || [];
  const nextTour = tours.filter((tour) => safeTime(tour.scheduled_at) >= Date.now()).sort((a, b) => safeTime(a.scheduled_at) - safeTime(b.scheduled_at))[0];
  const nextFollow = followUps.filter((item) => safeTime(item.due_at) >= Date.now() && !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase())).sort((a, b) => safeTime(a.due_at) - safeTime(b.due_at))[0];
  const compatibleRooms = buildRoomMatches(app.operations?.rooms || [], [lead]).length;
  const stages = [
    { label: "Need", value: lead.care_type || "Not captured", done: Boolean(lead.care_type) },
    { label: "Urgency", value: lead.move_timeline || "Ask next", done: Boolean(lead.move_timeline) },
    { label: "Objection", value: lead.payment_type || lead.current_situation || "Unknown", done: Boolean(lead.payment_type || lead.current_situation) },
    { label: "Next commitment", value: nextTour ? `Tour ${formatDate(nextTour.scheduled_at)}` : nextFollow ? `Follow-up ${formatDate(nextFollow.due_at)}` : "Missing", done: Boolean(nextTour || nextFollow) },
    { label: "Room fit", value: compatibleRooms ? `${compatibleRooms} compatible` : "No fit yet", done: compatibleRooms > 0 },
    { label: "Timeline", value: formatDate(lead.updated_at || lead.created_at), done: true }
  ];
  return `
    <div class="family-journey-head">
      <div><p class="eyebrow">Family journey</p><strong>${escapeHtml(lead.full_name || "Family")}</strong></div>
      <span>${escapeHtml(statusLabel(lead.status))}</span>
    </div>
    <div class="family-journey-grid">
      ${stages.map((stage) => `
        <article class="${stage.done ? "done" : "open"}">
          <span>${escapeHtml(stage.label)}</span>
          <strong>${escapeHtml(stage.value)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function buildClientLeadTimeline(detail = {}) {
  const lead = detail.lead || {};
  const rows = [
    { type: "lead", label: "Lead created", title: lead.full_name || "Lead", detail: [lead.source, lead.care_type].filter(Boolean).join(" / "), at: lead.created_at },
    ...(detail.activity || []).map((row) => ({ type: "activity", label: titleCase(row.action || "activity"), title: titleCase(row.action || "activity"), detail: "", at: row.created_at, actor: row.profiles?.full_name || "" })),
    ...(detail.notes || []).map((row) => ({ type: "note", label: "Note", title: "Internal note", detail: row.body || "", at: row.created_at })),
    ...(detail.emailHistory || []).map((row) => ({ type: "email", label: row.status || "email", title: row.subject || "Email", detail: row.recipient_email || "", at: row.sent_at || row.created_at })),
    ...(detail.tours || []).map((row) => ({ type: "tour", label: row.status || "tour", title: "Tour", detail: row.notes || "", at: row.scheduled_at || row.created_at })),
    ...(detail.followUps || []).map((row) => ({ type: "follow_up", label: row.status || "follow-up", title: "Follow-up", detail: row.note || "", at: row.due_at || row.created_at }))
  ];
  return rows.filter((row) => row.at).sort((a, b) => safeTime(b.at) - safeTime(a.at));
}

function handleLeadDetailTabs(event) {
  const button = event.target.closest("[data-lead-detail-tab]");
  if (!button) return;
  setLeadDetailTab(button.dataset.leadDetailTab);
}

function setLeadDetailTab(tab = "timeline") {
  $$("[data-lead-detail-tab]").forEach((button) => {
    const active = button.dataset.leadDetailTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  $$("[data-lead-detail-panel]").forEach((panel) => {
    const active = panel.dataset.leadDetailPanel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function renderLeadTimeline(rows = [], target) {
  if (!target) return;
  target.innerHTML = rows.length ? rows.slice(0, 30).map((row) => `
    <article class="lead-timeline-item ${escapeHtml(row.type || "activity")}">
      <span>${escapeHtml(row.label || row.type || "Activity")}</span>
      <strong>${escapeHtml(row.title || "Activity")}</strong>
      <small>${formatDate(row.at)}${row.actor ? ` &middot; ${escapeHtml(row.actor)}` : ""}</small>
      ${row.detail ? `<p>${escapeHtml(row.detail).slice(0, 220)}</p>` : ""}
    </article>
  `).join("") : empty("No timeline yet.");
}

async function handleSaveLeadNotes() {
  if (!app.selectedLeadDetail?.lead?.id) return;
  const out = $("[data-detail-status]");
  out.textContent = "Saving notes...";
  const notes = $("[data-detail-notes]").value;
  const data = await fetchJson(`/api/v2/leads/${app.selectedLeadDetail.lead.id}/notes`, {
    method: "PATCH",
    body: { notes }
  });
  app.selectedLeadDetail.lead = data.lead;
  out.textContent = "Notes saved.";
  await refreshAll();
  await openLeadDetail(data.lead.id);
}

async function handleGenerateLeadEmail() {
  if (!app.selectedLeadDetail?.lead?.id) return;
  const out = $("[data-detail-status]");
  out.textContent = "Generating draft...";
  const draft = await fetchJson(`/api/v2/leads/${app.selectedLeadDetail.lead.id}/email-draft`, { method: "POST" });
  $("[data-detail-email-subject]").value = draft.subject || "";
  $("[data-detail-email-body]").value = draft.body || "";
  out.textContent = draft.ai ? "AI draft generated. Please review before sending." : "Fallback draft generated. Please review before sending.";
  await refreshAll();
}

async function handleSendLeadEmail() {
  if (!app.selectedLeadDetail?.lead?.id) return;
  const out = $("[data-detail-status]");
  const subject = $("[data-detail-email-subject]").value;
  const body = $("[data-detail-email-body]").value;
  const sendFromGmail = $("[data-send-from-gmail]")?.checked === true;
  out.textContent = sendFromGmail ? "Sending from linked Gmail..." : "Sending email...";
  try {
    const result = await fetchJson(`/api/v2/leads/${app.selectedLeadDetail.lead.id}/email`, {
      method: "POST",
      body: { subject, body, sendFrom: sendFromGmail ? "gmail" : "smtp" }
    });
    out.textContent = result.result?.message || "Email sent.";
    await refreshAll();
    await openLeadDetail(app.selectedLeadDetail.lead.id);
  } catch (err) {
    out.textContent = err.message || "Email failed.";
    pushToast(out.textContent, "error");
  }
}

async function handleTourSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await fetchJson("/api/v2/tours", { method: "POST", body: Object.fromEntries(new FormData(form).entries()) });
  form.reset();
  await refreshAll();
}

async function handleFollowUpSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  const lead = app.leads.find((item) => item.id === body.leadId);
  await fetchJson("/api/v2/follow-ups", { method: "POST", body: { ...body, locationId: lead?.location_id } });
  form.reset();
  await refreshAll();
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const locationId = requireSingleLocation();
  await fetchJson("/api/v2/tasks", { method: "POST", body: { ...Object.fromEntries(new FormData(form).entries()), locationId } });
  form.reset();
  await refreshAll();
}

async function handleResidentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const body = Object.fromEntries(new FormData(form).entries());
  const room = (app.operations?.rooms || []).find((item) => item.id === body.roomId);
  if (!room) return pushToast("Choose an available room before adding a resident.", "error");
  const notes = body.roomCondition && body.roomCondition !== "ready"
    ? `[Room condition] ${roomConditionLabel(body.roomCondition)}`
    : "";
  try {
    if (submit) submit.disabled = true;
    await fetchJson("/api/v2/residents", { method: "POST", body: { ...body, locationId: room.location_id, notes } });
    form.reset();
    pushToast("Resident added and room marked occupied.", "success");
    await loadWorkflows().catch(() => {});
    await refreshAll();
  } catch (err) {
    pushToast(err.message || "Could not add resident.", "error");
  } finally {
    if (submit) submit.disabled = false;
  }
}

function openRoomConditionModal(residentId) {
  const resident = (app.operations?.residents || []).find((item) => item.id === residentId);
  if (!resident) return pushToast("Resident not found.", "error");
  app.pendingResidentDepartureId = residentId;
  const form = $("[data-room-condition-form]");
  form?.reset();
  const copy = $("[data-room-condition-copy]");
  if (copy) copy.textContent = `Before ${resident.full_name} leaves room ${resident.room_number || "unassigned"}, confirm the room condition.`;
  $("[data-room-condition-modal]")?.showModal();
}

async function handleRoomConditionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!app.pendingResidentDepartureId) return;
  const submit = form.querySelector("button[type='submit']");
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    if (submit) submit.disabled = true;
    setStatus("Confirming move-out...");
    await updateResidentStatus(app.pendingResidentDepartureId, {
      status: "moved_out",
      roomCondition: body.roomCondition,
      conditionNotes: body.conditionNotes
    });
    app.pendingResidentDepartureId = "";
    $("[data-room-condition-modal]")?.close();
    form.reset();
    setStatus("");
  } catch (err) {
    setStatus(err.message || "Could not confirm move-out.", true);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function updateResidentStatus(id, body) {
  await fetchJson(`/api/v2/residents/${id}/status`, { method: "PATCH", body });
  pushToast(body.status === "moved_out" ? "Room condition confirmed." : "Resident status updated.", "success");
  await refreshAll();
}

async function updateOperationStatus(url, status, outcome = null) {
  if (!status) return;
  setStatus("Updating workflow...");
  await fetchJson(url, { method: "PATCH", body: { status } });
  await refreshAfterWorkflowChange(outcome);
  setStatus("");
}

function superDeleteButton(type, id) {
  if (!app.user?.isSuperAdmin) return "";
  return `<button class="danger ghost" data-hard-delete="${escapeHtml(type)}" data-id="${escapeHtml(id)}"><i data-lucide="trash-2"></i>Delete</button>`;
}

function bindHardDeleteButtons(root = document) {
  $$("[data-hard-delete]", root).forEach((button) => {
    if (button.dataset.boundHardDelete === "true") return;
    button.dataset.boundHardDelete = "true";
    button.addEventListener("click", () => hardDeleteRecord(button.dataset.hardDelete, button.dataset.id));
  });
}

async function hardDeleteRecord(type, id) {
  if (!app.user?.isSuperAdmin || !type || !id) return;
  const label = type.replace("-", " ");
  const confirmed = await showConfirm(`Delete ${label}`, `Permanently delete this ${label}? This cannot be undone. Use only for bad/test data.`);
  if (!confirmed) return;
  const route = {
    lead: `/api/v2/leads/${id}`,
    room: `/api/v2/rooms/${id}`,
    resident: `/api/v2/residents/${id}`,
    tour: `/api/v2/tours/${id}`,
    "follow-up": `/api/v2/follow-ups/${id}`,
    task: `/api/v2/tasks/${id}`
  }[type];
  if (!route) return;
  try {
    setStatus(`Deleting ${label}...`);
    await fetchJson(route, {
      method: "DELETE",
      body: { permanent: true, reason: "Super Admin cleanup from admin-v2", sourceRoute: "admin-v2" }
    });
    pushToast(`${titleCase(label)} deleted.`, "success");
    await refreshAll();
  } catch (err) {
    pushToast(err.message || `Could not delete ${label}.`, "error");
  } finally {
    setStatus("");
  }
}

async function restoreLead(id) {
  if (!id) return;
  await fetchJson(`/api/v2/leads/${id}/status`, { method: "PATCH", body: { status: "contacted" } });
  pushToast("Lead restored.", "success");
  await refreshAll();
}

async function handleDocumentUpload(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const file = form.file.files[0];
  if (!file) return;
  const locationId = requireSingleLocation();
  setStatus("Creating secure upload URL...");
  const signed = await fetchJson("/api/v2/documents/upload-url", {
    method: "POST",
    body: { locationId, fileName: file.name, entityType: form.entityType.value }
  });
  if (!app.supabase) {
    throw new Error("Secure browser storage client is not available. Add SUPABASE_ANON_KEY and refresh.");
  }
  const { error } = await app.supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file);
  if (error) throw error;
  await fetchJson("/api/v2/documents", {
    method: "POST",
    body: {
      locationId,
      storagePath: signed.path,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      entityType: form.entityType.value,
      documentType: form.documentType.value || "Other"
    }
  });
  form.reset();
  await refreshAll();
}

function setQuickFollowUp(leadId) {
  setView("followups");
  const lead = app.leads.find((item) => item.id === leadId);
  if (!lead) return;
  $("[data-followup-lead]").value = leadId;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  $("[data-followup-form]").dueAt.value = toLocalDatetime(tomorrow);
}

function hydrateLeadSelects() {
  const options = app.leads.map((lead) => `<option value="${lead.id}">${escapeHtml(lead.full_name)} &middot; ${escapeHtml(locationName(lead.location_id))}</option>`).join("");
  ["[data-tour-lead]", "[data-followup-lead]"].forEach((selector) => {
    const select = $(selector);
    select.innerHTML = options || `<option value="">No leads available</option>`;
  });
  const residentLead = $("[data-resident-lead]");
  residentLead.innerHTML = `<option value="">No linked lead</option>${options}`;
  hydrateResidentRoomSelect();
}

function hydrateResidentRoomSelect() {
  const select = $("[data-resident-room]");
  if (!select) return;
  const current = select.value;
  const assignable = (app.operations?.rooms || []).filter((room) => {
    const status = roomCurrentStatus(room);
    return ["available", "reserved"].includes(status) && !room.current_resident_id;
  });
  select.innerHTML = `<option value="">Choose available room...</option>${assignable.map((room) => `
    <option value="${escapeHtml(room.id)}">
      Room ${escapeHtml(room.room_number || "")} - ${escapeHtml(locationName(room.location_id))} - ${escapeHtml(roomStatusLabel(roomCurrentStatus(room)))}${room.monthly_rate ? ` - ${formatMoney(room.monthly_rate)}/mo` : ""}
    </option>
  `).join("")}`;
  select.value = assignable.some((room) => room.id === current) ? current : "";
}

function requireSingleLocation() {
  const locationId = app.selectedLocationId || (!app.user?.isSuperAdmin && app.locations[0]?.id) || "";
  if (!locationId) {
    const error = new Error("Choose one location first.");
    setStatus(error.message, true);
    throw error;
  }
  return locationId;
}

async function withButtonLoading(button, fn) {
  if (!button || button.dataset.loading) return;
  button.dataset.loading = "true";
  button.disabled = true;
  try {
    return await fn();
  } finally {
    delete button.dataset.loading;
    button.disabled = false;
  }
}


function renderCards(selector, rows, render) {
  const target = $(selector);
  target.innerHTML = rows?.length ? rows.map((row) => `<article class="card">${render(row)}</article>`).join("") : empty("Nothing here yet.");
}

function renderFilteredActivity() {
  const filter = $("[data-activity-filter]")?.value || "";
  const allRows = [...(app.dashboard?.recentActivity || []), ...(app.operations?.notes || [])];
  const rows = filter ? allRows.filter((row) => {
    const type = String(row.event_type || row.action || "").toLowerCase();
    return type.includes(filter);
  }) : allRows;
  renderActivity(rows, $("[data-activity-list]"));
}

function activityIcon(row) {
  const type = String(row.event_type || row.action || "").toLowerCase();
  if (type.includes("move_in") || type.includes("moved")) return "home";
  if (type.includes("tour")) return "calendar-days";
  if (type.includes("follow") || type.includes("followup")) return "bell-ring";
  if (type.includes("lead") || type.includes("contact")) return "user";
  if (type.includes("note")) return "sticky-note";
  if (type.includes("task")) return "list-checks";
  if (type.includes("room")) return "door-open";
  if (type.includes("email") || type.includes("outreach")) return "mail";
  return "activity";
}

function activitySeverity(row) {
  const type = String(row.event_type || row.action || "").toLowerCase();
  if (type.includes("move_in")) return "success";
  if (type.includes("urgent") || type.includes("escalat")) return "danger";
  return "";
}

function renderActivity(rows, target) {
  if (!rows?.length) { target.innerHTML = empty("No activity yet."); return; }
  const sorted = [...rows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  target.innerHTML = sorted.slice(0, 40).map((row) => {
    const action = row.action || row.event_type || "activity";
    const detail = row.detail || row.notes || row.description || "";
    const who = row.profiles?.full_name || row.user_email || "";
    const icon = activityIcon(row);
    const sev = activitySeverity(row);
    return `
      <article class="activity-item ${sev}">
        <span class="activity-icon"><i data-lucide="${escapeHtml(icon)}"></i></span>
        <div class="activity-body">
          <strong>${escapeHtml(action.replace(/_/g, " "))}</strong>
          ${detail ? `<p>${escapeHtml(String(detail).slice(0, 120))}</p>` : ""}
          <small>${formatDate(row.created_at)}${who ? ` &middot; ${escapeHtml(who)}` : ""}</small>
        </div>
      </article>
    `;
  }).join("");
  iconRefresh();
}

function statusOptions(current) {
  return [
    ["new", "New"],
    ["contacted", "Contacted"],
    ["tour_scheduled", "Tour scheduled"],
    ["move_in", "Move in"],
    ["archived", "Archived"]
  ].map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`).join("");
}

function statusLabel(status) {
  return ([
    ["new", "New"],
    ["contacted", "Contacted"],
    ["tour_scheduled", "Tour scheduled"],
    ["move_in", "Move in"],
    ["archived", "Archived"]
  ].find(([value]) => value === status)?.[1]) || status;
}

function bar(label, value, max, percentValue = null) {
  const numeric = percentValue ?? (Number(value) || 0);
  const percent = Math.max(3, Math.min(100, Math.round((numeric / max) * 100)));
  return `
    <div class="bar">
      <span class="bar-label">${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
      <strong class="bar-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function reportBar(label, value, max, percentValue = null) {
  const numeric = percentValue ?? (Number(value) || 0);
  const percent = Math.max(3, Math.min(100, Math.round((numeric / max) * 100)));
  return `
    <div class="report-row">
      <span class="report-label">${escapeHtml(label)}</span>
      <strong class="report-value">${escapeHtml(value)}</strong>
      <div class="report-track"><div class="report-fill" style="width:${percent}%"></div></div>
    </div>
  `;
}

function leadName(id) {
  return app.leads.find((lead) => lead.id === id)?.full_name || "";
}

function locationName(id) {
  return app.locations.find((location) => location.id === id)?.name || "Unknown";
}

function roleLabel(role = "") {
  return titleCase(role.replaceAll("_", " "));
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function firstName(value = "") {
  return String(value || "").trim().split(/\s+/)[0] || "";
}

function toLocalDatetime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function empty(message) {
  const text = String(message || "Nothing here yet.");
  const actionable = /No leads|No rooms|No campaigns|No referral|No source|Nothing here/.test(text);
  return `<p class="empty ${actionable ? "actionable-empty" : ""}"><i data-lucide="${actionable ? "plus-circle" : "circle-check"}"></i><span>${escapeHtml(text)}</span></p>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function setStatus(message, isError = false) {
  if (isError && message) {
    // Errors go to toast only — not the status bar (which gets overwritten)
    pushToast(message, "error");
    return;
  }
  const out = $("[data-global-status]");
  out.textContent = message || "";
  out.style.color = "var(--muted)";
}

function pushToast(message, kind = "info") {
  const stack = $("[data-toast-stack]");
  if (!stack || !message) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  stack.append(toast);
  const visibleMs = kind === "error" ? 6500 : 4500;
  setTimeout(() => {
    toast.classList.add("toast-leave");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, visibleMs);
}

function relativeTime(value) {
  if (!value) return { text: "", severity: "low", diffMin: 0 };
  const target = typeof value === "number" ? value : new Date(value).getTime();
  if (Number.isNaN(target)) return { text: "", severity: "low", diffMin: 0 };
  const diffMin = Math.round((target - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  let unit;
  if (abs < 1) unit = "now";
  else if (abs < 60) unit = `${abs}m`;
  else if (abs < 60 * 24) unit = `${Math.round(abs / 60)}h`;
  else unit = `${Math.round(abs / (60 * 24))}d`;
  let text = unit;
  if (unit !== "now") text = diffMin < 0 ? `${unit} late` : `in ${unit}`;
  let severity = "low";
  if (diffMin < 0) {
    if (abs >= 60) severity = "critical";
    else if (abs >= 15) severity = "high";
    else severity = "warn";
  } else if (diffMin <= 30) {
    severity = "warn";
  }
  return { text, severity, diffMin };
}

function isCoordinationEventCurrent(event, now = Date.now()) {
  const type = event?.event_type || "";
  const metadata = event?.metadata || {};
  if (type === "follow_up_overdue") {
    const ids = Array.isArray(metadata.follow_up_ids) ? metadata.follow_up_ids.map(String) : [];
    const activeOverdue = (app.operations?.followUps || []).filter((item) => {
      const due = item.due_at ? new Date(item.due_at).getTime() : 0;
      const sameLocation = !event.location_id || item.location_id === event.location_id;
      const sameEvent = !ids.length || ids.includes(String(item.id));
      return sameLocation && sameEvent && !INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase()) && due && due < now;
    });
    return activeOverdue.length > 0;
  }
  if (type === "high_intent_lead_uncontacted") {
    const lead = findLead(event.entity_id || metadata.lead_id);
    return Boolean(lead && String(lead.status || "").toLowerCase() === "new");
  }
  if (["lead_stale", "recovery_opportunity_detected"].includes(type)) {
    const lead = findLead(event.entity_id || metadata.lead_id);
    return Boolean(lead && !["archived", "move_in"].includes(String(lead.status || "").toLowerCase()));
  }
  if (type === "tour_no_show_risk") {
    const tourId = event.entity_id || metadata.tour_id;
    const tour = (app.operations?.tours || []).find((item) => String(item.id) === String(tourId));
    return Boolean(tour && !INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase()));
  }
  return true;
}

function renderCoordinationStrip() {
  const strip = $("[data-coordination-strip]");
  if (!strip) return;
  const nowList = $("[data-coord-now]");
  const nextList = $("[data-coord-next]");
  const overdueList = $("[data-coord-overdue]");
  if (!nowList || !nextList || !overdueList) return;

  // Skip re-render if source data hasn't changed
  const fingerprint = JSON.stringify([
    (app.operations?.followUps || []).map((f) => f.id + f.status + f.due_at).join(","),
    (app.operations?.tours || []).map((t) => t.id + t.status + t.scheduled_at).join(","),
    (app.intelligence?.zones?.now || []).map((e) => e.id + e.severity).join(",")
  ]);
  if (strip.dataset.lastFingerprint === fingerprint) return;
  strip.dataset.lastFingerprint = fingerprint;

  const now = Date.now();
  const horizon = now + COORD_HORIZON_MS;
  const next = [];
  const overdue = [];

  (app.operations?.followUps || []).forEach((item) => {
    if (INACTIVE_FOLLOWUP_STATUSES.has(String(item.status || "").toLowerCase())) return;
    const due = item.due_at ? new Date(item.due_at).getTime() : null;
    if (!due || Number.isNaN(due)) return;
    const entry = {
      kind: "follow_up",
      title: leadName(item.lead_id) || "Follow-up",
      detail: item.note || "Follow up scheduled",
      time: due,
      leadId: item.lead_id,
      sourceId: item.id
    };
    if (due < now) overdue.push(entry);
    else if (due <= horizon) next.push(entry);
  });

  (app.operations?.tours || []).forEach((tour) => {
    if (INACTIVE_TOUR_STATUSES.has(String(tour.status || "").toLowerCase())) return;
    const time = tour.scheduled_at ? new Date(tour.scheduled_at).getTime() : null;
    if (!time || Number.isNaN(time)) return;
    const entry = {
      kind: "tour",
      title: leadName(tour.lead_id) || "Tour",
      detail: tour.notes || "Tour scheduled",
      time,
      leadId: tour.lead_id,
      sourceId: tour.id
    };
    if (time < now) overdue.push(entry);
    else if (time <= horizon) next.push(entry);
  });

  next.sort((a, b) => a.time - b.time);
  overdue.sort((a, b) => a.time - b.time);

  const nowZone = (app.intelligence?.zones?.now || [])
    .filter((event) => isCoordinationEventCurrent(event, now))
    .slice(0, 4);

  nowList.innerHTML = nowZone.length
    ? nowZone.map(renderCoordIntelItem).join("")
    : `<div class="coord-empty">Operations are calm right now.</div>`;
  nextList.innerHTML = next.length
    ? next.slice(0, 6).map(renderCoordTimedItem).join("")
    : `<div class="coord-empty">Nothing in the next 4 hours.</div>`;
  overdueList.innerHTML = overdue.length
    ? overdue.slice(0, 6).map(renderCoordTimedItem).join("")
    : `<div class="coord-empty">Nothing overdue. Nice.</div>`;

  const setCount = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = String(value);
  };
  setCount("[data-coord-now-count]", nowZone.length);
  setCount("[data-coord-next-count]", next.length);
  setCount("[data-coord-overdue-count]", overdue.length);
}

function renderCoordTimedItem(entry) {
  const rel = relativeTime(entry.time);
  const kindLabel = entry.kind === "tour" ? "Tour" : "Follow-up";
  return `
    <button class="coord-item ${escapeHtml(rel.severity)}" data-intel-open-lead="${escapeHtml(entry.leadId || "")}">
      <span class="coord-item-body">
        <span class="coord-item-title">${escapeHtml(entry.title)}</span>
        <span class="coord-item-detail">${escapeHtml(kindLabel)} &middot; ${escapeHtml(entry.detail)}</span>
      </span>
      <span class="coord-time">${escapeHtml(rel.text || "soon")}</span>
    </button>
  `;
}

function renderCoordIntelItem(event) {
  const severity = event.severity === "critical" ? "critical" : event.severity === "high" ? "high" : "warn";
  const time = compactTimeContext(event.time_context || event.detectedAgo || "");
  const leadAttr = event.entity_type === "lead" && event.entity_id
    ? `data-intel-open-lead="${escapeHtml(event.entity_id)}"`
    : `data-intel-view="leads"`;
  return `
    <button class="coord-item ${escapeHtml(severity)}" ${leadAttr}>
      <span class="coord-item-body">
        <span class="coord-item-title">${escapeHtml(event.title || "Operational signal")}</span>
        <span class="coord-item-detail">${escapeHtml(event.reason || event.description || "Needs review")}</span>
      </span>
      <span class="coord-time">${escapeHtml(time || "now")}</span>
    </button>
  `;
}

function setLoginStatus(message) {
  $("[data-login-status]").textContent = message || "";
}
