// @ts-check

const app = {
  supabase: null,
  session: null,
  user: null,
  locations: [],
  selectedLocationId: "",
  dashboard: null,
  intelligence: null,
  operatingPlan: { items: [], summary: {}, schemaInstalled: false },
  roomIntelligence: null,
  revenueCommand: null,
  escalations: null,
  placementDesk: null,
  forecast: null,
  referrals: [],
  referralPartners: { schemaInstalled: false, partners: [] },
  intelligenceRules: { schemaInstalled: false, rules: [] },
  integrations: { schemaInstalled: false, integrations: [] },
  scopeControl: null,
  leads: [],
  leadsPagination: { page: 1, pageCount: 1, total: 0, limit: 100 },
  operations: { residents: [], rooms: [], tours: [], followUps: [], tasks: [], notes: [], documents: [], emailHistory: [] },
  workflows: { schemaInstalled: false, workflows: [] },
  roomFilters: { status: "", careLevel: "", roomType: "" },
  selectedRoomDetail: null,
  checkIns: [],
  outreach: { campaigns: [] },
  selectedLeadDetail: null,
  activeView: "dashboard",
  leadView: localStorage.getItem("ccsl:v2-lead-view") || "pipeline",
  cmdk: { activeIndex: 0, items: [] },
  selectedLeadIds: new Set(),
  activeCommandId: localStorage.getItem("ccsl:v2-active-command") || "",
  workflowOutcome: null,
  operatingOutcome: null,
  pendingPipelineTransition: null,
  pendingResidentDepartureId: "",
  focusMode: localStorage.getItem("ccsl:v2-focus-mode") === "true",
  careOps: {
    activeTab: "incidents",
    incidents: [],
    incidentFilters: { status: "", severity: "" },
    handoffs: [],
    unackHandoffs: [],
    familyResidentId: "",
    familyUpdates: [],
    schedule: { weekOf: null, shifts: [], swaps: [], weekStart: null, weekEnd: null, locationId: "" },
    staffRoster: [],
    residentsCache: []
  }
};

const SLA_HOURS = { new: 24, contacted: 72, tour_scheduled: 168 };
const AVG_MONTHLY_REVENUE = 6500;

const PIPELINE_COLUMNS = [
  { status: "new",            label: "New" },
  { status: "contacted",      label: "Contacted" },
  { status: "tour_scheduled", label: "Tour scheduled" },
  { status: "move_in",        label: "Move-in" },
  { status: "archived",       label: "Archived",       muted: true }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const INACTIVE_FOLLOWUP_STATUSES = new Set(["completed", "archived", "missed", "done"]);
const INACTIVE_TOUR_STATUSES = new Set(["completed", "no_show", "cancelled"]);
const COORD_HORIZON_MS = 4 * 60 * 60 * 1000;
let coordinationTicker = null;
let silentRefreshTimer = null;
let _leadsReqId = 0;
let _iconRafId = null;
const _iconContexts = new Set();

// Per-resource freshness timestamps — prevents redundant fetches within the TTL
const _fetchedAt = {};
function isFresh(key, ttlMs = 30000) {
  return _fetchedAt[key] && Date.now() - _fetchedAt[key] < ttlMs;
}
function markFresh(key) { _fetchedAt[key] = Date.now(); }
function invalidate(key) { delete _fetchedAt[key]; }
function invalidateAll() { Object.keys(_fetchedAt).forEach((k) => delete _fetchedAt[k]); }
