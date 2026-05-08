const loginPanel = document.querySelector("[data-login-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector("[data-login-form]");
const adminViewTitle = document.querySelector("[data-admin-view-title]");
const adminViewLinks = document.querySelectorAll("[data-admin-view]");
const adminLocationToggle = document.querySelector("[data-admin-location-toggle]");
const adminLocationPopover = document.querySelector("[data-admin-location-popover]");
const adminLocationLabel = document.querySelector("[data-admin-location-label]");
const adminLocationSearch = document.querySelector("[data-admin-location-search]");
const adminLocationAll = document.querySelector("[data-admin-location-all]");
const adminLocationOptions = document.querySelector("[data-admin-location-options]");
const adminLocationReset = document.querySelector("[data-admin-location-reset]");
const adminLocationApply = document.querySelector("[data-admin-location-apply]");
const leadsBody = document.querySelector("[data-leads-body]");
const emptyState = document.querySelector("[data-empty]");
const pagination = document.querySelector("[data-pagination]");
const pagePrev = document.querySelector("[data-page-prev]");
const pageNext = document.querySelector("[data-page-next]");
const pageStatus = document.querySelector("[data-page-status]");
const searchInput = document.querySelector("[data-search]");
const communityFilter = document.querySelector("[data-filter-community]");
const sourceFilter = document.querySelector("[data-filter-source]");
const priorityFilter = document.querySelector("[data-filter-priority]");
const scoreFilter = document.querySelector("[data-filter-score]");
const statusFilter = document.querySelector("[data-filter-status]");
const dateFromFilter = document.querySelector("[data-filter-date-from]");
const dateToFilter = document.querySelector("[data-filter-date-to]");
const exportButton = document.querySelector("[data-export]");
const exportLabel = document.querySelector("[data-export-label]");
const leadDrawer = document.querySelector("[data-lead-drawer]");
const drawerName = document.querySelector("[data-drawer-name]");
const drawerMeta = document.querySelector("[data-drawer-meta]");
const drawerNotes = document.querySelector("[data-drawer-notes]");
const drawerNotesStatus = document.querySelector("[data-notes-status]");
const saveNotesBtn = document.querySelector("[data-save-notes]");
const generateLeadEmailBtn = document.querySelector("[data-generate-lead-email]");
const leadEmailSubject = document.querySelector("[data-lead-email-subject]");
const leadEmailBody = document.querySelector("[data-lead-email-body]");
const sendLeadEmailBtn = document.querySelector("[data-send-lead-email]");
const leadEmailStatus = document.querySelector("[data-lead-email-status]");
const leadTimeline = document.querySelector("[data-lead-timeline]");
const reminderDate = document.querySelector("[data-reminder-date]");
const reminderNote = document.querySelector("[data-reminder-note]");
const reminderStatus = document.querySelector("[data-reminder-status]");
const saveReminderBtn = document.querySelector("[data-save-reminder]");
const tourDate = document.querySelector("[data-tour-date]");
const tourStatus = document.querySelector("[data-tour-status]");
const saveTourBtn = document.querySelector("[data-save-tour]");
const clearTourBtn = document.querySelector("[data-clear-tour]");
const sourcePerformance = document.querySelector("[data-source-performance]");
const followupCount = document.querySelector("[data-followup-count]");
const followupList = document.querySelector("[data-followup-list]");
const communityCount = document.querySelector("[data-community-count]");
const communityList = document.querySelector("[data-community-list]");
const tourCount = document.querySelector("[data-tour-count]");
const tourList = document.querySelector("[data-tour-list]");
const occupancyList = document.querySelector("[data-occupancy-list]");
const saveOccupancyBtn = document.querySelector("[data-save-occupancy]");
const occupancyStatus = document.querySelector("[data-occupancy-status]");
const taskForm = document.querySelector("[data-task-form]");
const taskCommunity = document.querySelector("[data-task-community]");
const taskBoard = document.querySelector("[data-task-board]");
const taskStatus = document.querySelector("[data-task-status]");
const taskCount = document.querySelector("[data-task-count]");
const moveInForm = document.querySelector("[data-movein-form]");
const moveInLead = document.querySelector("[data-movein-lead]");
const moveInCommunity = document.querySelector("[data-movein-community]");
const saveMoveInBtn = document.querySelector("[data-save-movein]");
const moveInList = document.querySelector("[data-movein-list]");
const moveInStatus = document.querySelector("[data-movein-status]");
const packetLead = document.querySelector("[data-packet-lead]");
const packetCommunity = document.querySelector("[data-packet-community]");
const buildPacketBtn = document.querySelector("[data-build-packet]");
const printPacketBtn = document.querySelector("[data-print-packet]");
const packetPreview = document.querySelector("[data-packet-preview]");
const shiftForm = document.querySelector("[data-shift-form]");
const shiftCommunity = document.querySelector("[data-shift-community]");
const shiftList = document.querySelector("[data-shift-list]");
const shiftStatus = document.querySelector("[data-shift-status]");
const shiftCount = document.querySelector("[data-shift-count]");
const docForm = document.querySelector("[data-doc-form]");
const docCommunity = document.querySelector("[data-doc-community]");
const docList = document.querySelector("[data-doc-list]");
const docStatus = document.querySelector("[data-doc-status]");
const docCount = document.querySelector("[data-doc-count]");
let activeDrawerLeadId = null;
const importFile = document.querySelector("[data-import-file]");
const importCsv = document.querySelector("[data-import-csv]");
const importButton = document.querySelector("[data-import-leads]");
const importStatus = document.querySelector("[data-import-status]");
const addLeadTabs = document.querySelectorAll("[data-add-tab]");
const addLeadPanels = document.querySelectorAll("[data-add-panel]");
const manualLeadForm = document.querySelector("[data-manual-lead-form]");
const manualCommunity = document.querySelector("[data-manual-community]");
const manualCareType = document.querySelector("[data-manual-care-type]");
const draftCommunity = document.querySelector("[data-draft-community]");
const draftStatus = document.querySelector("[data-draft-status]");
const draftScore = document.querySelector("[data-draft-score]");
const draftSource = document.querySelector("[data-draft-source]");
const draftPriority = document.querySelector("[data-draft-priority]");
const draftButton = document.querySelector("[data-draft-email]");
const emailSubject = document.querySelector("[data-email-subject]");
const emailBody = document.querySelector("[data-email-body]");
const testRecipient = document.querySelector("[data-test-recipient]");
const sendTestButton = document.querySelector("[data-send-test-email]");
const demoCampaignButton = document.querySelector("[data-send-demo-campaign]");
const liveCampaignButton = document.querySelector("[data-send-live-campaign]");
const outreachStatus = document.querySelector("[data-outreach-status]");
const campaignHistoryList = document.querySelector("[data-campaign-history]");
const campaignHistoryStatus = document.querySelector("[data-campaign-history-status]");
const showArchivedCampaigns = document.querySelector("[data-show-archived-campaigns]");
const dailyReportStatus = document.querySelector("[data-daily-report-status]");
const dailyReportSummary = document.querySelector("[data-daily-report-summary]");
const generateDailyReportBtn = document.querySelector("[data-generate-daily-report]");
const copyDailyReportBtn = document.querySelector("[data-copy-daily-report]");
const reportChartScope = document.querySelector("[data-report-chart-scope]");
const reportTrend = document.querySelector("[data-report-trend]");
const reportPipeline = document.querySelector("[data-report-pipeline]");
const reportSourceChart = document.querySelector("[data-report-source-chart]");
const reportCareChart = document.querySelector("[data-report-care-chart]");
const generateForecastBtn = document.querySelector("[data-generate-forecast]");
const forecastRate = document.querySelector("[data-forecast-rate]");
const forecastResult = document.querySelector("[data-forecast-result]");
const forecastSummary = document.querySelector("[data-forecast-summary]");
const forecastStatus = document.querySelector("[data-forecast-status]");
const checkInCommunity = document.querySelector("[data-checkin-community]");
const checkInDateFrom = document.querySelector("[data-checkin-date-from]");
const checkInDateTo = document.querySelector("[data-checkin-date-to]");
const checkInList = document.querySelector("[data-checkin-list]");
const checkInStatus = document.querySelector("[data-checkin-status]");
const refreshCheckInsBtn = document.querySelector("[data-refresh-checkins]");
const calendarStatus = document.querySelector("[data-calendar-status]");
const calendarConnectBtn = document.querySelector("[data-calendar-connect]");
const calendarDisconnectBtn = document.querySelector("[data-calendar-disconnect]");
const statuses = ["New", "Contacted", "Tour Scheduled", "Tour Completed", "Decision Pending", "Moved In", "Closed"];
const sources = ["Website", "Tablet", "Upload", "Admin"];
const careTypes = ["Assisted Living", "Memory Care", "Independent Living", "Continuum of Care", "Not sure yet"];
const priorityTags = ["Urgent", "Medicaid", "Memory Care", "Tour Ready", "Needs Pricing"];
const scoreLabels = ["Hot", "Warm", "Cold", "Stale"];
let occupancyRows = [];
let operationsData = {
  tasks: [],
  moveInChecklists: [],
  shiftNotes: [],
  documents: []
};
const followUpTemplates = {
  afterInquiry: {
    subject: "Thank you for reaching out to Comfort Care",
    body: "Hi {{first_name}},\n\nThank you for reaching out about {{community}}. Our team would be happy to answer questions about {{care_type}}, availability, pricing, and what daily life looks like here.\n\nWould you like us to help schedule a private tour or quick phone call?\n\nWarmly,\nThe Comfort Care Team"
  },
  afterTour: {
    subject: "Thank you for touring {{community}}",
    body: "Hi {{first_name}},\n\nThank you for visiting {{community}}. We enjoyed learning more about what your family is looking for and hope the tour helped you picture the care, comfort, and support available here.\n\nPlease reply with any questions, or let us know if you would like help with next steps.\n\nWarmly,\nThe Comfort Care Team"
  },
  noShow: {
    subject: "Would you like to reschedule your Comfort Care tour?",
    body: "Hi {{first_name}},\n\nWe missed you for your scheduled visit to {{community}} and understand that family schedules can change quickly.\n\nIf you would still like to explore {{care_type}} options, we would be happy to find another tour time that works better for you.\n\nWarmly,\nThe Comfort Care Team"
  },
  pricing: {
    subject: "Following up on pricing at {{community}}",
    body: "Hi {{first_name}},\n\nI wanted to follow up with helpful information about pricing and availability at {{community}}. Comfort Care is built around transparency, so our team can walk through care options, what is included, and any questions around payment or Medicaid waiver support.\n\nWould a quick call be helpful?\n\nWarmly,\nThe Comfort Care Team"
  },
  moveIn: {
    subject: "Next steps for move-in at {{community}}",
    body: "Hi {{first_name}},\n\nWe are excited to help with the next steps at {{community}}. Our team can walk through the move-in checklist, room preparation, paperwork, medications, and the first care plan meeting so the transition feels clear and supported.\n\nPlease reply with any questions or timing updates.\n\nWarmly,\nThe Comfort Care Team"
  },
  medicaid: {
    subject: "Medicaid waiver support at Comfort Care",
    body: "Hi {{first_name}},\n\nThank you for asking about support options at {{community}}. If Medicaid waiver is part of your planning, our team can help explain what information may be needed and how care options are reviewed.\n\nWe are happy to answer questions and help you understand next steps.\n\nWarmly,\nThe Comfort Care Team"
  }
};

// Funnel toggle
const funnelToggleBtn = document.getElementById("funnelToggleBtn");
const funnelSection = document.getElementById("funnelSection");
funnelToggleBtn?.addEventListener("click", () => {
  const hidden = funnelSection.hasAttribute("hidden");
  if (hidden) { funnelSection.removeAttribute("hidden"); funnelToggleBtn.querySelector(".funnel-toggle-icon").textContent = "▴"; }
  else { funnelSection.setAttribute("hidden", ""); funnelToggleBtn.querySelector(".funnel-toggle-icon").textContent = "▾"; }
});

function renderFunnel() {
  const container = document.querySelector("[data-funnel-bars]");
  if (!container) return;
  const stages = [
    { label: "New", key: "New", color: "#6c8ebf" },
    { label: "Contacted", key: "Contacted", color: "#7a9e7e" },
    { label: "Tour Scheduled", key: "Tour Scheduled", color: "#c9a96e" },
    { label: "Tour Completed", key: "Tour Completed", color: "#e0a96e" },
    { label: "Decision Pending", key: "Decision Pending", color: "#e07a5f" },
    { label: "Moved In", key: "Moved In", color: "#4caf7d" },
    { label: "Closed", key: "Closed", color: "rgba(255,255,255,0.18)" }
  ];
  const visibleLeads = scopedLeads();
  const counts = stages.map((s) => ({ ...s, count: visibleLeads.filter((l) => l.status === s.key).length }));
  const max = Math.max(...counts.map((s) => s.count), 1);
  container.innerHTML = counts.map((s) => `
    <div class="funnel-row">
      <span class="funnel-label">${escapeHtml(s.label)}</span>
      <div class="funnel-bar-wrap">
        <div class="funnel-bar" style="width:${Math.max(4, Math.round((s.count / max) * 100))}%;background:${s.color}"></div>
      </div>
      <span class="funnel-count">${s.count}</span>
    </div>
  `).join("");
}

// Score info popover toggle
const scoreInfoBtn = document.getElementById("scoreInfoBtn");
const scoreInfoPopover = document.getElementById("scoreInfoPopover");
scoreInfoBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const hidden = scoreInfoPopover.hasAttribute("hidden");
  if (hidden) scoreInfoPopover.removeAttribute("hidden");
  else scoreInfoPopover.setAttribute("hidden", "");
});
document.addEventListener("click", () => scoreInfoPopover?.setAttribute("hidden", ""));
const TOUR_PREVIEW_LIMIT = 4;
const COMMUNITIES = [
  "August Haus Comfort Care",
  "Bavarian Comfort Care",
  "Bay City Comfort Care",
  "Big Rapids Fields Comfort Care",
  "Chesaning Comfort Care",
  "Livonia Comfort Care",
  "Marshall Comfort Care",
  "Mount Pleasant Comfort Care",
  "Reed City Fields Comfort Care",
  "Shields/Saginaw Comfort Care",
  "Shelby Comfort Care",
  "Vassar Comfort Care"
];

let leads = [];
let checkIns = [];
let latestDailyReport = null;
const PAGE_SIZE = 30;
let currentLeadPage = 1;
let currentAdminView = "overview";
let availableAdminLocations = [];
let selectedAdminLocations = new Set();
let pendingAdminLocations = new Set();

window.lucide?.createIcons();
hydrateFilters();
fetchLeads();
setAdminView(getInitialAdminView(), { updateHash: false });

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = loginForm.querySelector(".form-status");
  status.textContent = "";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(loginForm).entries()))
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to log in.");
    loginForm.reset();
    await fetchLeads();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("[data-refresh]").addEventListener("click", fetchLeads);
document.querySelector("[data-logout]").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  leads = [];
  dashboard.hidden = true;
  loginPanel.hidden = false;
});

[searchInput, communityFilter, sourceFilter, priorityFilter, scoreFilter, statusFilter, dateFromFilter, dateToFilter].forEach((control) => {
  control.addEventListener("input", () => {
    currentLeadPage = 1;
    renderLeads();
  });
});
pagePrev?.addEventListener("click", () => {
  currentLeadPage = Math.max(1, currentLeadPage - 1);
  renderLeads();
});
pageNext?.addEventListener("click", () => {
  currentLeadPage += 1;
  renderLeads();
});

exportButton.addEventListener("click", exportLeads);
importFile.addEventListener("change", loadImportFile);
importButton.addEventListener("click", importLeads);
manualLeadForm?.addEventListener("submit", addManualLead);
addLeadTabs.forEach((button) => {
  button.addEventListener("click", () => switchAddLeadTab(button.dataset.addTab));
});
draftButton.addEventListener("click", draftEmail);
sendTestButton.addEventListener("click", sendTestEmail);
demoCampaignButton.addEventListener("click", logDemoCampaign);
liveCampaignButton.addEventListener("click", sendLiveCampaign);
document.querySelectorAll("[data-reminder-preset]").forEach((button) => {
  button.addEventListener("click", () => saveReminder(button.dataset.reminderPreset));
});
saveReminderBtn.addEventListener("click", () => saveReminder(reminderDate.value));
saveTourBtn.addEventListener("click", saveTour);
saveOccupancyBtn?.addEventListener("click", saveOccupancy);
taskForm?.addEventListener("submit", addTask);
saveMoveInBtn?.addEventListener("click", saveMoveInChecklist);
moveInLead?.addEventListener("change", loadMoveInChecklistIntoForm);
buildPacketBtn?.addEventListener("click", buildTourPacket);
printPacketBtn?.addEventListener("click", printTourPacket);
shiftForm?.addEventListener("submit", addShiftNote);
docForm?.addEventListener("submit", addDocument);
document.querySelectorAll("[data-template]").forEach((button) => {
  button.addEventListener("click", () => applyFollowUpTemplate(button.dataset.template));
});
clearTourBtn?.addEventListener("click", clearTour);
showArchivedCampaigns?.addEventListener("change", fetchCampaignHistoryV2);
generateDailyReportBtn?.addEventListener("click", () => fetchDailyReport(true));
copyDailyReportBtn?.addEventListener("click", copyDailyReport);
generateForecastBtn?.addEventListener("click", generateRevenueForecast);
refreshCheckInsBtn?.addEventListener("click", fetchCheckIns);
calendarConnectBtn?.addEventListener("click", connectCalendar);
calendarDisconnectBtn?.addEventListener("click", disconnectCalendar);
[checkInCommunity, checkInDateFrom, checkInDateTo].filter(Boolean).forEach((control) => {
  control.addEventListener("input", fetchCheckIns);
});
adminLocationToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  pendingAdminLocations = new Set(selectedAdminLocations);
  renderAdminLocationOptions();
  adminLocationPopover.hidden = !adminLocationPopover.hidden;
});
adminLocationSearch?.addEventListener("input", renderAdminLocationOptions);
adminLocationAll?.addEventListener("change", () => {
  if (adminLocationAll.checked) pendingAdminLocations.clear();
  renderAdminLocationOptions();
});
adminLocationReset?.addEventListener("click", () => {
  pendingAdminLocations.clear();
  applyAdminLocationFilter();
});
adminLocationApply?.addEventListener("click", applyAdminLocationFilter);
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-admin-location-filter]")) adminLocationPopover && (adminLocationPopover.hidden = true);
});
adminViewLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setAdminView(link.dataset.adminView || "overview");
  });
});

function getInitialAdminView() {
  const hash = window.location.hash.replace("#", "");
  return ["overview", "leads", "occupancy", "checkins", "tasks", "move-in", "shift-notes", "reports", "outreach", "tour-packets", "documents", "lead-entry", "settings"].includes(hash)
    ? hash
    : "overview";
}

function setAdminView(view, options = {}) {
  currentAdminView = view;
  const titles = {
    overview: "Overview",
    leads: "Leads CRM",
    occupancy: "Occupancy",
    checkins: "Visitor Check-Ins",
    tasks: "Task Board",
    "move-in": "Move-In Checklist",
    "shift-notes": "Shift Notes",
    reports: "Reports",
    outreach: "Mass Outreach",
    "tour-packets": "Tour Packets",
    documents: "Document Center",
    "lead-entry": "Add Leads",
    settings: "Settings"
  };
  if (adminViewTitle) adminViewTitle.textContent = titles[view] || "Overview";
  adminViewLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.adminView === view));

  const allPanels = [
    document.querySelector(".metrics"),
    document.querySelector(".source-performance"),
    document.querySelector(".community-panel"),
    document.querySelector(".tour-panel"),
    document.querySelector(".followup-panel"),
    document.querySelector(".occupancy-panel"),
    document.querySelector(".task-panel"),
    document.querySelector(".movein-panel"),
    document.querySelector(".packet-panel"),
    document.querySelector(".shift-panel"),
    document.querySelector(".docs-panel"),
    document.querySelector(".checkin-panel"),
    document.querySelector(".daily-report-panel"),
    document.querySelector(".reports-analytics"),
    document.querySelector(".forecast-panel"),
    document.querySelector(".settings-panel"),
    document.querySelector(".past-tour-panel"),
    document.querySelector(".funnel-toggle-bar"),
    document.querySelector(".funnel-section"),
    document.querySelector(".filters"),
    document.querySelector(".table-wrap"),
    document.querySelector(".admin-tools")
  ].filter(Boolean);
  allPanels.forEach((panel) => { panel.hidden = true; });

  const show = (selector) => {
    const element = document.querySelector(selector);
    if (element) element.hidden = false;
  };

  const toolCards = Array.from(document.querySelectorAll(".admin-tool-card"));
  toolCards.forEach((card) => { card.hidden = true; });

  if (view === "overview") {
    [".metrics", ".source-performance", ".community-panel", ".tour-panel", ".followup-panel"].forEach(show);
  } else if (view === "leads") {
    [".filters", ".table-wrap", ".past-tour-panel", ".funnel-toggle-bar", ".funnel-section"].forEach(show);
  } else if (view === "occupancy") {
    show(".occupancy-panel");
  } else if (view === "checkins") {
    show(".checkin-panel");
  } else if (view === "tasks") {
    show(".task-panel");
  } else if (view === "move-in") {
    show(".movein-panel");
  } else if (view === "shift-notes") {
    show(".shift-panel");
  } else if (view === "reports") {
    [".daily-report-panel", ".reports-analytics", ".forecast-panel", ".source-performance", ".community-panel"].forEach(show);
  } else if (view === "outreach") {
    show(".admin-tools");
    toolCards.slice(1).forEach((card) => { card.hidden = false; });
  } else if (view === "tour-packets") {
    show(".packet-panel");
  } else if (view === "documents") {
    show(".docs-panel");
  } else if (view === "lead-entry") {
    show(".admin-tools");
    if (toolCards[0]) toolCards[0].hidden = false;
  } else if (view === "settings") {
    show(".settings-panel");
  }

  if (options.updateHash !== false) {
    history.replaceState(null, "", `#${view}`);
  }
  window.lucide?.createIcons();
}
async function fetchLeads() {
  const response = await fetch("/api/admin/leads");
  if (response.status === 401) {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    return;
  }
  const data = await response.json();
  leads = data.leads || [];
  loginPanel.hidden = true;
  dashboard.hidden = false;
  hydrateFilters();
  renderLeads();
  setAdminView(currentAdminView, { updateHash: false });
  await fetchCheckIns();
  await fetchDailyReport(false);
  await fetchCampaignHistoryV2();
  await loadOccupancy();
  await loadOperations();
  loadAutoEmailSetting();
  loadCalendarStatus();
  loadResidents();
  loadIncidents();
}

async function loadOperations() {
  try {
    const response = await fetch("/api/admin/operations");
    if (response.status === 401) return;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load operations.");
    operationsData = {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      moveInChecklists: Array.isArray(data.moveInChecklists) ? data.moveInChecklists : [],
      shiftNotes: Array.isArray(data.shiftNotes) ? data.shiftNotes : [],
      documents: Array.isArray(data.documents) ? data.documents : []
    };
  } catch (error) {
    [taskStatus, moveInStatus, shiftStatus, docStatus].forEach((output) => { if (output) output.textContent = error.message; });
  }
  renderOperations();
}

async function loadOccupancy() {
  if (!occupancyList) return;
  try {
    const response = await fetch("/api/admin/occupancy");
    if (response.status === 401) return;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load occupancy.");
    occupancyRows = normalizeOccupancyRows(data.occupancy || []);
  } catch (error) {
    occupancyRows = normalizeOccupancyRows([]);
    if (occupancyStatus) occupancyStatus.textContent = error.message;
  }
  renderOccupancy();
}

async function fetchCheckIns() {
  if (!checkInList) return;
  const params = new URLSearchParams();
  if (checkInCommunity?.value) params.set("community", checkInCommunity.value);
  if (checkInDateFrom?.value) params.set("dateFrom", checkInDateFrom.value);
  if (checkInDateTo?.value) params.set("dateTo", checkInDateTo.value);

  checkInStatus.textContent = "Loading check-ins...";
  try {
    const response = await fetch(`/api/admin/check-ins?${params.toString()}`);
    if (response.status === 401) {
      checkInStatus.textContent = "";
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load check-ins.");
    checkIns = data.checkIns || [];
    renderCheckIns();
    checkInStatus.textContent = "";
  } catch (error) {
    checkInStatus.textContent = `${error.message} Run the facility_checkins SQL table if this is the first setup.`;
    checkInList.innerHTML = `<p class="muted">Visitor check-ins will appear here after the table is available.</p>`;
  }
}

function renderCheckIns() {
  if (!checkInList) return;
  const visibleCheckIns = checkIns.filter(isInAdminLocationScope);
  if (!visibleCheckIns.length) {
    checkInList.innerHTML = `<p class="muted">No visitor check-ins match these filters.</p>`;
    return;
  }

  checkInList.innerHTML = visibleCheckIns.slice(0, 12).map((item) => `
    <article class="checkin-item">
      <span>
        <strong>${escapeHtml(item.visitorName || "Visitor")}</strong>
        <small>${escapeHtml(item.community || "Unknown")} &middot; ${escapeHtml(item.visitPurpose || "Visit")}</small>
      </span>
      <span>
        <strong>${escapeHtml(item.visitingResident || "Not provided")}</strong>
        <small>${escapeHtml(item.phone || "No phone")} &middot; ${escapeHtml(formatDate(item.createdAt))}</small>
      </span>
    </article>
  `).join("");
}

function normalizeOccupancyRows(rows = []) {
  const byCommunity = new Map();
  rows.forEach((row) => {
    const community = row.community || "";
    if (!community) return;
    const totalRooms = clampNumber(row.totalRooms);
    const occupiedRooms = Math.min(totalRooms, clampNumber(row.occupiedRooms));
    byCommunity.set(community, {
      community,
      totalRooms,
      occupiedRooms,
      waitlist: clampNumber(row.waitlist),
      nextMoveIn: row.nextMoveIn || "",
      notes: row.notes || ""
    });
  });
  const communities = [...new Set([...COMMUNITIES, ...rows.map((row) => row.community).filter(Boolean)])]
    .sort((a, b) => a.localeCompare(b));
  return communities.map((community) => byCommunity.get(community) || {
    community,
    totalRooms: 0,
    occupiedRooms: 0,
    waitlist: 0,
    nextMoveIn: "",
    notes: ""
  });
}

function renderOccupancy() {
  if (!occupancyList) return;
  const visibleRows = occupancyRows.filter((row) => isInAdminLocationScope({ location: row.community }));
  const totalRooms = visibleRows.reduce((sum, row) => sum + clampNumber(row.totalRooms), 0);
  const occupiedRooms = visibleRows.reduce((sum, row) => sum + Math.min(clampNumber(row.occupiedRooms), clampNumber(row.totalRooms)), 0);
  const availableRooms = Math.max(0, totalRooms - occupiedRooms);
  const waitlist = visibleRows.reduce((sum, row) => sum + clampNumber(row.waitlist), 0);
  const rate = totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  setText("[data-occ-total]", totalRooms);
  setText("[data-occ-occupied]", occupiedRooms);
  setText("[data-occ-available]", availableRooms);
  setText("[data-occ-rate]", `${rate}%`);
  setText("[data-occ-waitlist]", waitlist);

  if (!visibleRows.length) {
    occupancyList.innerHTML = `<p class="muted">No communities match the current location filter.</p>`;
    return;
  }

  occupancyList.innerHTML = visibleRows.map((row) => `
    <article class="occupancy-row" data-occupancy-row="${escapeHtml(row.community)}">
      <div class="occupancy-community">
        <strong>${escapeHtml(row.community)}</strong>
        <small>${occupancyRowSummary(row)}</small>
      </div>
      <label>Total rooms<input type="number" min="0" max="999" data-occ-field="totalRooms" value="${clampNumber(row.totalRooms)}"></label>
      <label>Occupied<input type="number" min="0" max="999" data-occ-field="occupiedRooms" value="${clampNumber(row.occupiedRooms)}"></label>
      <label>Waitlist<input type="number" min="0" max="999" data-occ-field="waitlist" value="${clampNumber(row.waitlist)}"></label>
      <label>Next move-in<input type="date" data-occ-field="nextMoveIn" value="${escapeHtml(row.nextMoveIn || "")}"></label>
      <label class="occupancy-notes">Notes<input data-occ-field="notes" value="${escapeHtml(row.notes || "")}" placeholder="Room type, renovation, hold, etc."></label>
    </article>
  `).join("");

  occupancyList.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      mergeVisibleOccupancyInputs();
      renderOccupancySummaryOnly();
    });
  });
}

function renderOccupancySummaryOnly() {
  const visibleRows = occupancyRows.filter((row) => isInAdminLocationScope({ location: row.community }));
  const totalRooms = visibleRows.reduce((sum, row) => sum + clampNumber(row.totalRooms), 0);
  const occupiedRooms = visibleRows.reduce((sum, row) => sum + Math.min(clampNumber(row.occupiedRooms), clampNumber(row.totalRooms)), 0);
  setText("[data-occ-total]", totalRooms);
  setText("[data-occ-occupied]", occupiedRooms);
  setText("[data-occ-available]", Math.max(0, totalRooms - occupiedRooms));
  setText("[data-occ-rate]", `${totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0}%`);
  setText("[data-occ-waitlist]", visibleRows.reduce((sum, row) => sum + clampNumber(row.waitlist), 0));
}

function mergeVisibleOccupancyInputs() {
  const byCommunity = new Map(occupancyRows.map((row) => [row.community, { ...row }]));
  occupancyList?.querySelectorAll("[data-occupancy-row]").forEach((rowEl) => {
    const community = rowEl.dataset.occupancyRow || "";
    const next = byCommunity.get(community) || { community };
    rowEl.querySelectorAll("[data-occ-field]").forEach((input) => {
      const field = input.dataset.occField;
      next[field] = ["totalRooms", "occupiedRooms", "waitlist"].includes(field) ? clampNumber(input.value) : input.value;
    });
    next.occupiedRooms = Math.min(clampNumber(next.occupiedRooms), clampNumber(next.totalRooms));
    byCommunity.set(community, next);
  });
  occupancyRows = normalizeOccupancyRows([...byCommunity.values()]);
}

async function saveOccupancy() {
  if (!saveOccupancyBtn) return;
  mergeVisibleOccupancyInputs();
  saveOccupancyBtn.disabled = true;
  if (occupancyStatus) occupancyStatus.textContent = "Saving occupancy...";
  try {
    const response = await fetch("/api/admin/occupancy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occupancy: occupancyRows })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to save occupancy.");
    occupancyRows = normalizeOccupancyRows(data.occupancy || occupancyRows);
    renderOccupancy();
    if (occupancyStatus) occupancyStatus.textContent = "Occupancy saved.";
  } catch (error) {
    if (occupancyStatus) occupancyStatus.textContent = error.message;
  } finally {
    saveOccupancyBtn.disabled = false;
  }
}

function occupancyRowSummary(row) {
  const total = clampNumber(row.totalRooms);
  const occupied = Math.min(clampNumber(row.occupiedRooms), total);
  const available = Math.max(0, total - occupied);
  const rate = total ? Math.round((occupied / total) * 100) : 0;
  return `${available} available - ${rate}% occupied`;
}

function clampNumber(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, 999);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderOperations() {
  renderTasks();
  renderMoveIn();
  renderShiftNotes();
  renderDocuments();
  buildTourPacket(false);
}

function scopedByCommunity(rows) {
  return rows.filter((row) => isInAdminLocationScope({ location: row.community }));
}

async function saveOperationsSection(section, data, statusEl) {
  if (statusEl) statusEl.textContent = "Saving...";
  const response = await fetch("/api/admin/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, data })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to save.");
  operationsData[section] = result.data || data;
  if (statusEl) statusEl.textContent = result.message || "Saved.";
  renderOperations();
}

async function addTask(event) {
  event.preventDefault();
  const form = new FormData(taskForm);
  const task = {
    id: makeLocalId(),
    title: form.get("title"),
    community: form.get("community"),
    type: form.get("type"),
    assignedTo: form.get("assignedTo"),
    dueDate: form.get("dueDate"),
    status: "To Do",
    notes: form.get("notes"),
    createdAt: new Date().toISOString()
  };
  if (!task.title || !task.community) return;
  try {
    await saveOperationsSection("tasks", [task, ...operationsData.tasks], taskStatus);
    taskForm.reset();
  } catch (error) {
    if (taskStatus) taskStatus.textContent = error.message;
  }
}

function renderTasks() {
  if (!taskBoard) return;
  const tasks = scopedByCommunity(operationsData.tasks);
  const openCount = tasks.filter((task) => task.status !== "Done").length;
  if (taskCount) taskCount.textContent = `${openCount} open`;
  const columns = ["To Do", "In Progress", "Done"];
  taskBoard.innerHTML = columns.map((status) => {
    const columnTasks = tasks.filter((task) => task.status === status);
    return `
      <article class="task-column">
        <div class="task-column-head"><strong>${escapeHtml(status)}</strong><span>${columnTasks.length}</span></div>
        ${columnTasks.length ? columnTasks.map(renderTaskCard).join("") : `<p class="muted">No ${escapeHtml(status.toLowerCase())} tasks.</p>`}
      </article>
    `;
  }).join("");
  taskBoard.querySelectorAll("[data-task-status]").forEach((select) => {
    select.addEventListener("change", () => updateTaskStatus(select.dataset.taskStatus, select.value));
  });
  taskBoard.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => deleteTask(button.dataset.deleteTask));
  });
}

function renderTaskCard(task) {
  return `
    <div class="task-card">
      <strong>${escapeHtml(task.title)}</strong>
      <small>${escapeHtml(task.community)}${task.dueDate ? ` - Due ${escapeHtml(task.dueDate)}` : ""}</small>
      <p>${escapeHtml([task.type, task.assignedTo, task.notes].filter(Boolean).join(" | "))}</p>
      <div class="operations-actions">
        <select data-task-status="${escapeHtml(task.id)}">${["To Do", "In Progress", "Done"].map((status) => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>
        <button type="button" data-delete-task="${escapeHtml(task.id)}">Remove</button>
      </div>
    </div>
  `;
}

async function updateTaskStatus(id, status) {
  const tasks = operationsData.tasks.map((task) => task.id === id ? { ...task, status } : task);
  try { await saveOperationsSection("tasks", tasks, taskStatus); } catch (error) { if (taskStatus) taskStatus.textContent = error.message; }
}

async function deleteTask(id) {
  if (!window.confirm("Remove this task?")) return;
  try { await saveOperationsSection("tasks", operationsData.tasks.filter((task) => task.id !== id), taskStatus); } catch (error) { if (taskStatus) taskStatus.textContent = error.message; }
}

function loadMoveInChecklistIntoForm() {
  if (!moveInForm || !moveInLead) return;
  const lead = leads.find((item) => String(item.id) === String(moveInLead.value));
  const existing = operationsData.moveInChecklists.find((item) => String(item.leadId) === String(moveInLead.value));
  const form = moveInForm.elements;
  if (moveInCommunity) moveInCommunity.value = existing?.community || lead?.location || lead?.preferredCommunity || "";
  form.targetDate.value = existing?.targetDate || "";
  form.notes.value = existing?.notes || "";
  ["roomReady", "medList", "physicianForms", "paymentPaperwork", "familyContact", "carePlanMeeting"].forEach((key) => {
    form[key].checked = Boolean(existing?.items?.[key]);
  });
}

async function saveMoveInChecklist() {
  if (!moveInForm) return;
  const form = moveInForm.elements;
  const lead = leads.find((item) => String(item.id) === String(form.leadId.value));
  const checklist = {
    id: form.leadId.value || makeLocalId(),
    leadId: form.leadId.value,
    leadName: lead?.fullName || lead?.name || "Manual checklist",
    community: form.community.value || lead?.location || lead?.preferredCommunity || "",
    targetDate: form.targetDate.value,
    notes: form.notes.value,
    items: {
      roomReady: form.roomReady.checked,
      medList: form.medList.checked,
      physicianForms: form.physicianForms.checked,
      paymentPaperwork: form.paymentPaperwork.checked,
      familyContact: form.familyContact.checked,
      carePlanMeeting: form.carePlanMeeting.checked
    },
    updatedAt: new Date().toISOString()
  };
  if (!checklist.leadId && !checklist.leadName) return;
  const next = operationsData.moveInChecklists.filter((item) => String(item.leadId) !== String(checklist.leadId));
  try {
    await saveOperationsSection("moveInChecklists", [checklist, ...next], moveInStatus);
  } catch (error) {
    if (moveInStatus) moveInStatus.textContent = error.message;
  }
}

function renderMoveIn() {
  if (!moveInList) return;
  const rows = scopedByCommunity(operationsData.moveInChecklists);
  if (!rows.length) {
    moveInList.innerHTML = `<p class="muted">No move-in checklists yet.</p>`;
    return;
  }
  moveInList.innerHTML = rows.map((row) => {
    const total = Object.values(row.items || {}).length || 6;
    const done = Object.values(row.items || {}).filter(Boolean).length;
    return `
      <article class="operation-item">
        <span><strong>${escapeHtml(row.leadName || "Move-in")}</strong><small>${escapeHtml(row.community || "Unknown")} ${row.targetDate ? `- ${escapeHtml(row.targetDate)}` : ""}</small></span>
        <span class="operation-pill">${done}/${total} done</span>
        <button type="button" data-open-movein="${escapeHtml(row.leadId || row.id)}">Edit</button>
        <button type="button" data-delete-movein="${escapeHtml(row.leadId || row.id)}">Remove</button>
      </article>
    `;
  }).join("");
  moveInList.querySelectorAll("[data-open-movein]").forEach((button) => {
    button.addEventListener("click", () => {
      if (moveInLead) moveInLead.value = button.dataset.openMovein;
      loadMoveInChecklistIntoForm();
    });
  });
  moveInList.querySelectorAll("[data-delete-movein]").forEach((button) => {
    button.addEventListener("click", () => deleteOperationItem("moveInChecklists", button.dataset.deleteMovein, moveInStatus));
  });
}

function buildTourPacket(updateStatus = true) {
  if (!packetPreview) return;
  const lead = leads.find((item) => String(item.id) === String(packetLead?.value));
  const community = packetCommunity?.value || lead?.location || lead?.preferredCommunity || selectedAdminLocations.values().next().value || "Comfort Care Senior Living";
  if (!lead && !community) return;
  const docs = operationsData.documents.filter((doc) => !doc.community || doc.community === community);
  const available = occupancyRows.find((row) => row.community === community);
  packetPreview.innerHTML = `
    <article class="packet-sheet">
      <p class="eyebrow">Private Tour Packet</p>
      <h2>${escapeHtml(community)}</h2>
      <div class="packet-grid">
        <div><strong>Family</strong><span>${escapeHtml(lead?.fullName || lead?.name || "Tour guest")}</span></div>
        <div><strong>Care type</strong><span>${escapeHtml(lead?.careType || "Not sure yet")}</span></div>
        <div><strong>Phone</strong><span>${escapeHtml(lead?.phone || "Not provided")}</span></div>
        <div><strong>Email</strong><span>${escapeHtml(lead?.email || "Not provided")}</span></div>
      </div>
      <h3>What to cover on the tour</h3>
      <ul>
        <li>Care needs, timeline, and preferred communication</li>
        <li>Transparent pricing and what is included</li>
        <li>Available rooms and next move-in timing</li>
        <li>Dining, activities, safety, and clinical support</li>
      </ul>
      <h3>Operations snapshot</h3>
      <p>${available ? `${Math.max(0, available.totalRooms - available.occupiedRooms)} rooms available, ${available.waitlist || 0} on waitlist${available.nextMoveIn ? `, next move-in ${available.nextMoveIn}` : ""}.` : "No occupancy details saved yet."}</p>
      <h3>Useful documents</h3>
      ${docs.length ? `<ul>${docs.slice(0, 6).map((doc) => `<li><a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.title)}</a> - ${escapeHtml(doc.type)}</li>`).join("")}</ul>` : `<p>No documents linked for this community yet.</p>`}
      <h3>Lead notes</h3>
      <p>${escapeHtml(lead?.notes || lead?.message || "No lead notes yet.")}</p>
    </article>
  `;
  if (updateStatus && packetPreview) packetPreview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function printTourPacket() {
  buildTourPacket(false);
  window.print();
}

async function addShiftNote(event) {
  event.preventDefault();
  const form = new FormData(shiftForm);
  const note = {
    id: makeLocalId(),
    community: form.get("community"),
    shiftDate: form.get("shiftDate") || new Date().toISOString().slice(0, 10),
    category: form.get("category"),
    author: form.get("author"),
    note: form.get("note"),
    createdAt: new Date().toISOString()
  };
  if (!note.community || !note.note) return;
  try {
    await saveOperationsSection("shiftNotes", [note, ...operationsData.shiftNotes], shiftStatus);
    shiftForm.reset();
  } catch (error) {
    if (shiftStatus) shiftStatus.textContent = error.message;
  }
}

function renderShiftNotes() {
  if (!shiftList) return;
  const rows = scopedByCommunity(operationsData.shiftNotes).slice(0, 60);
  if (shiftCount) shiftCount.textContent = `${rows.length} notes`;
  if (!rows.length) {
    shiftList.innerHTML = `<p class="muted">No shift notes yet.</p>`;
    return;
  }
  shiftList.innerHTML = rows.map((row) => `
    <article class="operation-item operation-item--stacked">
      <span><strong>${escapeHtml(row.category)}</strong><small>${escapeHtml(row.community)} - ${escapeHtml(row.shiftDate || formatDate(row.createdAt))} ${row.author ? `- ${escapeHtml(row.author)}` : ""}</small></span>
      <p>${escapeHtml(row.note)}</p>
      <button type="button" data-delete-shift="${escapeHtml(row.id)}">Remove</button>
    </article>
  `).join("");
  shiftList.querySelectorAll("[data-delete-shift]").forEach((button) => {
    button.addEventListener("click", () => deleteOperationItem("shiftNotes", button.dataset.deleteShift, shiftStatus));
  });
}

async function addDocument(event) {
  event.preventDefault();
  const form = new FormData(docForm);
  const doc = {
    id: makeLocalId(),
    title: form.get("title"),
    community: form.get("community"),
    type: form.get("type"),
    url: form.get("url"),
    notes: form.get("notes"),
    createdAt: new Date().toISOString()
  };
  if (!doc.title || !doc.url) return;
  try {
    await saveOperationsSection("documents", [doc, ...operationsData.documents], docStatus);
    docForm.reset();
  } catch (error) {
    if (docStatus) docStatus.textContent = error.message;
  }
}

function renderDocuments() {
  if (!docList) return;
  const rows = selectedAdminLocations.size
    ? operationsData.documents.filter((doc) => !doc.community || isInAdminLocationScope({ location: doc.community }))
    : operationsData.documents;
  if (docCount) docCount.textContent = `${rows.length} docs`;
  if (!rows.length) {
    docList.innerHTML = `<p class="muted">No documents saved yet.</p>`;
    return;
  }
  docList.innerHTML = rows.map((doc) => `
    <article class="operation-item">
      <span><strong>${escapeHtml(doc.title)}</strong><small>${escapeHtml([doc.community || "All communities", doc.type, doc.notes].filter(Boolean).join(" - "))}</small></span>
      <a class="operation-pill" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener noreferrer">Open</a>
      <button type="button" data-delete-doc="${escapeHtml(doc.id)}">Remove</button>
    </article>
  `).join("");
  docList.querySelectorAll("[data-delete-doc]").forEach((button) => {
    button.addEventListener("click", () => deleteOperationItem("documents", button.dataset.deleteDoc, docStatus));
  });
}

async function deleteOperationItem(section, id, statusEl) {
  if (!window.confirm("Remove this item?")) return;
  try {
    await saveOperationsSection(section, operationsData[section].filter((item) => item.id !== id), statusEl);
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message;
  }
}

function applyFollowUpTemplate(key) {
  const template = followUpTemplates[key];
  if (!template) return;
  emailSubject.value = template.subject;
  emailBody.value = template.body;
  outreachStatus.textContent = "Template loaded. It will personalize for each lead when sent.";
}

function makeLocalId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Auto-email toggle ---
const autoEmailToggle = document.querySelector("[data-auto-email-toggle]");
const settingsStatus = document.querySelector("[data-settings-status]");

async function loadAutoEmailSetting() {
  try {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) return;
    const data = await res.json();
    if (autoEmailToggle) autoEmailToggle.checked = data.auto_email_leads !== false;
  } catch {}
}

if (autoEmailToggle) {
  autoEmailToggle.addEventListener("change", async () => {
    const enabled = autoEmailToggle.checked;
    if (settingsStatus) { settingsStatus.textContent = "Saving…"; settingsStatus.className = "tool-status"; }
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_email_leads: enabled })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      if (settingsStatus) {
        settingsStatus.textContent = enabled ? "✓ Auto-email enabled" : "✓ Auto-email disabled";
        setTimeout(() => { if (settingsStatus) settingsStatus.textContent = ""; }, 3000);
      }
    } catch (err) {
      if (settingsStatus) settingsStatus.textContent = err.message;
      autoEmailToggle.checked = !enabled; // revert
    }
  });
}

async function loadCalendarStatus() {
  if (!calendarStatus) return;
  calendarStatus.textContent = "Checking calendar connection...";
  try {
    const res = await fetch("/api/admin/calendar/status");
    if (!res.ok) throw new Error("Could not check calendar connection.");
    const data = await res.json();
    if (!data.configured) {
      calendarStatus.textContent = data.message || "Google Calendar needs OAuth credentials in Vercel.";
      if (calendarConnectBtn) {
        calendarConnectBtn.disabled = true;
        calendarConnectBtn.innerHTML = `<i data-lucide="calendar-plus"></i>Needs Setup`;
      }
      if (calendarDisconnectBtn) calendarDisconnectBtn.hidden = true;
    } else if (data.connected) {
      calendarStatus.textContent = `Connected to ${data.email || "Google Calendar"}. New tours will be added automatically.`;
      if (calendarConnectBtn) {
        calendarConnectBtn.disabled = false;
        calendarConnectBtn.innerHTML = `<i data-lucide="refresh-cw"></i>Reconnect`;
      }
      if (calendarDisconnectBtn) calendarDisconnectBtn.hidden = false;
    } else {
      calendarStatus.textContent = "Not connected. Connect Google Calendar to create tour events automatically.";
      if (calendarConnectBtn) {
        calendarConnectBtn.disabled = false;
        calendarConnectBtn.innerHTML = `<i data-lucide="calendar-plus"></i>Connect Calendar`;
      }
      if (calendarDisconnectBtn) calendarDisconnectBtn.hidden = true;
    }
  } catch (error) {
    calendarStatus.textContent = error.message;
  }
  window.lucide?.createIcons();
}

function connectCalendar() {
  window.location.href = "/api/admin/calendar/connect";
}

async function disconnectCalendar() {
  if (!window.confirm("Disconnect Google Calendar? Scheduled tours will stay in the CRM, but new calendar events will stop being created.")) return;
  if (calendarDisconnectBtn) calendarDisconnectBtn.disabled = true;
  if (calendarStatus) calendarStatus.textContent = "Disconnecting calendar...";
  try {
    const res = await fetch("/api/admin/calendar/disconnect", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not disconnect calendar.");
    await loadCalendarStatus();
  } catch (error) {
    if (calendarStatus) calendarStatus.textContent = error.message;
  } finally {
    if (calendarDisconnectBtn) calendarDisconnectBtn.disabled = false;
  }
}

function hydrateFilters() {
  const selectedCommunity = communityFilter.value;
  const selectedStatus = statusFilter.value;
  const selectedSource = sourceFilter.value;
  const selectedPriority = priorityFilter.value;
  const selectedScore = scoreFilter.value;
  const locations = [...new Set([
    ...COMMUNITIES,
    ...leads.map((lead) => lead.location || lead.preferredCommunity).filter(Boolean)
  ])].sort((a, b) => a.localeCompare(b));
  availableAdminLocations = locations;
  renderAdminLocationOptions();
  updateAdminLocationLabel();

  communityFilter.innerHTML = `<option value="">All locations</option>${locations.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
  communityFilter.value = selectedCommunity;

  sourceFilter.innerHTML = `<option value="">All sources</option>${sources
    .map((source) => `<option value="${source}">${source}</option>`)
    .join("")}`;
  sourceFilter.value = selectedSource;

  priorityFilter.innerHTML = `<option value="">All priorities</option>${priorityTags
    .map((tag) => `<option value="${tag}">${tag}</option>`)
    .join("")}`;
  priorityFilter.value = selectedPriority;

  scoreFilter.innerHTML = `<option value="">All scores</option>${scoreLabels
    .map((label) => `<option value="${label}">${label}</option>`)
    .join("")}`;
  scoreFilter.value = selectedScore;

  statusFilter.innerHTML = `<option value="">All statuses</option>${statuses
    .map((status) => `<option value="${status}">${status}</option>`)
    .join("")}`;
  statusFilter.value = selectedStatus;

  const selectedDraftCommunity = draftCommunity.value;
  draftCommunity.innerHTML = `<option value="">All communities</option>${COMMUNITIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
  draftCommunity.value = selectedDraftCommunity;

  hydrateSelect(draftStatus, "All statuses", statuses, draftStatus?.value);
  hydrateSelect(draftScore, "All scores", scoreLabels, draftScore?.value);
  hydrateSelect(draftSource, "All sources", sources, draftSource?.value);
  hydrateSelect(draftPriority, "All priorities", priorityTags, draftPriority?.value);
  hydrateSelect(checkInCommunity, "All communities", locations, checkInCommunity?.value);

  if (manualCommunity) {
    const selectedManualCommunity = manualCommunity.value;
    manualCommunity.innerHTML = `<option value="">Select community</option>${locations.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
    manualCommunity.value = selectedManualCommunity;
  }
  if (manualCareType && !manualCareType.options.length) {
    manualCareType.innerHTML = careTypes.map((type) => `<option value="${type}">${type}</option>`).join("");
    manualCareType.value = "Not sure yet";
  }
  hydrateOperationControls(locations);
}

function hydrateOperationControls(locations = COMMUNITIES) {
  const locationSelects = [taskCommunity, moveInCommunity, packetCommunity, shiftCommunity, docCommunity];
  locationSelects.forEach((select) => {
    if (!select) return;
    const previous = select.value;
    const allowEmpty = select === docCommunity || select === packetCommunity || select === moveInCommunity;
    select.innerHTML = `${allowEmpty ? `<option value="">All / select community</option>` : `<option value="">Select community</option>`}${locations.map((community) => `<option value="${escapeHtml(community)}">${escapeHtml(community)}</option>`).join("")}`;
    select.value = previous;
  });

  const leadOptions = leads.map((lead) => {
    const name = lead.fullName || lead.name || "Lead";
    const community = lead.location || lead.preferredCommunity || "";
    return `<option value="${escapeHtml(lead.id)}">${escapeHtml(name)}${community ? ` - ${escapeHtml(community)}` : ""}</option>`;
  }).join("");
  [moveInLead, packetLead].forEach((select) => {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = `<option value="">Select lead</option>${leadOptions}`;
    select.value = previous;
  });
}

function renderAdminLocationOptions() {
  if (!adminLocationOptions) return;
  const query = (adminLocationSearch?.value || "").trim().toLowerCase();
  const filtered = availableAdminLocations.filter((location) => location.toLowerCase().includes(query));
  if (adminLocationAll) adminLocationAll.checked = pendingAdminLocations.size === 0;
  adminLocationOptions.innerHTML = filtered.map((location) => `
    <label class="admin-location-check admin-location-child">
      <input type="checkbox" value="${escapeHtml(location)}" ${pendingAdminLocations.has(location) ? "checked" : ""}>
      <span>${escapeHtml(location)}</span>
    </label>
  `).join("") || `<p class="muted">No matching locations.</p>`;
  adminLocationOptions.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) pendingAdminLocations.add(checkbox.value);
      else pendingAdminLocations.delete(checkbox.value);
      if (adminLocationAll) adminLocationAll.checked = pendingAdminLocations.size === 0;
    });
  });
}

function applyAdminLocationFilter() {
  selectedAdminLocations = new Set(pendingAdminLocations);
  currentLeadPage = 1;
  updateAdminLocationLabel();
  renderLeads();
  renderCheckIns();
  renderOccupancy();
  renderOperations();
  adminLocationPopover && (adminLocationPopover.hidden = true);
}

function updateAdminLocationLabel() {
  if (!adminLocationLabel) return;
  if (!selectedAdminLocations.size) {
    adminLocationLabel.textContent = "All Locations";
    return;
  }
  if (selectedAdminLocations.size === 1) {
    adminLocationLabel.textContent = [...selectedAdminLocations][0];
    return;
  }
  adminLocationLabel.textContent = `${selectedAdminLocations.size} Locations`;
}

function isInAdminLocationScope(item = {}) {
  if (!selectedAdminLocations.size) return true;
  const location = item.location || item.preferredCommunity || item.community || "";
  return selectedAdminLocations.has(location);
}

function scopedLeads() {
  return leads.filter(isInAdminLocationScope);
}

function hydrateSelect(select, emptyLabel, values, selectedValue = "") {
  if (!select) return;
  select.innerHTML = `<option value="">${emptyLabel}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = selectedValue;
}

function getFilteredLeads(options = {}) {
  const query = searchInput.value.trim().toLowerCase();
  const community = communityFilter.value;
  const source = sourceFilter.value;
  const priority = priorityFilter.value;
  const score = scoreFilter.value;
  const status = options.ignoreStatus ? "" : statusFilter.value;
  const dateFrom = dateFromFilter.value ? new Date(`${dateFromFilter.value}T00:00:00`) : null;
  const dateTo = dateToFilter.value ? new Date(`${dateToFilter.value}T23:59:59.999`) : null;
  return scopedLeads().filter((lead) => {
    const leadLocation = lead.location || lead.preferredCommunity || "";
    const haystack = [
      lead.fullName,
      lead.name,
      lead.phone,
      lead.email,
      leadLocation,
      lead.careType,
      lead.message,
      lead.notes,
      lead.source,
      lead.activityLabel,
      lead.activityScore,
      lead.activityAction,
      ...(lead.activityReasons || []),
      ...(lead.priorityTags || []),
      lead.moveTimeline,
      lead.paymentType,
      lead.relationshipToResident,
      lead.preferredContactMethod,
      lead.bestContactTime,
      lead.tourPreference
    ].join(" ").toLowerCase();
    const submitted = new Date(lead.submittedAt);
    return (!query || haystack.includes(query))
      && (!community || leadLocation === community)
      && (!source || lead.source === source)
      && (!priority || (lead.priorityTags || []).includes(priority))
      && (!score || lead.activityLabel === score)
      && (!status || lead.status === status)
      && (!dateFrom || submitted >= dateFrom)
      && (!dateTo || submitted <= dateTo);
  });
}

function renderLeads() {
  const filtered = getFilteredLeads();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentLeadPage = Math.min(Math.max(1, currentLeadPage), totalPages);
  const pageStart = (currentLeadPage - 1) * PAGE_SIZE;
  const pageLeads = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  leadsBody.innerHTML = pageLeads.map(renderLeadTableRow).join("");

  emptyState.hidden = filtered.length !== 0;
  renderPagination(filtered.length, totalPages);
  renderMetrics();
  renderSourcePerformance();
  renderCommunityDashboard();
  renderReportCharts();
  renderUpcomingTours();
  renderPastTourPrompts();
  renderFunnel();
  renderPinnedFollowups();
  bindLeadTableEvents();
  window.lucide?.createIcons();
}

function renderLeadTableRow(lead) {
  return `
    <tr class="lead-row" data-open-lead="${lead.id}" style="cursor:pointer">
      <td>
        <strong>${escapeHtml(lead.fullName || lead.name)}</strong>
        ${lead.status === "New" ? `<span class="new-lead-badge">New</span>` : ""}
        ${renderActivityBadge(lead)}
        <br><small>${escapeHtml(lead.email || "No email")}</small>
        ${renderRatingReasons(lead, 3)}
        ${renderSuggestedAction(lead)}
        ${renderPriorityTags(lead)}
        ${lead.followUpAt ? `<br><span class="reminder-badge">${escapeHtml(reminderLabel(lead.followUpAt))}</span>` : ""}
        ${isActiveTourLead(lead) ? `<br><span class="tour-date-badge">${escapeHtml(tourLabel(lead.tourScheduledAt))}</span>` : ""}
      </td>
      <td>${escapeHtml(lead.phone)}</td>
      <td>${escapeHtml(lead.location || lead.preferredCommunity || "Unknown")}</td>
      <td><span class="source-badge">${escapeHtml(lead.source || "Website")}</span></td>
      <td>${formatDate(lead.submittedAt)}</td>
      <td>
        <select class="status-select" data-lead-status="${lead.id}" onclick="event.stopPropagation()">
          ${statuses.map((item) => `<option value="${item}" ${item === lead.status ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </td>
      <td style="white-space:nowrap" onclick="event.stopPropagation()">
        <button class="btn btn-ghost tour-btn ${lead.status === 'Tour Scheduled' ? 'tour-btn--active' : ''}" data-tour-lead="${lead.id}" title="Mark as Tour Scheduled">
          <i data-lucide="calendar-check"></i>
        </button>
        <button class="btn btn-ghost" style="color:#1a6fbf;padding:4px 8px" data-email-lead="${lead.id}" title="Open AI email draft">
          <i data-lucide="mail"></i>
        </button>
        <button class="btn btn-ghost" style="color:#c0392b;padding:4px 8px" data-delete-lead="${lead.id}" title="Delete lead">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `;
}

function renderMetrics() {
  const visibleLeads = scopedLeads();
  const totalLeads = visibleLeads.length;
  const newCount = visibleLeads.filter((l) => l.status === "New").length;
  const contactedCount = visibleLeads.filter((l) => l.status === "Contacted").length;
  const tourCount = visibleLeads.filter((l) => l.status === "Tour Scheduled").length;
  const tourCompletedCount = visibleLeads.filter((l) => l.status === "Tour Completed").length;
  const decisionPendingCount = visibleLeads.filter((l) => l.status === "Decision Pending").length;
  const movedInCount = visibleLeads.filter(isMovedInLead).length;
  const closedCount = visibleLeads.filter((l) => l.status === "Closed").length;
  const dueCount = visibleLeads.filter(isFollowUpDueToday).length;
  const conversionRate = totalLeads > 0 ? Math.round((movedInCount / totalLeads) * 100) : 0;
  document.querySelector("[data-metric-total]").textContent = totalLeads;
  document.querySelector("[data-metric-new]").textContent = newCount;
  document.querySelector("[data-metric-contacted]").textContent = contactedCount;
  document.querySelector("[data-metric-tour]").textContent = tourCount;
  document.querySelector("[data-metric-tour-completed]").textContent = tourCompletedCount;
  document.querySelector("[data-metric-decision-pending]").textContent = decisionPendingCount;
  document.querySelector("[data-metric-moved-in]").textContent = movedInCount;
  document.querySelector("[data-metric-closed]").textContent = closedCount;
  document.querySelector("[data-metric-conversion]").textContent = `${conversionRate}%`;
  document.querySelector("[data-metric-followups]").textContent = dueCount;
}

function bindLeadTableEvents() {
  leadsBody.querySelectorAll("[data-lead-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const lead = leads.find((item) => String(item.id) === String(select.dataset.leadStatus));
      if (select.value === "Tour Scheduled" && !lead?.tourScheduledAt) {
        select.value = lead?.status || "New";
        openDrawer(select.dataset.leadStatus, { focusTour: true });
        return;
      }
      await updateLeadStatus(select.dataset.leadStatus, select.value);
    });
  });

  leadsBody.querySelectorAll("[data-email-lead]").forEach((btn) => {
    btn.addEventListener("click", () => openDrawer(btn.dataset.emailLead, { generateEmail: true }));
  });

  leadsBody.querySelectorAll("[data-delete-lead]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteLead;
      const lead = leads.find((item) => String(item.id) === String(id));
      if (!window.confirm(`Delete ${lead?.fullName || lead?.name || "this lead"}? This cannot be undone.`)) return;
      const response = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
      if (response.ok) {
        if (String(activeDrawerLeadId) === String(id) && leadDrawer.open) leadDrawer.close();
        await fetchLeads();
      } else {
        const data = await response.json().catch(() => ({}));
        window.alert(data.error || "Could not delete this lead. Please try again.");
      }
    });
  });

  leadsBody.querySelectorAll("[data-tour-lead]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tourLead;
      const lead = leads.find((l) => String(l.id) === String(id));
      if (!lead) return;
      openDrawer(id, { focusTour: true });
    });
  });

  leadsBody.querySelectorAll("[data-open-lead]").forEach((row) => {
    row.addEventListener("click", () => openDrawer(row.dataset.openLead));
  });
}

async function updateLeadStatus(id, status) {
  const lead = leads.find((item) => String(item.id) === String(id));
  if (!lead || !status || lead.status === status) return;
  const previousStatus = lead.status;
  const previousTourScheduledAt = lead.tourScheduledAt;
  lead.status = status;
  if (status !== "Tour Scheduled") lead.tourScheduledAt = "";
  renderLeads();
  const response = await fetch(`/api/admin/leads/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    lead.status = previousStatus;
    lead.tourScheduledAt = previousTourScheduledAt;
    renderLeads();
    window.alert("Could not update lead status. Please try again.");
    return;
  }
  await fetchLeads();
}

function renderPagination(filteredCount, totalPages) {
  if (!pagination || !pagePrev || !pageNext || !pageStatus) return;
  pagination.hidden = filteredCount <= PAGE_SIZE;
  const start = filteredCount ? ((currentLeadPage - 1) * PAGE_SIZE) + 1 : 0;
  const end = Math.min(currentLeadPage * PAGE_SIZE, filteredCount);
  pageStatus.textContent = `${start}-${end} of ${filteredCount} leads · Page ${currentLeadPage} of ${totalPages}`;
  pagePrev.disabled = currentLeadPage <= 1;
  pageNext.disabled = currentLeadPage >= totalPages;
}

async function openDrawer(id, options = {}) {
  const lead = leads.find((l) => String(l.id) === String(id));
  if (!lead) return;
  activeDrawerLeadId = id;
  drawerName.textContent = lead.fullName || lead.name;
  drawerMeta.innerHTML = `
    <div class="drawer-meta-grid">
      <span><i data-lucide="phone"></i>${escapeHtml(lead.phone)}</span>
      <span><i data-lucide="mail"></i>${escapeHtml(lead.email || "No email")}</span>
      <span><i data-lucide="map-pin"></i>${escapeHtml(lead.location || lead.preferredCommunity || "Unknown")}</span>
      <span><i data-lucide="database"></i>${escapeHtml(lead.source || "Website")}</span>
      <span><i data-lucide="gauge"></i>${escapeHtml(activityRatingText(lead))}</span>
      <span><i data-lucide="heart-handshake"></i>${escapeHtml(lead.careType || "Not sure yet")}</span>
      <span><i data-lucide="flag"></i>${escapeHtml((lead.priorityTags || []).join(", ") || "No priority tags")}</span>
      <span><i data-lucide="calendar-check"></i>${escapeHtml(isActiveTourLead(lead) ? formatDate(lead.tourScheduledAt) : "No tour scheduled")}</span>
      <span><i data-lucide="calendar-days"></i>${escapeHtml(lead.moveTimeline || "Timeline unknown")}</span>
      <span><i data-lucide="wallet"></i>${escapeHtml(lead.paymentType || "Payment unknown")}</span>
      <span><i data-lucide="user-round"></i>${escapeHtml(lead.relationshipToResident || "Relationship unknown")}</span>
      <span><i data-lucide="phone-call"></i>${escapeHtml([lead.preferredContactMethod, lead.bestContactTime].filter(Boolean).join(" / ") || "Contact preference unknown")}</span>
      <span><i data-lucide="message-square"></i>${escapeHtml(lead.notes || lead.message || "No notes")}</span>
      <span><i data-lucide="clock"></i>${formatDate(lead.submittedAt)}</span>
    </div>
    <div class="rating-insight">
      <div>
        ${renderActivityBadge(lead)}
        <strong>${escapeHtml(lead.activityAction || "Nurture with helpful information")}</strong>
      </div>
      ${renderRatingReasons(lead, 6)}
    </div>
    <span class="status-badge status-${lead.status.toLowerCase().replace(/\s+/g,"-")}">${escapeHtml(lead.status)}</span>
  `;
  drawerNotes.value = lead.notes || lead.message || "";
  drawerNotesStatus.textContent = "";
  reminderDate.value = lead.followUpAt ? dateInputValue(lead.followUpAt) : "";
  reminderNote.value = lead.followUpNote || "";
  reminderStatus.textContent = lead.followUpAt ? `Reminder set for ${formatDate(lead.followUpAt)}` : "";
  tourDate.value = isActiveTourLead(lead) ? dateTimeInputValue(lead.tourScheduledAt) : "";
  tourStatus.textContent = isActiveTourLead(lead) ? `Tour scheduled for ${formatDate(lead.tourScheduledAt)}` : "";
  leadEmailSubject.value = "";
  leadEmailBody.value = "";
  leadEmailStatus.textContent = lead.email ? "" : "This lead does not have an email address yet.";
  leadTimeline.innerHTML = `<p class="muted">Loading...</p>`;
  if (!leadDrawer.open) leadDrawer.showModal();
  window.lucide?.createIcons();
  if (options.generateEmail && lead.email) generateLeadEmail();
  if (options.focusTour) focusTourScheduler();

  await loadTimeline(id);
}

function focusTourScheduler() {
  const tourSection = document.querySelector("[data-tour-section]");
  if (!tourSection || !tourDate) return;
  tourStatus.textContent = "Choose a tour date and time, then save to move this lead to Tour Scheduled.";
  tourSection.scrollIntoView({ behavior: "smooth", block: "center" });
  tourSection.classList.add("is-highlighted");
  window.setTimeout(() => tourDate.focus(), 250);
  window.setTimeout(() => tourSection.classList.remove("is-highlighted"), 2200);
}

document.querySelector("[data-drawer-close]").addEventListener("click", () => leadDrawer.close());
leadDrawer.addEventListener("click", (e) => { if (e.target === leadDrawer) leadDrawer.close(); });

saveNotesBtn.addEventListener("click", async () => {
  if (!activeDrawerLeadId) return;
  saveNotesBtn.disabled = true;
  drawerNotesStatus.textContent = "Saving...";
  try {
    await postJson(`/api/admin/leads/${activeDrawerLeadId}/notes`, { notes: drawerNotes.value });
    const lead = leads.find((l) => String(l.id) === String(activeDrawerLeadId));
    if (lead) lead.notes = drawerNotes.value;
    drawerNotesStatus.textContent = 'Saved';
    await loadTimeline(activeDrawerLeadId);
  } catch (err) {
    drawerNotesStatus.textContent = err.message;
  } finally {
    saveNotesBtn.disabled = false;
  }
});

async function saveReminder(presetOrDate) {
  if (!activeDrawerLeadId) return;
  const followUpAt = presetOrDate || reminderDate.value;
  if (!followUpAt) {
    reminderStatus.textContent = "Choose a reminder date or preset.";
    return;
  }

  saveReminderBtn.disabled = true;
  reminderStatus.textContent = "Saving reminder...";
  try {
    const data = await postJson(`/api/admin/leads/${activeDrawerLeadId}/reminder`, {
      followUpAt,
      preset: followUpAt,
      note: reminderNote.value || "Follow up with this lead"
    });
    const lead = leads.find((l) => String(l.id) === String(activeDrawerLeadId));
    if (lead) {
      lead.followUpAt = data.followUpAt;
      lead.followUpNote = data.followUpNote;
    }
    reminderDate.value = dateInputValue(data.followUpAt);
    reminderNote.value = data.followUpNote || "";
    reminderStatus.textContent = `Reminder set for ${formatDate(data.followUpAt)}`;
    renderLeads();
    await loadTimeline(activeDrawerLeadId);
  } catch (err) {
    reminderStatus.textContent = err.message;
  } finally {
    saveReminderBtn.disabled = false;
  }
}

async function saveTour() {
  if (!activeDrawerLeadId) return;
  if (!tourDate.value) {
    tourStatus.textContent = "Choose a tour date and time.";
    return;
  }

  saveTourBtn.disabled = true;
  tourStatus.textContent = "Saving tour...";
  try {
    const data = await postJson(`/api/admin/leads/${activeDrawerLeadId}/tour`, {
      tourScheduledAt: tourDate.value
    });
    const lead = leads.find((l) => String(l.id) === String(activeDrawerLeadId));
    if (lead) {
      lead.tourScheduledAt = data.tourScheduledAt;
      lead.status = data.status || "Tour Scheduled";
      lead.activityScore = Math.max(lead.activityScore || 0, 70);
      lead.activityLabel = "Hot";
      lead.activityAction = "Confirm tour details and send a reminder";
      lead.activityReasons = [...new Set([...(lead.activityReasons || []), "Tour scheduled"])];
    }
    tourDate.value = dateTimeInputValue(data.tourScheduledAt);
    const calendarText = data.calendar?.ok
      ? ` Google Calendar ${data.calendar.updated ? "updated" : "event created"}.`
      : data.calendar?.error ? ` Calendar not updated: ${data.calendar.error}` : "";
    tourStatus.textContent = `Tour scheduled for ${formatDate(data.tourScheduledAt)}.${calendarText}`;
    await fetchLeads();
    await openDrawer(activeDrawerLeadId);
    tourStatus.textContent = `Tour scheduled for ${formatDate(data.tourScheduledAt)}.${calendarText}`;
  } catch (err) {
    tourStatus.textContent = err.message;
  } finally {
    saveTourBtn.disabled = false;
  }
}

async function clearTour() {
  if (!activeDrawerLeadId) return;
  clearTourBtn.disabled = true;
  tourStatus.textContent = "Clearing tour...";
  try {
    const data = await postJson(`/api/admin/leads/${activeDrawerLeadId}/tour`, { action: "clear" });
    const lead = leads.find((l) => String(l.id) === String(activeDrawerLeadId));
    if (lead) {
      lead.tourScheduledAt = "";
      lead.status = data.status || "Contacted";
    }
    tourDate.value = "";
    tourStatus.textContent = "Tour cleared.";
    await fetchLeads();
    await openDrawer(activeDrawerLeadId);
  } catch (err) {
    tourStatus.textContent = err.message;
  } finally {
    clearTourBtn.disabled = false;
  }
}

generateLeadEmailBtn.addEventListener("click", generateLeadEmail);

sendLeadEmailBtn.addEventListener("click", async () => {
  if (!activeDrawerLeadId) return;
  const subject = leadEmailSubject.value.trim();
  const body = leadEmailBody.value.trim();
  if (!subject || !body) {
    leadEmailStatus.textContent = "Generate or write a subject and body first.";
    return;
  }
  sendLeadEmailBtn.disabled = true;
  leadEmailStatus.textContent = "Sending email...";
  try {
    const data = await postJson(`/api/admin/leads/${activeDrawerLeadId}/email`, { subject, body });
    leadEmailStatus.textContent = data.message || "Email sent.";
    const lead = leads.find((l) => String(l.id) === String(activeDrawerLeadId));
    if (lead) lead.status = "Contacted";
    await fetchLeads();
    await openDrawer(activeDrawerLeadId);
  } catch (err) {
    leadEmailStatus.textContent = err.message;
  } finally {
    sendLeadEmailBtn.disabled = false;
  }
});

async function generateLeadEmail() {
  if (!activeDrawerLeadId) return;
  generateLeadEmailBtn.disabled = true;
  leadEmailStatus.textContent = "Generating AI email...";
  try {
    const data = await postJson(`/api/admin/leads/${activeDrawerLeadId}/email-draft`, {});
    leadEmailSubject.value = data.subject || "";
    leadEmailBody.value = data.body || "";
    leadEmailStatus.textContent = data.ai ? "AI draft ready. Review before sending." : "Draft ready. Review before sending.";
    await loadTimeline(activeDrawerLeadId);
  } catch (err) {
    leadEmailStatus.textContent = err.message;
  } finally {
    generateLeadEmailBtn.disabled = false;
  }
}

async function exportLeads() {
  const params = currentFilterParams();

  exportButton.disabled = true;
  exportButton.classList.add("is-loading");
  exportLabel.textContent = "Generating...";

  try {
    const response = await fetch(`/api/admin/leads/export?${params.toString()}`);
    if (response.status === 401) {
      dashboard.hidden = true;
      loginPanel.hidden = false;
      return;
    }
    if (!response.ok) throw new Error("Unable to export leads.");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "comfort-care-leads.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message);
  } finally {
    exportButton.disabled = false;
    exportButton.classList.remove("is-loading");
    exportLabel.textContent = "Download Leads CSV";
  }
}

async function loadImportFile() {
  const file = importFile.files?.[0];
  if (!file) return;
  importStatus.textContent = "Reading CSV...";
  try {
    importCsv.value = await file.text();
    importStatus.textContent = `${file.name} loaded.`;
  } catch {
    importStatus.textContent = "Unable to read that file.";
  }
}

async function importLeads() {
  const csv = importCsv.value.trim();
  if (!csv) {
    importStatus.textContent = "Choose or paste a CSV first.";
    return;
  }
  importButton.disabled = true;
  importStatus.textContent = "Importing leads...";
  try {
    const data = await postJson("/api/admin/leads/import", { csv });
    const skipped = data.skipped?.length ? ` ${data.skipped.length} skipped.` : "";
    importStatus.textContent = `${data.message}${skipped}`;
    importCsv.value = "";
    importFile.value = "";
    await fetchLeads();
  } catch (error) {
    importStatus.textContent = error.message;
  } finally {
    importButton.disabled = false;
  }
}

function switchAddLeadTab(tabName) {
  addLeadTabs.forEach((button) => button.classList.toggle("active", button.dataset.addTab === tabName));
  addLeadPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.addPanel === tabName));
  importStatus.textContent = "";
}

async function addManualLead(event) {
  event.preventDefault();
  const submitButton = manualLeadForm.querySelector('button[type="submit"]');
  try {
    const payload = Object.fromEntries(new FormData(manualLeadForm).entries());
    const validationError = validateLeadContact(payload);
    if (validationError) {
      importStatus.textContent = validationError;
      return;
    }
    submitButton.disabled = true;
    importStatus.textContent = "Adding lead...";
    const data = await postJson("/api/admin/leads/manual", payload);
    importStatus.textContent = data.message || "Lead added.";
    manualLeadForm.reset();
    if (manualCareType) manualCareType.value = "Not sure yet";
    currentLeadPage = 1;
    await fetchLeads();
  } catch (error) {
    importStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

async function draftEmail() {
  draftButton.disabled = true;
  outreachStatus.textContent = "Generating mass email draft...";
  try {
    const filters = currentOutreachFilters();
    const existingSubject = emailSubject.value.trim();
    const data = await postJson("/api/admin/outreach/draft", { filters, subjectHint: existingSubject });
    emailSubject.value = data.subject || "";
    emailBody.value = data.body || "";
    outreachStatus.textContent = `Template ready for ${data.recipients || 0} lead${data.recipients === 1 ? "" : "s"}. Each live email will be personalized per lead.`;
  } catch (error) {
    outreachStatus.textContent = error.message;
  } finally {
    draftButton.disabled = false;
  }
}

async function sendLiveCampaign() {
  const subject = emailSubject.value.trim();
  const body = emailBody.value.trim();
  if (!subject || !body) {
    outreachStatus.textContent = "Generate or write a subject and body first.";
    return;
  }
  const filters = currentOutreachFilters();
  const matchingCount = countMatchingLeads(filters);
  if (!window.confirm(`This will generate personalized REAL emails for ${matchingCount} lead${matchingCount === 1 ? "" : "s"} matching the current filters.\n\nThe draft will be used as the campaign direction, then personalized per lead.\n\nSubject/template: ${subject}\n\nContinue?`)) return;

  liveCampaignButton.disabled = true;
  outreachStatus.textContent = "Generating personalized emails and sending...";
  try {
    const data = await postJson("/api/admin/outreach/send-live", {
      filters,
      subject,
      body
    });
    outreachStatus.textContent = data.message;
    await fetchLeads();
  } catch (error) {
    outreachStatus.textContent = error.message;
  } finally {
    liveCampaignButton.disabled = false;
  }
}

async function sendTestEmail() {
  const subject = emailSubject.value.trim();
  const body = emailBody.value.trim();
  const recipient = testRecipient.value.trim();
  if (!subject || !body || !recipient) {
    outreachStatus.textContent = "Subject, body, and test recipient are required.";
    return;
  }

  sendTestButton.disabled = true;
  outreachStatus.textContent = "Sending test email...";
  try {
    const data = await postJson("/api/admin/outreach/send", {
      filters: currentOutreachFilters(),
      subject,
      body,
      testRecipient: recipient
    });
    outreachStatus.textContent = data.message;
  } catch (error) {
    outreachStatus.textContent = error.message;
  } finally {
    sendTestButton.disabled = false;
  }
}

async function logDemoCampaign() {
  const subject = emailSubject.value.trim();
  const body = emailBody.value.trim();
  if (!subject || !body) {
    outreachStatus.textContent = "Generate or write a subject and body first.";
    return;
  }
  if (!window.confirm("Log this demo campaign for every lead matching the current filters?")) return;

  demoCampaignButton.disabled = true;
  outreachStatus.textContent = "Logging demo campaign...";
  try {
    const data = await postJson("/api/admin/outreach/send", {
      filters: currentOutreachFilters(),
      subject,
      body,
      demoOnly: true
    });
    outreachStatus.textContent = data.message;
    await fetchLeads();
  } catch (error) {
    outreachStatus.textContent = error.message;
  } finally {
    demoCampaignButton.disabled = false;
  }
}

async function fetchDailyReport(generateAi) {
  if (!dailyReportSummary) return;
  const button = generateDailyReportBtn;
  if (generateAi) button.disabled = true;
  dailyReportStatus.textContent = generateAi ? "Generating summary..." : "Loading daily report...";

  try {
    const response = await fetch("/api/admin/report/daily", {
      method: generateAi ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: generateAi ? "{}" : undefined
    });
    const data = await response.json();
    if (response.status === 401) {
      dailyReportStatus.textContent = "";
      return;
    }
    if (!response.ok) throw new Error(data.error || "Could not load daily report.");
    latestDailyReport = data;
    renderDailyReport(data);
    dailyReportStatus.textContent = generateAi && data.ai ? "AI summary ready." : "";
  } catch (error) {
    dailyReportStatus.textContent = error.message;
  } finally {
    if (generateAi) button.disabled = false;
  }
}

function renderDailyReport(report) {
  const metrics = report.metrics || {};
  setText("[data-report-new]", metrics.newLeadsToday || 0);
  setText("[data-report-hot]", metrics.hotLeadsToday || 0);
  setText("[data-report-followups]", metrics.followUpsDue || 0);
  setText("[data-report-tours]", metrics.toursToday || 0);
  setText("[data-report-emails]", metrics.emailsSentToday || 0);
  setText("[data-report-community]", report.topCommunity || "None yet");
  dailyReportSummary.innerHTML = escapeHtml(report.summary || "No report summary yet.").replace(/\n/g, "<br>");
}

async function generateRevenueForecast() {
  if (!forecastResult || !forecastSummary || !forecastStatus || !generateForecastBtn) return;
  const averageMonthlyRate = Number(forecastRate?.value || 5000);
  generateForecastBtn.disabled = true;
  forecastStatus.textContent = "Generating forecast...";
  try {
    const data = await postJson("/api/admin/report/forecast", { averageMonthlyRate });
    renderRevenueForecast(data);
    forecastStatus.textContent = data.ai ? "AI forecast generated." : "Forecast generated.";
  } catch (error) {
    forecastStatus.textContent = error.message;
  } finally {
    generateForecastBtn.disabled = false;
  }
}

function renderRevenueForecast(forecast) {
  const range = forecast.moveIns || {};
  const revenue = forecast.projectedMonthlyRevenue || {};
  const totalRevenue = forecast.totalMonthlyRevenue || {};
  const drivers = forecast.drivers || {};
  const movedIn = Number(forecast.movedInThisMonth || 0);
  forecastResult.innerHTML = `
    <article><span>${movedIn}</span><small>Already moved in this month</small></article>
    <article><span>+${Number(range.low || 0)}–${Number(range.high || 0)}</span><small>Projected additional</small></article>
    <article><span>${movedIn + Number(range.low || 0)}–${movedIn + Number(range.high || 0)}</span><small>Total expected this month</small></article>
    <article><span>${formatMoney(totalRevenue.low || 0)}–${formatMoney(totalRevenue.high || 0)}</span><small>Total projected revenue</small></article>
    <article><span>${escapeHtml(forecast.confidence || "Medium")}</span><small>Confidence</small></article>
  `;
  forecastSummary.innerHTML = `
    ${escapeHtml(forecast.summary || "Forecast ready.").replace(/\n/g, "<br>")}
    <div class="rating-reasons">
      <span>${Number(drivers.decisionPending || 0)} deciding</span>
      <span>${Number(drivers.tourCompleted || 0)} post-tour</span>
      <span>${Number(drivers.activeTours || 0)} active tours</span>
      <span>${Number(drivers.hotOpen || 0)} hot open leads</span>
      <span>${Number(drivers.followUpsDue || 0)} follow-ups due</span>
      <span>${Number(drivers.newThisMonth || 0)} new this month</span>
    </div>
  `;
}

async function copyDailyReport() {
  if (!latestDailyReport) await fetchDailyReport(false);
  if (!latestDailyReport) return;

  const metrics = latestDailyReport.metrics || {};
  const text = [
    `Comfort Care Daily Report - ${latestDailyReport.date || ""}`,
    `New leads today: ${metrics.newLeadsToday || 0}`,
    `Hot leads today: ${metrics.hotLeadsToday || 0}`,
    `Follow-ups due: ${metrics.followUpsDue || 0}`,
    `Tours today: ${metrics.toursToday || 0}`,
    `Emails today: ${metrics.emailsSentToday || 0}`,
    `Top community: ${latestDailyReport.topCommunity || "None yet"}`,
    "",
    latestDailyReport.summary || ""
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    dailyReportStatus.textContent = "Daily report copied.";
  } catch {
    dailyReportStatus.textContent = "Copy failed. Select the report text manually.";
  }
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

async function fetchCampaignHistory() {
  if (!campaignHistoryList) return;
  campaignHistoryStatus.textContent = "Loading campaign history...";
  try {
    const response = await fetch("/api/admin/outreach/history");
    const data = await response.json();
    if (response.status === 401) {
      campaignHistoryStatus.textContent = "";
      return;
    }
    if (!response.ok) throw new Error(data.error || "Could not load campaign history.");
    renderCampaignHistory(data.campaigns || []);
    campaignHistoryStatus.textContent = "";
  } catch (error) {
    campaignHistoryStatus.textContent = error.message;
  }
}

function renderCampaignHistory(campaigns) {
  if (!campaignHistoryList) return;
  if (!campaigns.length) {
    campaignHistoryList.innerHTML = `<p class="muted">No campaigns logged yet.</p>`;
    return;
  }

  campaignHistoryList.innerHTML = campaigns.map((campaign) => {
    const recipients = campaign.recipients || [];
    const recipientPreview = recipients.length
      ? recipients.slice(0, 5).map((recipient) => `
          <li>
            <span>${escapeHtml(recipient.name || recipient.email || "Lead")}</span>
            <small>${escapeHtml([recipient.community, recipient.status].filter(Boolean).join(" - "))}</small>
          </li>
        `).join("")
      : `<li><span>No recipient details yet</span><small>New campaign marker</small></li>`;
    return `
      <details class="campaign-history-item">
        <summary>
          <span>
            <strong>${escapeHtml(campaign.name || campaign.subject || "Mass outreach campaign")}</strong>
            <small>${escapeHtml(formatDate(campaign.createdAt))}</small>
          </span>
          <span class="campaign-pill">${escapeHtml(campaign.mode || "Campaign")} · ${Number(campaign.recipientCount || 0)} leads</span>
        </summary>
        <div class="campaign-history-detail">
          <dl>
            <div><dt>Sent</dt><dd>${Number(campaign.sent || 0)}</dd></div>
            <div><dt>Failed</dt><dd>${Number(campaign.failed || 0)}</dd></div>
            <div><dt>Total</dt><dd>${Number(campaign.recipientCount || 0)}</dd></div>
          </dl>
          <p><strong>Subject:</strong> ${escapeHtml(campaign.subject || "No subject")}</p>
          <ul>${recipientPreview}</ul>
        </div>
      </details>
    `;
  }).join("");
}

async function fetchCampaignHistoryV2() {
  if (!campaignHistoryList) return;
  campaignHistoryStatus.textContent = "Loading campaign history...";
  try {
    const archivedQuery = showArchivedCampaigns?.checked ? "?archived=true" : "";
    const response = await fetch(`/api/admin/outreach/history${archivedQuery}`);
    const data = await response.json();
    if (response.status === 401) {
      campaignHistoryStatus.textContent = "";
      return;
    }
    if (!response.ok) throw new Error(data.error || "Could not load campaign history.");
    renderCampaignHistoryV2(data.campaigns || []);
    campaignHistoryStatus.textContent = "";
  } catch (error) {
    campaignHistoryStatus.textContent = error.message;
  }
}

function renderCampaignHistoryV2(campaigns) {
  if (!campaignHistoryList) return;
  if (!campaigns.length) {
    campaignHistoryList.innerHTML = `<p class="muted">${showArchivedCampaigns?.checked ? "No archived campaigns." : "No campaigns logged yet."}</p>`;
    return;
  }

  campaignHistoryList.innerHTML = campaigns.map((campaign) => {
    const recipients = campaign.recipients || [];
    const recipientPreview = recipients.length
      ? recipients.slice(0, 5).map((recipient) => `
          <li>
            <span>${escapeHtml(recipient.name || recipient.email || "Lead")}</span>
            <small>${escapeHtml([recipient.community, recipient.status].filter(Boolean).join(" - "))}</small>
          </li>
        `).join("")
      : `<li><span>No recipient details yet</span><small>New campaign marker</small></li>`;
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
          <button class="campaign-archive-btn" type="button" data-campaign-archive="${escapeHtml(campaign.id)}" data-archived="${campaign.archived ? "true" : "false"}">
            ${campaign.archived ? "Restore Campaign" : "Archive Campaign"}
          </button>
        </div>
      </details>
    `;
  }).join("");

  campaignHistoryList.querySelectorAll("[data-campaign-archive]").forEach((button) => {
    button.addEventListener("click", () => archiveCampaign(button));
  });
}

async function archiveCampaign(button) {
  const campaignId = button.dataset.campaignArchive;
  const isArchived = button.dataset.archived === "true";
  if (!campaignId) return;
  const actionText = isArchived ? "restore" : "archive";
  if (!window.confirm(`Are you sure you want to ${actionText} this campaign?`)) return;

  button.disabled = true;
  button.textContent = isArchived ? "Restoring..." : "Archiving...";
  try {
    await postJson("/api/admin/outreach/archive", { campaignId, archived: !isArchived });
    await fetchCampaignHistoryV2();
  } catch (error) {
    campaignHistoryStatus.textContent = error.message;
    button.disabled = false;
    button.textContent = isArchived ? "Restore Campaign" : "Archive Campaign";
  }
}

function renderReportCharts() {
  if (!reportTrend && !reportPipeline && !reportSourceChart && !reportCareChart) return;
  const visibleLeads = scopedLeads();
  if (reportChartScope) {
    reportChartScope.textContent = selectedAdminLocations.size
      ? selectedAdminLocations.size === 1 ? [...selectedAdminLocations][0] : `${selectedAdminLocations.size} locations`
      : "All locations";
  }
  renderLeadTrendChart(visibleLeads);
  renderPipelineChart(visibleLeads);
  renderSourceConversionChart(visibleLeads);
  renderCareTypeChart(visibleLeads);
}

function renderLeadTrendChart(visibleLeads) {
  if (!reportTrend) return;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: dayKeyLocal(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
      count: 0
    };
  });
  const dayCounts = new Map(days.map((day) => [day.key, day]));
  visibleLeads.forEach((lead) => {
    const key = dayKeyLocal(lead.submittedAt);
    const day = dayCounts.get(key);
    if (day) day.count += 1;
  });
  const max = Math.max(...days.map((day) => day.count), 1);
  reportTrend.innerHTML = days.map((day) => {
    const height = day.count ? Math.max(12, Math.round((day.count / max) * 100)) : 4;
    return `
      <div class="trend-bar-column">
        <span class="trend-count">${day.count}</span>
        <span class="trend-bar-track"><span class="trend-bar" style="height:${height}%"></span></span>
        <small>${escapeHtml(day.label)}</small>
      </div>
    `;
  }).join("");
}

function renderPipelineChart(visibleLeads) {
  if (!reportPipeline) return;
  const total = visibleLeads.length || 1;
  reportPipeline.innerHTML = statuses.map((status) => {
    const count = visibleLeads.filter((lead) => lead.status === status).length;
    const percent = Math.round((count / total) * 100);
    return `
      <div class="chart-row">
        <span>${escapeHtml(status)}</span>
        <div class="chart-track"><span style="width:${count ? Math.max(percent, 4) : 0}%"></span></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

function renderSourceConversionChart(visibleLeads) {
  if (!reportSourceChart) return;
  const sourceGroups = [
    { label: "Website", values: ["Website"] },
    { label: "Tablet", values: ["Tablet"] },
    { label: "External", values: ["Upload", "Admin"] }
  ];
  reportSourceChart.innerHTML = sourceGroups.map((group) => {
    const matching = visibleLeads.filter((lead) => group.values.includes(lead.source || "Website"));
    const moved = matching.filter(isMovedInLead).length;
    const percent = matching.length ? Math.round((moved / matching.length) * 100) : 0;
    return `
      <div class="chart-row source-conversion-row">
        <span>${escapeHtml(group.label)}</span>
        <div class="chart-track"><span style="width:${percent}%"></span></div>
        <strong>${percent}%</strong>
        <small>${moved}/${matching.length} moved in</small>
      </div>
    `;
  }).join("");
}

function renderCareTypeChart(visibleLeads) {
  if (!reportCareChart) return;
  const counts = new Map();
  visibleLeads.forEach((lead) => {
    const careType = lead.careType || "Not sure yet";
    counts.set(careType, (counts.get(careType) || 0) + 1);
  });
  const rows = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const max = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) {
    reportCareChart.innerHTML = `<p class="muted">No care type data yet.</p>`;
    return;
  }
  reportCareChart.innerHTML = rows.map((row) => `
    <div class="chart-row">
      <span>${escapeHtml(row.label)}</span>
      <div class="chart-track"><span style="width:${Math.max(6, Math.round((row.count / max) * 100))}%"></span></div>
      <strong>${row.count}</strong>
    </div>
  `).join("");
}

function renderSourcePerformance() {
  if (!sourcePerformance) return;
  const visibleLeads = scopedLeads();
  const sourceGroups = [
    { label: "Website leads", values: ["Website"] },
    { label: "Tablet leads", values: ["Tablet"] },
    { label: "External leads", values: ["Upload", "Admin"] }
  ];
  sourcePerformance.innerHTML = sourceGroups.map((group) => {
    const sourceLeads = visibleLeads.filter((lead) => group.values.includes(lead.source || "Website"));
    const tours = sourceLeads.filter(isActiveTourLead).length;
    const movedIn = sourceLeads.filter(isMovedInLead).length;
    const conversion = sourceLeads.length ? Math.round((movedIn / sourceLeads.length) * 100) : 0;
    return `
      <article class="source-card">
        <strong>${escapeHtml(group.label)}</strong>
        <dl>
          <div><dt>Total</dt><dd>${sourceLeads.length}</dd></div>
          <div><dt>Tours</dt><dd>${tours}</dd></div>
          <div><dt>Moved in</dt><dd>${movedIn}</dd></div>
          <div><dt>Conv.</dt><dd>${conversion}%</dd></div>
        </dl>
      </article>
    `;
  }).join("");
}

function renderCommunityDashboard() {
  if (!communityList || !communityCount) return;
  const visibleLeads = scopedLeads();
  const communities = [...new Set(visibleLeads.map((lead) => lead.location || lead.preferredCommunity).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  communityCount.textContent = `${communities.length} communit${communities.length === 1 ? "y" : "ies"}`;

  if (!communities.length) {
    communityList.innerHTML = `<p class="muted">No community data yet.</p>`;
    return;
  }

  communityList.innerHTML = communities.map((community) => {
    const communityLeads = visibleLeads.filter((lead) => (lead.location || lead.preferredCommunity) === community);
    const tours = communityLeads.filter(isActiveTourLead).length;
    const movedIn = communityLeads.filter(isMovedInLead).length;
    const conversion = communityLeads.length ? Math.round((movedIn / communityLeads.length) * 100) : 0;
    const recent = communityLeads[0];
    return `
      <button class="community-card-mini" type="button" data-community-card="${escapeHtml(community)}">
        <span>
          <strong>${escapeHtml(community)}</strong>
          <small>${recent ? `Recent: ${escapeHtml(recent.fullName || recent.name || "Lead")}` : "No recent leads"}</small>
        </span>
        <dl>
          <div><dt>Leads</dt><dd>${communityLeads.length}</dd></div>
          <div><dt>Tours</dt><dd>${tours}</dd></div>
          <div><dt>Moved in</dt><dd>${movedIn}</dd></div>
          <div><dt>Conv.</dt><dd>${conversion}%</dd></div>
        </dl>
      </button>
    `;
  }).join("");

  communityList.querySelectorAll("[data-community-card]").forEach((button) => {
    button.addEventListener("click", () => {
      communityFilter.value = button.dataset.communityCard;
      renderLeads();
      document.querySelector(".filters")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function renderPastTourPrompts() {
  const panel = document.querySelector("[data-past-tour-panel]");
  const list = document.querySelector("[data-past-tour-list]");
  const count = document.querySelector("[data-past-tour-count]");
  if (!panel || !list || !count) return;

  const now = new Date();
  const pastTours = scopedLeads().filter((lead) => {
    if (lead.status !== "Tour Scheduled" || !lead.tourScheduledAt) return false;
    const date = new Date(lead.tourScheduledAt);
    return !Number.isNaN(date.getTime()) && date < now;
  }).sort((a, b) => new Date(b.tourScheduledAt) - new Date(a.tourScheduledAt));

  if (!pastTours.length) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "";
  count.textContent = `${pastTours.length} pending`;

  list.innerHTML = pastTours.map((lead) => `
    <article class="past-tour-item">
      <div class="past-tour-info">
        <strong>${escapeHtml(lead.fullName || lead.name)}</strong>
        <small>${escapeHtml(lead.location || lead.preferredCommunity || "Unknown")} &middot; ${escapeHtml(formatDate(lead.tourScheduledAt))}</small>
      </div>
      <div class="past-tour-actions">
        <button type="button" class="btn btn-sm btn-primary" data-past-tour-yes="${lead.id}">✓ Yes, toured</button>
        <button type="button" class="btn btn-sm btn-ghost" data-past-tour-no="${lead.id}">✗ Reschedule</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-past-tour-yes]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Updating...";
      await updateLeadStatus(btn.dataset.pastTourYes, "Tour Completed");
      renderPastTourPrompts();
    });
  });

  list.querySelectorAll("[data-past-tour-no]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openDrawer(btn.dataset.pastTourNo, { focusTour: true });
    });
  });
}

function renderUpcomingTours() {
  if (!tourList || !tourCount) return;
  const now = new Date();
  const upcoming = scopedLeads()
    .filter((lead) => {
      if (!isActiveTourLead(lead)) return false;
      const date = new Date(lead.tourScheduledAt);
      return !Number.isNaN(date.getTime()) && date >= now;
    })
    .sort((a, b) => new Date(a.tourScheduledAt) - new Date(b.tourScheduledAt));

  tourCount.textContent = `${upcoming.length} scheduled`;
  if (!upcoming.length) {
    tourList.innerHTML = `<p class="muted">No upcoming tours scheduled.</p>`;
    return;
  }

  const visibleTours = upcoming.slice(0, TOUR_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, upcoming.length - visibleTours.length);

  tourList.innerHTML = `
    ${visibleTours.map((lead) => `
    <button class="tour-item" type="button" data-open-tour="${lead.id}">
      <span>
        <strong>${escapeHtml(lead.fullName || lead.name)}</strong>
        <small>${escapeHtml(lead.location || lead.preferredCommunity || "Unknown")}</small>
      </span>
      <span class="tour-time">${escapeHtml(formatDate(lead.tourScheduledAt))}</span>
    </button>
    `).join("")}
    ${hiddenCount ? `
      <button class="tour-view-all" type="button" data-tour-view-all>
        View all ${upcoming.length} scheduled tours
      </button>
    ` : ""}
  `;

  tourList.querySelectorAll("[data-open-tour]").forEach((button) => {
    button.addEventListener("click", () => openDrawer(button.dataset.openTour));
  });
  tourList.querySelector("[data-tour-view-all]")?.addEventListener("click", () => {
    statusFilter.value = "Tour Scheduled";
    currentLeadPage = 1;
    renderLeads();
    document.querySelector(".filters")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function isActiveTourLead(lead = {}) {
  return lead.status === "Tour Scheduled" && Boolean(lead.tourScheduledAt);
}

function isMovedInLead(lead = {}) {
  return lead.status === "Moved In";
}

function renderPinnedFollowups() {
  if (!followupList || !followupCount) return;
  const due = scopedLeads()
    .filter(isFollowUpDueToday)
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));

  followupCount.textContent = `${due.length} due`;
  if (!due.length) {
    followupList.innerHTML = `<p class="muted">No follow-ups due today.</p>`;
    return;
  }

  followupList.innerHTML = due.slice(0, 6).map((lead) => `
    <article class="followup-item">
      <button class="followup-main" type="button" data-open-followup="${lead.id}">
        <span>
          <strong>${escapeHtml(lead.fullName || lead.name)}</strong>
          <small>${escapeHtml(lead.location || lead.preferredCommunity || "Unknown")} &middot; ${escapeHtml(lead.followUpNote || reminderLabel(lead.followUpAt))}</small>
        </span>
        <span class="followup-time">${escapeHtml(reminderLabel(lead.followUpAt))}</span>
      </button>
      <div class="followup-actions">
        <button type="button" data-followup-action="complete" data-followup-id="${lead.id}">Mark Done</button>
        <button type="button" data-followup-action="tomorrow" data-followup-id="${lead.id}">Tomorrow</button>
        <button type="button" data-followup-action="clear" data-followup-id="${lead.id}">Clear</button>
      </div>
    </article>
  `).join("");

  followupList.querySelectorAll("[data-open-followup]").forEach((button) => {
    button.addEventListener("click", () => openDrawer(button.dataset.openFollowup));
  });
  followupList.querySelectorAll("[data-followup-action]").forEach((button) => {
    button.addEventListener("click", () => handleFollowupAction(button));
  });
}

async function handleFollowupAction(button) {
  const id = button.dataset.followupId;
  const action = button.dataset.followupAction;
  const lead = leads.find((item) => String(item.id) === String(id));
  if (!id || !action) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = action === "tomorrow" ? "Saving..." : "Updating...";

  try {
    let data;
    if (action === "tomorrow") {
      data = await postJson(`/api/admin/leads/${id}/reminder`, {
        followUpAt: "tomorrow",
        preset: "tomorrow",
        note: lead?.followUpNote || "Follow up with this lead"
      });
    } else {
      data = await postJson(`/api/admin/leads/${id}/reminder`, { action });
    }

    if (lead) {
      lead.followUpAt = data.followUpAt || "";
      lead.followUpNote = data.followUpNote || "";
      if (data.status) lead.status = data.status;
    }
    renderLeads();
    if (String(activeDrawerLeadId) === String(id)) {
      await openDrawer(id);
    }
  } catch (err) {
    button.textContent = err.message || "Failed";
    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
    return;
  }

  button.disabled = false;
  button.textContent = originalText;
}

async function loadTimeline(id) {
  leadTimeline.innerHTML = `<p class="muted">Loading...</p>`;
  try {
    const response = await fetch(`/api/admin/leads/${id}/timeline`);
    const data = await response.json();
    const timeline = data.timeline || [];
    if (!timeline.length) {
      leadTimeline.innerHTML = `<p class="muted">No timeline activity yet.</p>`;
      return;
    }
    leadTimeline.innerHTML = timeline.map((item) => `
      <article class="timeline-item">
        <strong>${escapeHtml(item.label || "Activity")}</strong>
        <span>${escapeHtml(item.detail || "")}</span>
        <small>${formatDate(item.createdAt)}</small>
      </article>
    `).join("");
  } catch {
    leadTimeline.innerHTML = `<p class="muted">Could not load timeline.</p>`;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    throw new Error("Please log in again.");
  }
  if (!response.ok) throw new Error(data.error || data.errors?.[0] || "Request failed.");
  return data;
}

function countMatchingLeads(filters = currentFilters()) {
  return scopedLeads().filter((lead) => {
    const submitted = new Date(lead.submittedAt);
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : null;
    const location = lead.location || lead.preferredCommunity || "";
    return (!filters.community || location === filters.community)
      && (!Array.isArray(filters.communities) || !filters.communities.length || filters.communities.includes(location))
      && (!filters.source || lead.source === filters.source)
      && (!filters.priority || (lead.priorityTags || []).includes(filters.priority))
      && (!filters.score || lead.activityLabel === filters.score)
      && (!filters.status || lead.status === filters.status)
      && (!dateFrom || submitted >= dateFrom)
      && (!dateTo || submitted <= dateTo);
  }).length;
}

function isFollowUpDueToday(lead) {
  if (!lead.followUpAt) return false;
  const reminder = new Date(lead.followUpAt);
  if (Number.isNaN(reminder.getTime())) return false;
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return reminder <= endOfToday && lead.status !== "Closed" && lead.status !== "Moved In";
}

function reminderLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Follow-up set";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startReminder = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startReminder - startToday) / 86400000);
  if (dayDiff < 0) return "Follow-up overdue";
  if (dayDiff === 0) return "Follow-up today";
  if (dayDiff === 1) return "Follow-up tomorrow";
  return `Follow-up ${date.toLocaleDateString()}`;
}

function dateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateTimeInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function currentFilters() {
  return {
    community: communityFilter.value,
    source: sourceFilter.value,
    priority: priorityFilter.value,
    score: scoreFilter.value,
    status: statusFilter.value,
    dateFrom: dateFromFilter.value,
    dateTo: dateToFilter.value
  };
}

function currentOutreachFilters() {
  const filters = {
    community: draftCommunity?.value || "",
    source: draftSource?.value || "",
    priority: draftPriority?.value || "",
    score: draftScore?.value || "",
    status: draftStatus?.value || ""
  };
  if (!filters.community && selectedAdminLocations.size) {
    filters.communities = [...selectedAdminLocations];
  }
  return filters;
}

function currentFilterParams() {
  const params = new URLSearchParams();
  const filters = currentFilters();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

function labelKind(kind) {
  return {
    tour: "Schedule a Tour",
    contact: "Contact / Inquiry",
    community: "Community Inquiry"
  }[kind] || "Inquiry";
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function dayKeyLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function renderPriorityTags(lead) {
  const tags = lead.priorityTags || [];
  if (!tags.length) return "";
  return `<div class="priority-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function renderRatingReasons(lead, limit = 4) {
  const reasons = (lead.activityReasons || []).slice(0, limit);
  if (!reasons.length) return "";
  return `<div class="rating-reasons">${reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div>`;
}

function renderSuggestedAction(lead) {
  if (!lead.activityAction) return "";
  return `<small class="suggested-action">${escapeHtml(lead.activityAction)}</small>`;
}

function renderActivityBadge(lead) {
  const label = lead.activityLabel || "Cold";
  return `<span class="activity-badge activity-${label.toLowerCase()}">${escapeHtml(activityRatingText(lead))}</span>`;
}

function activityRatingText(lead) {
  const label = lead.activityLabel || "Cold";
  const score = Number.isFinite(Number(lead.activityScore)) ? Number(lead.activityScore) : 0;
  return `${label} Lead ${score}`;
}

function validateLeadContact(payload) {
  const name = String(payload.fullName || payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim();
  if (!name) return "Full name is required.";
  if (!phone) return "Phone is required.";
  if (!isValidPhone(phone)) return "Enter a valid 10-digit phone number.";
  if (email && !isValidEmail(email)) return "Enter a valid email or leave it blank.";
  return "";
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) && !email.includes("..");
}

function tourLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tour scheduled";
  return `Tour ${date.toLocaleDateString()}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

// ============================================================
// RESIDENT DIRECTORY
// ============================================================
const residentForm = document.querySelector("[data-resident-form]");
const residentList = document.querySelector("[data-resident-list]");
const residentStatus = document.querySelector("[data-resident-status]");
const residentFilterCommunity = document.querySelector("[data-resident-filter-community]");
const residentFilterStatus = document.querySelector("[data-resident-filter-status]");
const addResidentToggle = document.querySelector("[data-add-resident-toggle]");
const cancelResidentBtn = document.querySelector("[data-cancel-resident]");
const residentCommunitySelect = document.querySelector("[data-resident-community]");

let allResidents = [];

addResidentToggle?.addEventListener("click", () => {
  const hidden = residentForm.style.display === "none";
  residentForm.style.display = hidden ? "" : "none";
  addResidentToggle.innerHTML = hidden ? '<i data-lucide="x"></i>Cancel' : '<i data-lucide="user-plus"></i>Add Resident';
  window.lucide?.createIcons();
});
cancelResidentBtn?.addEventListener("click", () => {
  residentForm.style.display = "none";
  addResidentToggle.innerHTML = '<i data-lucide="user-plus"></i>Add Resident';
  window.lucide?.createIcons();
  residentForm.reset();
});

async function loadResidents() {
  if (!residentList) return;
  populateResidentCommunityFilters(); // populate immediately with COMMUNITIES
  try {
    const res = await fetch("/api/admin/operations/residents");
    if (!res.ok) return;
    const data = await res.json();
    allResidents = data.residents || [];
    renderResidents();
  } catch {}
}

function populateResidentCommunityFilters() {
  const communities = [...new Set(allResidents.map(r => r.community).filter(Boolean))].sort();
  [residentFilterCommunity, residentCommunitySelect, document.querySelector("[data-incident-community]")].forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    communities.forEach(c => { const o = document.createElement("option"); o.value = o.textContent = c; sel.appendChild(o); });
    if (current) sel.value = current;
  });
}

function renderResidents() {
  if (!residentList) return;
  const community = residentFilterCommunity?.value || "";
  const status = residentFilterStatus?.value || "";
  const filtered = allResidents.filter(r =>
    (!community || r.community === community) &&
    (!status || r.status === status)
  );
  if (!filtered.length) { residentList.innerHTML = '<p class="muted">No residents found.</p>'; return; }
  residentList.innerHTML = filtered.map(r => `
    <div class="resident-card" data-resident-id="${r.id}">
      <div class="resident-info">
        <h4>${esc(r.name)} <small style="color:rgba(255,255,255,0.4);font-size:0.78rem">${esc(r.status || "Active")}</small></h4>
        <p>${esc(r.community)}${r.room_number ? ` � Room ${esc(r.room_number)}` : ""} � ${esc(r.care_level || "")}</p>
        ${r.move_in_date ? `<p>Moved in: ${esc(r.move_in_date)}</p>` : ""}
        ${r.emergency_contact_name ? `<p>Emergency: ${esc(r.emergency_contact_name)}${r.emergency_contact_phone ? ` � ${esc(r.emergency_contact_phone)}` : ""}</p>` : ""}
        ${r.notes ? `<p style="font-style:italic">${esc(r.notes)}</p>` : ""}
      </div>
      <div class="resident-actions">
        <button class="btn btn-ghost" onclick="dischargeResident(${r.id}, '${esc(r.status)}')">${r.status === "Discharged" ? "Reactivate" : "Discharge"}</button>
        <button class="btn btn-ghost" onclick="deleteResident(${r.id})"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `).join("");
  window.lucide?.createIcons();
}

residentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = residentForm.querySelector("button[type=submit]");
  btn.disabled = true;
  const payload = Object.fromEntries(new FormData(residentForm).entries());
  try {
    const res = await fetch("/api/admin/operations/residents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    if (residentStatus) { residentStatus.textContent = "? Resident added"; setTimeout(() => residentStatus.textContent = "", 3000); }
    residentForm.reset();
    residentForm.style.display = "none";
    addResidentToggle.innerHTML = '<i data-lucide="user-plus"></i>Add Resident';
    await loadResidents();
  } catch (err) {
    if (residentStatus) residentStatus.textContent = err.message;
  } finally { btn.disabled = false; }
});

window.dischargeResident = async (id, currentStatus) => {
  const status = currentStatus === "Discharged" ? "Active" : "Discharged";
  await fetch(`/api/admin/operations/residents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  await loadResidents();
};
window.deleteResident = async (id) => {
  if (!confirm("Delete this resident? This cannot be undone.")) return;
  await fetch(`/api/admin/operations/residents/${id}`, { method: "DELETE" });
  await loadResidents();
};

[residentFilterCommunity, residentFilterStatus].forEach(el => el?.addEventListener("change", renderResidents));

// ============================================================
// INCIDENT LOG
// ============================================================
const incidentForm = document.querySelector("[data-incident-form]");
const incidentList = document.querySelector("[data-incident-list]");
const incidentStatus = document.querySelector("[data-incident-status]");
const incidentFilterCommunity = document.querySelector("[data-incident-filter-community]");
const incidentFilterSeverity = document.querySelector("[data-incident-filter-severity]");
const incidentFilterFollowup = document.querySelector("[data-incident-filter-followup]");
const addIncidentToggle = document.querySelector("[data-add-incident-toggle]");
const cancelIncidentBtn = document.querySelector("[data-cancel-incident]");

let allIncidents = [];

addIncidentToggle?.addEventListener("click", () => {
  const hidden = incidentForm.style.display === "none";
  incidentForm.style.display = hidden ? "" : "none";
  addIncidentToggle.innerHTML = hidden ? '<i data-lucide="x"></i>Cancel' : '<i data-lucide="alert-triangle"></i>Log Incident';
  window.lucide?.createIcons();
});
cancelIncidentBtn?.addEventListener("click", () => {
  incidentForm.style.display = "none";
  addIncidentToggle.innerHTML = '<i data-lucide="alert-triangle"></i>Log Incident';
  window.lucide?.createIcons();
  incidentForm.reset();
});

async function loadIncidents() {
  if (!incidentList) return;
  try {
    const res = await fetch("/api/admin/operations/incidents");
    if (!res.ok) return;
    const data = await res.json();
    allIncidents = data.incidents || [];
    populateIncidentCommunityFilter();
    renderIncidents();
  } catch {}
}

function populateIncidentCommunityFilter() {
  if (!incidentFilterCommunity) return;
  const communities = [...new Set([
    ...allResidents.map(r => r.community),
    ...allIncidents.map(i => i.community)
  ].filter(Boolean))].sort();
  const current = incidentFilterCommunity.value;
  while (incidentFilterCommunity.options.length > 1) incidentFilterCommunity.remove(1);
  communities.forEach(c => { const o = document.createElement("option"); o.value = o.textContent = c; incidentFilterCommunity.appendChild(o); });
  if (current) incidentFilterCommunity.value = current;
}

function renderIncidents() {
  if (!incidentList) return;
  const community = incidentFilterCommunity?.value || "";
  const severity = incidentFilterSeverity?.value || "";
  const followupOnly = incidentFilterFollowup?.checked || false;
  const filtered = allIncidents.filter(i =>
    (!community || i.community === community) &&
    (!severity || i.severity === severity) &&
    (!followupOnly || (i.follow_up_required && !i.follow_up_completed))
  );
  if (!filtered.length) { incidentList.innerHTML = '<p class="muted">No incidents found.</p>'; return; }
  incidentList.innerHTML = filtered.map(i => {
    const sev = (i.severity || "Low").toLowerCase();
    const followupBadge = i.follow_up_required
      ? `<span class="followup-badge ${i.follow_up_completed ? "followup-done" : ""}">${i.follow_up_completed ? "? Follow-up done" : "Follow-up needed"}</span>`
      : "";
    return `
    <div class="incident-card">
      <div class="incident-info">
        <h4>${esc(i.type || "Incident")} <span class="severity-badge severity-${sev}">${esc(i.severity)}</span>${followupBadge}</h4>
        <p>${esc(i.resident_name || "Unknown resident")} � ${esc(i.community)} � ${i.incident_at ? new Date(i.incident_at).toLocaleString() : ""}</p>
        <p>${esc(i.description)}</p>
        ${i.staff_name ? `<p>Staff: ${esc(i.staff_name)}</p>` : ""}
        ${i.follow_up_notes ? `<p style="font-style:italic">Follow-up: ${esc(i.follow_up_notes)}</p>` : ""}
      </div>
      <div class="incident-actions">
        ${i.follow_up_required && !i.follow_up_completed ? `<button class="btn btn-ghost" onclick="markFollowupDone(${i.id})">Mark done</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

incidentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = incidentForm.querySelector("button[type=submit]");
  btn.disabled = true;
  const payload = Object.fromEntries(new FormData(incidentForm).entries());
  payload.followUpRequired = !!payload.followUpRequired;
  try {
    const res = await fetch("/api/admin/operations/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    if (incidentStatus) { incidentStatus.textContent = "? Incident logged"; setTimeout(() => incidentStatus.textContent = "", 3000); }
    incidentForm.reset();
    incidentForm.style.display = "none";
    addIncidentToggle.innerHTML = '<i data-lucide="alert-triangle"></i>Log Incident';
    await loadIncidents();
  } catch (err) {
    if (incidentStatus) incidentStatus.textContent = err.message;
  } finally { btn.disabled = false; }
});

window.markFollowupDone = async (id) => {
  await fetch(`/api/admin/operations/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ followUpCompleted: true }) });
  await loadIncidents();
};

[incidentFilterCommunity, incidentFilterSeverity, incidentFilterFollowup].forEach(el => el?.addEventListener("change", renderIncidents));


