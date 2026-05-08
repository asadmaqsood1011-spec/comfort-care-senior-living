// @ts-check

const app = {
  supabase: null,
  session: null,
  user: null,
  locations: [],
  selectedLocationId: "",
  dashboard: null,
  intelligence: null,
  leads: [],
  operations: { residents: [], tours: [], followUps: [], tasks: [], notes: [], documents: [], emailHistory: [] },
  checkIns: [],
  selectedLeadDetail: null,
  activeView: "dashboard"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const INACTIVE_FOLLOWUP_STATUSES = new Set(["completed", "archived", "missed", "done"]);
const INACTIVE_TOUR_STATUSES = new Set(["completed", "no_show", "cancelled"]);
const COORD_HORIZON_MS = 4 * 60 * 60 * 1000;
let coordinationTicker = null;
let silentRefreshTimer = null;

boot();

window.addEventListener("unhandledrejection", (event) => {
  setStatus(event.reason?.message || "Something went wrong.", true);
});

async function boot() {
  bindStaticEvents();
  setStatus("Loading secure CRM...");
  try {
    const config = await fetchJson("/api/v2/config", { skipAuth: true });
    if (config.supabaseAnonKey) {
      app.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    if (config.authMode === "browser" && config.supabaseAnonKey) {
      const { data } = await app.supabase.auth.getSession();
      app.session = data.session;
    } else {
      app.session = readStoredSession();
    }
    if (app.session) await loadSession();
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
  $("[data-refresh]").addEventListener("click", refreshAll);
  $("[data-location-switcher]").addEventListener("change", (event) => {
    app.selectedLocationId = event.target.value;
    refreshAll();
  });
  $("[data-panel='dashboard']").addEventListener("click", handleIntelligenceClick);
  $("[data-coordination-strip]").addEventListener("click", handleIntelligenceClick);
  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $("[data-lead-search]").addEventListener("input", debounce(loadLeads, 250));
  $("[data-lead-status-filter]").addEventListener("change", loadLeads);
  $("[data-open-create-lead]").addEventListener("click", openCreateLead);
  $("[data-close-create-lead]").addEventListener("click", () => $("[data-create-lead-modal]").close());
  $("[data-create-lead-form]").addEventListener("submit", handleCreateLead);
  $("[data-export-leads]").addEventListener("click", handleLeadExport);
  $("[data-close-lead-detail]").addEventListener("click", () => $("[data-lead-detail-modal]").close());
  $("[data-save-lead-notes]").addEventListener("click", handleSaveLeadNotes);
  $("[data-generate-lead-email]").addEventListener("click", handleGenerateLeadEmail);
  $("[data-send-lead-email]").addEventListener("click", handleSendLeadEmail);
  $("[data-detail-followup]").addEventListener("click", () => {
    if (app.selectedLeadDetail?.lead?.id) {
      $("[data-lead-detail-modal]").close();
      setQuickFollowUp(app.selectedLeadDetail.lead.id);
    }
  });
  $("[data-tour-form]").addEventListener("submit", handleTourSubmit);
  $("[data-followup-form]").addEventListener("submit", handleFollowUpSubmit);
  $("[data-task-form]").addEventListener("submit", handleTaskSubmit);
  $("[data-resident-form]").addEventListener("submit", handleResidentSubmit);
  $("[data-document-form]").addEventListener("submit", handleDocumentUpload);
  $("[data-open-create-user]").addEventListener("click", openCreateUser);
  $("[data-close-create-user]").addEventListener("click", () => $("[data-create-user-modal]").close());
  $("[data-create-user-form]").addEventListener("submit", handleCreateUser);
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
  showApp();
  refreshAll()
    .then(startBackgroundLoops)
    .catch((err) => setStatus(err.message || "Unable to load dashboard data.", true));
}

function startBackgroundLoops() {
  stopBackgroundLoops();
  coordinationTicker = setInterval(renderCoordinationStrip, 30_000);
  silentRefreshTimer = setInterval(silentRefresh, 60_000);
}

function stopBackgroundLoops() {
  if (coordinationTicker) clearInterval(coordinationTicker);
  if (silentRefreshTimer) clearInterval(silentRefreshTimer);
  coordinationTicker = null;
  silentRefreshTimer = null;
}

async function silentRefresh() {
  if (!app.session || document.hidden) return;
  const tasks = [loadDashboard(), loadIntelligence(), loadOperations()];
  if (app.activeView === "leads") tasks.push(loadLeads());
  if (app.activeView === "checkins") tasks.push(loadCheckIns());
  try { await Promise.all(tasks); } catch (_) { /* next tick will retry */ }
}

async function refreshAll() {
  if (!app.session) return;
  setStatus("Refreshing...");
  await Promise.all([loadDashboard(), loadIntelligence(), loadLeads(), loadOperations()]);
  if (app.activeView === "checkins") await loadCheckIns();
  setStatus("");
  iconRefresh();
}

async function loadDashboard() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.dashboard = await fetchJson(`/api/v2/dashboard${query}`);
  renderDashboard();
}

async function loadIntelligence() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.intelligence = await fetchJson(`/api/v2/intelligence${query}`);
  renderIntelligence();
}

async function loadLeads() {
  const params = new URLSearchParams();
  if (app.selectedLocationId) params.set("locationId", app.selectedLocationId);
  const status = $("[data-lead-status-filter]").value;
  const search = $("[data-lead-search]").value.trim();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const data = await fetchJson(`/api/v2/leads?${params.toString()}`);
  app.leads = data.leads || [];
  renderLeads();
  hydrateLeadSelects();
}

async function loadOperations() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  app.operations = await fetchJson(`/api/v2/operations${query}`);
  renderOperations();
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

function setView(view) {
  app.activeView = view;
  $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
  $("[data-page-title]").textContent = titleCase(view.replace("-", " "));
  if (view === "users") loadUsers();
  if (view === "checkins") loadCheckIns();
  iconRefresh();
}

function renderDashboard() {
  const metrics = app.dashboard?.metrics || {};
  const items = [
    ["Total leads", metrics.totalLeads || 0],
    ["Tours scheduled", metrics.toursScheduled || 0],
    ["Move-ins", metrics.moveIns || 0],
    ["Conversion rate", `${metrics.conversionRate || 0}%`],
    ["Overdue follow-ups", metrics.overdueFollowUps || 0],
    ["Open tasks", metrics.openTasks || 0]
  ];
  $("[data-metrics]").innerHTML = items.map(([label, value]) => `
    <article class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>
  `).join("");

  const comparison = app.dashboard?.locationComparison || [];
  $("[data-location-comparison]").innerHTML = comparison.length ? comparison.map((row) => `
    <article class="card">
      <div class="card-head"><strong>${escapeHtml(row.name)}</strong><span class="badge">${row.conversionRate}% conv.</span></div>
      <small>${row.leads} leads · ${row.tours} tours · ${row.moveIns} move-ins · ${row.overdueFollowUps} overdue</small>
    </article>
  `).join("") : empty("No assigned locations yet.");

  renderActivity(app.dashboard?.recentActivity || [], $("[data-recent-activity]"));
  renderReports();
  renderIntelligence();
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
          <small>${escapeHtml(locationName(item.location_id))}${item.ago ? ` · ${escapeHtml(item.ago)}` : ""}${item.count > 1 ? ` · ${item.count} grouped` : ""}</small>
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
  iconRefresh();
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
            <small>Highest priority · ${escapeHtml(focus.focusWindow || "Today")}</small>
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
            <span>✓</span>
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
        <small>${escapeHtml(action.why)} ${action.timeContext ? `· ${escapeHtml(compactTimeContext(action.timeContext))}` : ""}</small>
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
    tbody.innerHTML = `<tr><td colspan="7">${empty("No leads found for this scope.")}</td></tr>`;
    return;
  }
  tbody.innerHTML = app.leads.map((lead) => `
    <tr>
      <td><strong>${escapeHtml(lead.full_name)}</strong><br><small>${escapeHtml(lead.email || "No email")}</small></td>
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
      </td>
    </tr>
  `).join("");

  $$("[data-status-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      await fetchJson(`/api/v2/leads/${select.dataset.statusSelect}/status`, {
        method: "PATCH",
        body: { status: select.value }
      });
      await refreshAll();
    });
  });
  $$("[data-quick-followup]").forEach((button) => {
    button.addEventListener("click", () => setQuickFollowUp(button.dataset.quickFollowup));
  });
  $$("[data-open-lead]").forEach((button) => {
    button.addEventListener("click", () => openLeadDetail(button.dataset.openLead));
  });
  iconRefresh();
}

async function loadCheckIns() {
  const query = app.selectedLocationId ? `?locationId=${encodeURIComponent(app.selectedLocationId)}` : "";
  const data = await fetchJson(`/api/v2/check-ins${query}`);
  app.checkIns = data.checkIns || [];
  renderCheckIns();
}

function renderOperations() {
  renderCards("[data-tours-list]", app.operations.tours, (tour) => `
    <div class="card-head"><strong>${escapeHtml(leadName(tour.lead_id))}</strong><span class="badge">${escapeHtml(tour.status)}</span></div>
    <small>${formatDate(tour.scheduled_at)} · ${escapeHtml(locationName(tour.location_id))}</small>
    <small>${escapeHtml(tour.notes || "")}</small>
    <div class="card-actions">
      <button class="ghost" data-tour-status="${tour.id}" data-status="completed"><i data-lucide="check-circle"></i>Complete</button>
      <button class="ghost" data-tour-status="${tour.id}" data-status="no_show"><i data-lucide="circle-off"></i>No-show</button>
      <button class="ghost" data-tour-status="${tour.id}" data-status="cancelled"><i data-lucide="x-circle"></i>Cancel</button>
    </div>
  `);
  renderCards("[data-followups-list]", app.operations.followUps, (item) => `
    <div class="card-head"><strong>${escapeHtml(leadName(item.lead_id) || "Resident follow-up")}</strong><span class="badge">${escapeHtml(item.status)}</span></div>
    <small>${formatDate(item.due_at)} · ${escapeHtml(locationName(item.location_id))}</small>
    <small>${escapeHtml(item.note || "")}</small>
    <div class="card-actions">
      <button class="ghost" data-followup-status="${item.id}" data-status="completed"><i data-lucide="check"></i>Done</button>
      <button class="ghost" data-followup-status="${item.id}" data-status="missed"><i data-lucide="clock-alert"></i>Missed</button>
      <button class="ghost" data-followup-status="${item.id}" data-status="archived"><i data-lucide="archive"></i>Archive</button>
    </div>
  `);
  renderCards("[data-tasks-list]", app.operations.tasks, (task) => `
    <div class="card-head"><strong>${escapeHtml(task.title)}</strong><span class="badge">${escapeHtml(task.status)}</span></div>
    <small>${escapeHtml(locationName(task.location_id))}${task.due_at ? ` · ${formatDate(task.due_at)}` : ""}</small>
    <small>${escapeHtml(task.notes || "")}</small>
    <div class="card-actions">
      <button class="ghost" data-task-status="${task.id}" data-status="in_progress"><i data-lucide="play"></i>Start</button>
      <button class="ghost" data-task-status="${task.id}" data-status="done"><i data-lucide="check"></i>Done</button>
      <button class="ghost" data-task-status="${task.id}" data-status="archived"><i data-lucide="archive"></i>Archive</button>
    </div>
  `);
  renderCards("[data-residents-list]", app.operations.residents, (resident) => `
    <div class="card-head"><strong>${escapeHtml(resident.full_name)}</strong><span class="badge">${escapeHtml(resident.status)}</span></div>
    <small>${escapeHtml(locationName(resident.location_id))} · Room ${escapeHtml(resident.room_number || "not set")}</small>
    <small>${resident.move_in_date ? `Move-in: ${escapeHtml(resident.move_in_date)}` : ""}</small>
  `);
  renderCards("[data-documents-list]", app.operations.documents, (doc) => `
    <div class="card-head"><strong>${escapeHtml(doc.file_name)}</strong><span class="badge">${escapeHtml(doc.document_type)}</span></div>
    <small>${escapeHtml(locationName(doc.location_id))} · ${escapeHtml(doc.file_type || "file")}</small>
    <button class="ghost" data-open-doc="${doc.id}"><i data-lucide="external-link"></i>Open</button>
  `);
  $$("[data-tour-status]").forEach((button) => {
    button.addEventListener("click", () => updateOperationStatus(`/api/v2/tours/${button.dataset.tourStatus}/status`, button.dataset.status));
  });
  $$("[data-followup-status]").forEach((button) => {
    button.addEventListener("click", () => updateOperationStatus(`/api/v2/follow-ups/${button.dataset.followupStatus}/status`, button.dataset.status));
  });
  $$("[data-task-status]").forEach((button) => {
    button.addEventListener("click", () => updateOperationStatus(`/api/v2/tasks/${button.dataset.taskStatus}/status`, button.dataset.status));
  });
  $$("[data-open-doc]").forEach((button) => {
    button.addEventListener("click", async () => {
      const data = await fetchJson(`/api/v2/documents/${button.dataset.openDoc}/signed-url`);
      window.open(data.url, "_blank", "noopener");
    });
  });
  renderActivity([...(app.dashboard?.recentActivity || []), ...(app.operations.notes || [])], $("[data-activity-list]"));
  renderCoordinationStrip();
  iconRefresh();
}

function renderCheckIns() {
  renderCards("[data-checkins-list]", app.checkIns, (row) => `
    <div class="card-head"><strong>${escapeHtml(row.visitor_name || row.name || "Visitor")}</strong><span class="badge">${escapeHtml(row.visit_purpose || "Visit")}</span></div>
    <small>${escapeHtml(row.community || "")} · ${formatDate(row.created_at)}</small>
    <small>${escapeHtml(row.phone || "")}${row.email ? ` · ${escapeHtml(row.email)}` : ""}</small>
    <small>${escapeHtml(row.visiting_resident || row.resident || "")}</small>
  `);
  iconRefresh();
}

function renderReports() {
  const rows = app.dashboard?.locationComparison || [];
  const maxLeads = Math.max(1, ...rows.map((row) => row.leads));
  $("[data-report-grid]").innerHTML = `
    <article class="card">
      <strong>Leads by location</strong>
      ${rows.map((row) => bar(row.name, row.leads, maxLeads)).join("")}
    </article>
    <article class="card">
      <strong>Conversion by location</strong>
      ${rows.map((row) => bar(row.name, `${row.conversionRate}%`, 100, row.conversionRate)).join("")}
    </article>
  `;
}

async function loadUsers() {
  if (!app.user?.isSuperAdmin) return;
  try {
    const data = await fetchJson("/api/v2/users");
    renderCards("[data-users-list]", data.users || [], (user) => `
      <div class="card-head"><strong>${escapeHtml(user.full_name || user.email)}</strong><span class="badge">${escapeHtml(user.role)}</span></div>
      <small>${escapeHtml(user.email)} · ${user.active ? "Active" : "Inactive"}</small>
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
  await loadUsers();
  setStatus("User created.");
}

async function updateUserActive(id, active) {
  setStatus(active ? "Reactivating user..." : "Deactivating user...");
  await fetchJson(`/api/v2/users/${id}/active`, { method: "PATCH", body: { active } });
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
  const detail = await fetchJson(`/api/v2/leads/${id}`);
  app.selectedLeadDetail = detail;
  const lead = detail.lead;
  $("[data-detail-name]").textContent = lead.full_name;
  $("[data-detail-notes]").value = lead.notes_summary || "";
  $("[data-detail-email-subject]").value = "";
  $("[data-detail-email-body]").value = "";
  $("[data-detail-meta]").innerHTML = `
    <article><span>Phone</span><strong>${escapeHtml(lead.phone)}</strong></article>
    <article><span>Email</span><strong>${escapeHtml(lead.email || "No email")}</strong></article>
    <article><span>Location</span><strong>${escapeHtml(locationName(lead.location_id))}</strong></article>
    <article><span>Status</span><strong>${escapeHtml(statusLabel(lead.status))}</strong></article>
    <article><span>Care type</span><strong>${escapeHtml(lead.care_type || "")}</strong></article>
    <article><span>Source</span><strong>${escapeHtml(lead.source || "")}</strong></article>
  `;
  renderActivity([...(detail.activity || []), ...(detail.notes || [])], $("[data-detail-activity]"));
  renderCards("[data-detail-emails]", detail.emailHistory || [], (email) => `
    <div class="card-head"><strong>${escapeHtml(email.subject)}</strong><span class="badge">${escapeHtml(email.status)}</span></div>
    <small>${formatDate(email.created_at)} · ${escapeHtml(email.recipient_email || "")}</small>
    <small>${escapeHtml(email.body || "").slice(0, 180)}${String(email.body || "").length > 180 ? "..." : ""}</small>
  `);
  $("[data-detail-status]").textContent = "";
  $("[data-lead-detail-modal]").showModal();
  iconRefresh();
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
  out.textContent = "Sending email...";
  const result = await fetchJson(`/api/v2/leads/${app.selectedLeadDetail.lead.id}/email`, {
    method: "POST",
    body: { subject, body }
  });
  out.textContent = result.result?.message || "Email sent.";
  await refreshAll();
  await openLeadDetail(app.selectedLeadDetail.lead.id);
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
  const body = Object.fromEntries(new FormData(form).entries());
  const lead = body.leadId ? app.leads.find((item) => item.id === body.leadId) : null;
  const locationId = lead?.location_id || requireSingleLocation();
  await fetchJson("/api/v2/residents", { method: "POST", body: { ...body, locationId } });
  form.reset();
  await refreshAll();
}

async function updateOperationStatus(url, status) {
  if (!status) return;
  setStatus("Updating workflow...");
  await fetchJson(url, { method: "PATCH", body: { status } });
  await refreshAll();
  setStatus("");
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
  const options = app.leads.map((lead) => `<option value="${lead.id}">${escapeHtml(lead.full_name)} · ${escapeHtml(locationName(lead.location_id))}</option>`).join("");
  ["[data-tour-lead]", "[data-followup-lead]"].forEach((selector) => {
    const select = $(selector);
    select.innerHTML = options || `<option value="">No leads available</option>`;
  });
  const residentLead = $("[data-resident-lead]");
  residentLead.innerHTML = `<option value="">No linked lead</option>${options}`;
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

async function fetchJson(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (!options.skipAuth) {
    const session = app.session || (app.supabase ? (await app.supabase.auth.getSession())?.data?.session : readStoredSession());
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  let response;
  try {
    response = await fetch(url, {
    method: options.method || "GET",
    headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Request timed out: ${url}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function renderCards(selector, rows, render) {
  const target = $(selector);
  target.innerHTML = rows?.length ? rows.map((row) => `<article class="card">${render(row)}</article>`).join("") : empty("Nothing here yet.");
}

function renderActivity(rows, target) {
  target.innerHTML = rows?.length ? rows.slice(0, 20).map((row) => `
    <article class="activity-item">
      <strong>${escapeHtml(row.action || row.event_type || "activity")}</strong>
      <small>${formatDate(row.created_at)}${row.profiles?.full_name ? ` · ${escapeHtml(row.profiles.full_name)}` : ""}</small>
    </article>
  `).join("") : empty("No activity yet.");
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
      <span>${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
      <strong>${escapeHtml(value)}</strong>
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

function toLocalDatetime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function empty(message) {
  return `<p class="empty">${escapeHtml(message)}</p>`;
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
  const out = $("[data-global-status]");
  out.textContent = message || "";
  out.style.color = isError ? "var(--danger)" : "var(--muted)";
  if (!message) return;
  if (isError) pushToast(message, "error");
  else if (!message.endsWith("...")) pushToast(message, "success");
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

function renderCoordinationStrip() {
  const strip = $("[data-coordination-strip]");
  if (!strip) return;
  const nowList = $("[data-coord-now]");
  const nextList = $("[data-coord-next]");
  const overdueList = $("[data-coord-overdue]");
  if (!nowList || !nextList || !overdueList) return;

  const now = Date.now();
  const horizon = now + COORD_HORIZON_MS;
  const next = [];
  const overdue = [];

  (app.operations?.followUps || []).forEach((item) => {
    if (INACTIVE_FOLLOWUP_STATUSES.has(item.status)) return;
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
    if (INACTIVE_TOUR_STATUSES.has(tour.status)) return;
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

  const nowZone = (app.intelligence?.zones?.now || []).slice(0, 4);

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

function readStoredSession() {
  try {
    const raw = localStorage.getItem("ccsl:v2-session");
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function storeSession(session) {
  if (!session) localStorage.removeItem("ccsl:v2-session");
  else localStorage.setItem("ccsl:v2-session", JSON.stringify(session));
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function iconRefresh() {
  window.lucide?.createIcons();
}
