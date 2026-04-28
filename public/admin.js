const loginPanel = document.querySelector("[data-login-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector("[data-login-form]");
const leadsBody = document.querySelector("[data-leads-body]");
const emptyState = document.querySelector("[data-empty]");
const searchInput = document.querySelector("[data-search]");
const communityFilter = document.querySelector("[data-filter-community]");
const statusFilter = document.querySelector("[data-filter-status]");
const dateFromFilter = document.querySelector("[data-filter-date-from]");
const dateToFilter = document.querySelector("[data-filter-date-to]");
const exportButton = document.querySelector("[data-export]");
const exportLabel = document.querySelector("[data-export-label]");
const importFile = document.querySelector("[data-import-file]");
const importCsv = document.querySelector("[data-import-csv]");
const importButton = document.querySelector("[data-import-leads]");
const importStatus = document.querySelector("[data-import-status]");
const draftCommunity = document.querySelector("[data-draft-community]");
const draftButton = document.querySelector("[data-draft-email]");
const emailSubject = document.querySelector("[data-email-subject]");
const emailBody = document.querySelector("[data-email-body]");
const testRecipient = document.querySelector("[data-test-recipient]");
const sendTestButton = document.querySelector("[data-send-test-email]");
const demoCampaignButton = document.querySelector("[data-send-demo-campaign]");
const liveCampaignButton = document.querySelector("[data-send-live-campaign]");
const outreachStatus = document.querySelector("[data-outreach-status]");
const statuses = ["New", "Contacted", "Tour Scheduled", "Closed"];
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

window.lucide?.createIcons();
hydrateFilters();
fetchLeads();

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

[searchInput, communityFilter, statusFilter, dateFromFilter, dateToFilter].forEach((control) => {
  control.addEventListener("input", renderLeads);
});

exportButton.addEventListener("click", exportLeads);
importFile.addEventListener("change", loadImportFile);
importButton.addEventListener("click", importLeads);
draftButton.addEventListener("click", draftEmail);
sendTestButton.addEventListener("click", sendTestEmail);
demoCampaignButton.addEventListener("click", logDemoCampaign);
liveCampaignButton.addEventListener("click", sendLiveCampaign);

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
}

function hydrateFilters() {
  const selectedCommunity = communityFilter.value;
  const selectedStatus = statusFilter.value;
  communityFilter.innerHTML = `<option value="">All communities</option>${COMMUNITIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
  communityFilter.value = selectedCommunity;

  statusFilter.innerHTML = `<option value="">All statuses</option>${statuses
    .map((status) => `<option value="${status}">${status}</option>`)
    .join("")}`;
  statusFilter.value = selectedStatus;

  const selectedDraftCommunity = draftCommunity.value;
  draftCommunity.innerHTML = `<option value="">All communities</option>${COMMUNITIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
  draftCommunity.value = selectedDraftCommunity;
}

function renderLeads() {
  const query = searchInput.value.trim().toLowerCase();
  const community = communityFilter.value;
  const status = statusFilter.value;
  const dateFrom = dateFromFilter.value ? new Date(`${dateFromFilter.value}T00:00:00`) : null;
  const dateTo = dateToFilter.value ? new Date(`${dateToFilter.value}T23:59:59.999`) : null;
  const filtered = leads.filter((lead) => {
    const haystack = [
      lead.fullName,
      lead.phone,
      lead.email,
      lead.preferredCommunity,
      lead.careType,
      lead.message,
      lead.tourPreference
    ].join(" ").toLowerCase();
    const submitted = new Date(lead.submittedAt);
    return (!query || haystack.includes(query))
      && (!community || lead.preferredCommunity === community)
      && (!status || lead.status === status)
      && (!dateFrom || submitted >= dateFrom)
      && (!dateTo || submitted <= dateTo);
  });

  leadsBody.innerHTML = filtered.map((lead) => `
    <tr>
      <td><strong>${escapeHtml(lead.fullName)}</strong><br><small>${escapeHtml(labelKind(lead.kind))}</small></td>
      <td>${escapeHtml(lead.phone)}</td>
      <td>${escapeHtml(lead.email)}</td>
      <td>${escapeHtml(lead.preferredCommunity)}</td>
      <td>${escapeHtml(lead.careType)}</td>
      <td class="message-cell">${escapeHtml(lead.message || lead.tourPreference || "No message")}</td>
      <td>${formatDate(lead.submittedAt)}</td>
      <td>
        <select class="status-select" data-lead-status="${lead.id}">
          ${statuses.map((item) => `<option value="${item}" ${item === lead.status ? "selected" : ""}>${item}</option>`).join("")}
        </select>
      </td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost" style="color:#1a6fbf;padding:4px 8px" data-email-lead="${lead.id}" title="Email this lead">
          <i data-lucide="mail"></i>
        </button>
        <button class="btn btn-ghost" style="color:#c0392b;padding:4px 8px" data-delete-lead="${lead.id}" title="Delete lead">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `).join("");

  emptyState.hidden = filtered.length !== 0;
  document.querySelector("[data-metric-total]").textContent = leads.length;
  document.querySelector("[data-metric-new]").textContent = leads.filter((lead) => lead.status === "New").length;
  document.querySelector("[data-metric-tour]").textContent = leads.filter((lead) => lead.status === "Tour Scheduled").length;

  leadsBody.querySelectorAll("[data-lead-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const id = select.dataset.leadStatus;
      const response = await fetch(`/api/admin/leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: select.value })
      });
      if (response.ok) {
        const lead = leads.find((item) => String(item.id) === String(id));
        if (lead) lead.status = select.value;
        renderLeads();
      }
    });
  });

  leadsBody.querySelectorAll("[data-email-lead]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.emailLead;
      const lead = leads.find((item) => String(item.id) === String(id));
      if (!window.confirm(`Send a personalized AI email to ${lead?.fullName} (${lead?.email})?`)) return;
      btn.disabled = true;
      const icon = btn.querySelector("i");
      if (icon) icon.setAttribute("data-lucide", "loader");
      window.lucide?.createIcons();
      try {
        const data = await postJson(`/api/admin/leads/${id}/email`, {});
        alert(`✅ ${data.message}\n\nSubject: ${data.subject}`);
        if (data.ok) {
          const l = leads.find((item) => String(item.id) === String(id));
          if (l) l.status = "Contacted";
          renderLeads();
        }
      } catch (err) {
        alert(`❌ ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  });

  leadsBody.querySelectorAll("[data-delete-lead]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteLead;
      const lead = leads.find((item) => String(item.id) === String(id));
      if (!window.confirm(`Delete ${lead?.fullName || "this lead"}? This cannot be undone.`)) return;
      const response = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
      if (response.ok) {
        leads = leads.filter((item) => String(item.id) !== String(id));
        renderLeads();
      }
    });
  });

  window.lucide?.createIcons();
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

async function draftEmail() {
  draftButton.disabled = true;
  outreachStatus.textContent = "Generating AI draft...";
  try {
    const filters = currentFilters();
    if (draftCommunity.value) filters.community = draftCommunity.value;
    const data = await postJson("/api/admin/outreach/draft", { filters });
    emailSubject.value = data.subject || "";
    emailBody.value = data.body || "";
    outreachStatus.textContent = `Draft ready for ${data.recipients || 0} lead${data.recipients === 1 ? "" : "s"}.`;
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
  if (!window.confirm(`⚠️ This will send REAL emails to every lead matching the current filters.\n\nSubject: ${subject}\n\nContinue?`)) return;

  liveCampaignButton.disabled = true;
  outreachStatus.textContent = "Sending live emails...";
  try {
    const data = await postJson("/api/admin/outreach/send-live", {
      filters: currentFilters(),
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
      filters: currentFilters(),
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
      filters: currentFilters(),
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

function currentFilters() {
  return {
    community: communityFilter.value,
    status: statusFilter.value,
    dateFrom: dateFromFilter.value,
    dateTo: dateToFilter.value
  };
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
