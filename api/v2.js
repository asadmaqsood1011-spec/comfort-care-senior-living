const { getClient } = require("./_lib/db");
const { clean, readBody, sendJson } = require("./_lib/helpers");
const { createClient } = require("@supabase/supabase-js");
const { requireV2User, setSessionCookie, clearSessionCookie } = require("./_lib/v2-auth");
const {
  getLocations,
  getDashboard,
  listLeads,
  getLeadDetail,
  createLead,
  updateLeadNotes,
  generateLeadEmailDraft,
  sendLeadEmail,
  exportLeadsCsv,
  updateLeadStatus,
  hardDeleteLead,
  draftMassOutreach,
  sendMassOutreach,
  listMassOutreachCampaigns,
  setMassOutreachCampaignArchived,
  scheduleTour,
  updateTourStatus,
  updateTourDetails,
  resyncTourToGoogleCalendar,
  pullTourFromGoogleCalendar,
  hardDeleteTour,
  listIntegrations,
  createGoogleCalendarConnectUrl,
  createGoogleGmailConnectUrl,
  handleGoogleCalendarCallback,
  disconnectGoogleCalendar,
  disconnectGoogleGmail,
  pullGoogleGmailInbox,
  createFollowUp,
  updateFollowUpStatus,
  hardDeleteFollowUp,
  createTask,
  updateTaskStatus,
  hardDeleteTask,
  getDailyOperatingPlan,
  updateOperatingPlanItem,
  listOperations,
  listCheckIns,
  listRooms,
  getRoomDetail,
  getRoomAvailability,
  getRoomMatches,
  getRevenueCommand,
  createRoom,
  updateRoom,
  archiveRoom,
  hardDeleteRoom,
  createResident,
  listWorkflows,
  getEscalationSummary,
  getPlacementDesk,
  updateWorkflowStep,
  updateResidentStatus,
  hardDeleteResident,
  createNote,
  createDocumentRecord,
  createSignedUpload,
  getSignedDocumentUrl,
  listUsers,
  createUserWithAccess,
  setUserActive,
  listIntelligenceRules,
  updateIntelligenceRule,
  migrateLegacyData,
  bulkUpdateLeads,
  getTourPublicLink,
  getPublicTour,
  respondToPublicTour,
  generateMorningBrief,
  generateTourPrepBrief,
  triageInboundMessage,
  getOccupancyForecast,
  getReferralRoi,
  listReferralPartners,
  upsertReferralPartner,
  archiveLeadWithReason,
  mergeLeads,
  getScopeControlCenter,
  assignScopeWorkItem,
  updateOperationalNotification,
  listOwnerReportCsv
} = require("./_lib/v2-services");
const {
  listIntelligence,
  runIntelligenceScan,
  updateOperationalEventStatus,
  getPriorityQueues,
  generateIntelligenceDigest,
  generateRecoveryDraft,
  generateLeadSummary
} = require("./_lib/intelligence");
const careOps = require("./_lib/care-ops");

module.exports = async (req, res) => {
  try {
    const path = getPath(req);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    if (req.method === "GET" && path === "/config") {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      if (!url) return sendJson(res, 500, { error: "Supabase URL is missing." });
      return sendJson(res, 200, { supabaseUrl: url, supabaseAnonKey: anonKey, authMode: "server" });
    }

    if (req.method === "POST" && path === "/login") {
      const body = await readBody(req);
      const email = clean(body.email).toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) return sendJson(res, 422, { error: "Email and password are required." });
      const { data, error } = await getLoginClient().auth.signInWithPassword({ email, password });
      if (error || !data?.session) return sendJson(res, 401, { error: error?.message || "Invalid login." });
      setSessionCookie(res, data.session);
      return sendJson(res, 200, { session: data.session, user: data.user });
    }

    if (req.method === "POST" && path === "/logout") {
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && path === "/intake") {
      return handlePublicIntake(req, res);
    }

    if ((req.method === "GET" || req.method === "POST") && path === "/cron/intelligence-scan") {
      return handleCronIntelligenceScan(req, res);
    }

    if (req.method === "GET" && path === "/integrations/google-calendar/callback") {
      const callbackUrl = new URL(req.url || "/api/v2", "http://localhost");
      const html = await handleGoogleCalendarCallback(getClient(), Object.fromEntries(callbackUrl.searchParams.entries()), req);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    const publicTourMatch = path.match(/^\/public\/tours\/([^/]+)$/);
    if (req.method === "GET" && publicTourMatch) {
      const tokenParam = String(new URL(req.url || "/api/v2", "http://localhost").searchParams.get("t") || "");
      return sendJson(res, 200, await getPublicTour(getClient(), publicTourMatch[1], tokenParam));
    }
    const publicTourRespondMatch = path.match(/^\/public\/tours\/([^/]+)\/respond$/);
    if (req.method === "POST" && publicTourRespondMatch) {
      const respondBody = await readBody(req);
      const tokenParam = clean(respondBody.token || new URL(req.url || "/api/v2", "http://localhost").searchParams.get("t") || "");
      return sendJson(res, 200, await respondToPublicTour(getClient(), publicTourRespondMatch[1], tokenParam, clean(respondBody.action)));
    }

    const user = await requireV2User(req, res);
    const db = getClient();
    const body = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) ? await readBody(req) : {};
    const url = new URL(req.url || "/api/v2", "http://localhost");
    const locationId = clean(url.searchParams.get("locationId") || "");

    if (req.method === "GET" && path === "/session") {
      return sendJson(res, 200, { user, locations: await getLocations(db, user) });
    }

    if (req.method === "GET" && path === "/locations") {
      return sendJson(res, 200, { locations: await getLocations(db, user) });
    }

    if (req.method === "GET" && path === "/integrations") {
      return sendJson(res, 200, await listIntegrations(db, user));
    }

    if (req.method === "GET" && path === "/scope-control") {
      return sendJson(res, 200, await getScopeControlCenter(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "POST" && path === "/scope-control/assign") {
      return sendJson(res, 200, await assignScopeWorkItem(db, user, body));
    }

    const notificationMatch = path.match(/^\/scope-control\/notifications\/([^/]+)$/);
    if (req.method === "PATCH" && notificationMatch) {
      return sendJson(res, 200, { notification: await updateOperationalNotification(db, user, notificationMatch[1], body) });
    }

    if (req.method === "GET" && path === "/scope-control/owner-report.csv") {
      const csv = await listOwnerReportCsv(db, user, Object.fromEntries(url.searchParams.entries()));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"comfort-care-owner-scope-report.csv\"");
      return res.status(200).send(csv);
    }

    if (req.method === "POST" && path === "/integrations/google-calendar/connect") {
      return sendJson(res, 200, await createGoogleCalendarConnectUrl(db, user, req));
    }

    if (req.method === "POST" && path === "/integrations/google-calendar/disconnect") {
      return sendJson(res, 200, await disconnectGoogleCalendar(db, user));
    }

    if (req.method === "POST" && path === "/integrations/google-gmail/connect") {
      return sendJson(res, 200, await createGoogleGmailConnectUrl(db, user, req));
    }

    if (req.method === "POST" && path === "/integrations/google-gmail/disconnect") {
      return sendJson(res, 200, await disconnectGoogleGmail(db, user));
    }

    if (req.method === "POST" && path === "/integrations/google-gmail/pull") {
      return sendJson(res, 200, await pullGoogleGmailInbox(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "GET" && path === "/dashboard") {
      return sendJson(res, 200, await getDashboard(db, user, locationId));
    }

    if (req.method === "GET" && path === "/intelligence") {
      return sendJson(res, 200, await listIntelligence(db, user, locationId));
    }

    if (req.method === "POST" && path === "/intelligence/scan") {
      return sendJson(res, 200, await runIntelligenceScan(db, user, locationId, "manual"));
    }

    if (req.method === "GET" && path === "/intelligence/queues") {
      return sendJson(res, 200, await getPriorityQueues(db, user, locationId));
    }

    if (req.method === "GET" && path === "/intelligence/rules") {
      return sendJson(res, 200, await listIntelligenceRules(db, user));
    }

    const intelligenceRuleMatch = path.match(/^\/intelligence\/rules\/([^/]+)$/);
    if (req.method === "PATCH" && intelligenceRuleMatch) {
      return sendJson(res, 200, { rule: await updateIntelligenceRule(db, user, intelligenceRuleMatch[1], body) });
    }

    if (req.method === "POST" && path === "/intelligence/digest") {
      return sendJson(res, 200, await generateIntelligenceDigest(db, user, locationId));
    }

    if (req.method === "POST" && path === "/intelligence/morning-brief") {
      return sendJson(res, 200, await generateMorningBrief(db, user, locationId));
    }

    if (req.method === "POST" && path === "/intelligence/triage") {
      return sendJson(res, 200, await triageInboundMessage(db, user, body));
    }

    const tourPrepMatch = path.match(/^\/tours\/([^/]+)\/prep-brief$/);
    if (req.method === "POST" && tourPrepMatch) {
      return sendJson(res, 200, await generateTourPrepBrief(db, user, tourPrepMatch[1]));
    }

    const eventStatusMatch = path.match(/^\/intelligence\/events\/([^/]+)\/status$/);
    if (req.method === "PATCH" && eventStatusMatch) {
      return sendJson(res, 200, { event: await updateOperationalEventStatus(db, user, eventStatusMatch[1], body.status) });
    }

    const recoveryDraftMatch = path.match(/^\/intelligence\/events\/([^/]+)\/recovery-draft$/);
    if (req.method === "POST" && recoveryDraftMatch) {
      return sendJson(res, 200, await generateRecoveryDraft(db, user, recoveryDraftMatch[1]));
    }

    if (req.method === "GET" && path === "/leads") {
      return sendJson(res, 200, await listLeads(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "GET" && path === "/leads/export") {
      const csv = await exportLeadsCsv(db, user, Object.fromEntries(url.searchParams.entries()));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"comfort-care-v2-leads.csv\"");
      return res.status(200).send(csv);
    }

    if (req.method === "POST" && path === "/leads") {
      return sendJson(res, 201, await createLead(db, user, body));
    }

    const detailMatch = path.match(/^\/leads\/([^/]+)$/);
    if (req.method === "GET" && detailMatch) {
      return sendJson(res, 200, await getLeadDetail(db, user, detailMatch[1]));
    }
    if (req.method === "DELETE" && detailMatch) {
      return sendJson(res, 200, await hardDeleteLead(db, user, detailMatch[1], body));
    }

    const notesMatch = path.match(/^\/leads\/([^/]+)\/notes$/);
    if (req.method === "PATCH" && notesMatch) {
      return sendJson(res, 200, { lead: await updateLeadNotes(db, user, notesMatch[1], body.notes || body.notes_summary || "") });
    }

    const emailDraftMatch = path.match(/^\/leads\/([^/]+)\/email-draft$/);
    if (req.method === "POST" && emailDraftMatch) {
      return sendJson(res, 200, await generateLeadEmailDraft(db, user, emailDraftMatch[1]));
    }

    const emailSendMatch = path.match(/^\/leads\/([^/]+)\/email$/);
    if (req.method === "POST" && emailSendMatch) {
      return sendJson(res, 200, await sendLeadEmail(db, user, emailSendMatch[1], body));
    }

    const leadSummaryMatch = path.match(/^\/leads\/([^/]+)\/summary$/);
    if (req.method === "POST" && leadSummaryMatch) {
      return sendJson(res, 200, await generateLeadSummary(db, user, leadSummaryMatch[1]));
    }

    const statusMatch = path.match(/^\/leads\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      return sendJson(res, 200, { lead: await updateLeadStatus(db, user, statusMatch[1], clean(body.status)) });
    }

    if (req.method === "POST" && path === "/leads/bulk") {
      return sendJson(res, 200, await bulkUpdateLeads(db, user, body));
    }

    if (req.method === "GET" && path === "/outreach/history") {
      return sendJson(res, 200, { campaigns: await listMassOutreachCampaigns(db, user, Object.fromEntries(url.searchParams.entries())) });
    }

    if (req.method === "POST" && path === "/outreach/draft") {
      return sendJson(res, 200, await draftMassOutreach(db, user, body));
    }

    if (req.method === "POST" && path === "/outreach/send") {
      return sendJson(res, 200, await sendMassOutreach(db, user, body));
    }

    if (req.method === "POST" && path === "/outreach/archive") {
      return sendJson(res, 200, await setMassOutreachCampaignArchived(db, user, body));
    }

    if (req.method === "POST" && path === "/leads/merge") {
      return sendJson(res, 200, await mergeLeads(db, user, body));
    }

    const archiveMatch = path.match(/^\/leads\/([^/]+)\/archive$/);
    if (req.method === "POST" && archiveMatch) {
      return sendJson(res, 200, { lead: await archiveLeadWithReason(db, user, archiveMatch[1], body) });
    }

    if (req.method === "GET" && path === "/forecast/occupancy") {
      return sendJson(res, 200, await getOccupancyForecast(db, user, locationId));
    }

    if (req.method === "GET" && path === "/reports/referrals") {
      return sendJson(res, 200, { sources: await getReferralRoi(db, user, locationId) });
    }
    if (req.method === "GET" && path === "/referral-partners") {
      return sendJson(res, 200, await listReferralPartners(db, user, Object.fromEntries(url.searchParams.entries())));
    }
    if (req.method === "POST" && path === "/referral-partners") {
      return sendJson(res, 201, { partner: await upsertReferralPartner(db, user, body) });
    }

    if (req.method === "POST" && path === "/tours") {
      return sendJson(res, 201, { tour: await scheduleTour(db, user, body) });
    }

    const tourStatusMatch = path.match(/^\/tours\/([^/]+)\/status$/);
    if (req.method === "PATCH" && tourStatusMatch) {
      return sendJson(res, 200, { tour: await updateTourStatus(db, user, tourStatusMatch[1], clean(body.status)) });
    }
    const tourCalendarPushMatch = path.match(/^\/tours\/([^/]+)\/calendar\/resync$/);
    if (req.method === "POST" && tourCalendarPushMatch) {
      return sendJson(res, 200, { tour: await resyncTourToGoogleCalendar(db, user, tourCalendarPushMatch[1]) });
    }
    const tourCalendarPullMatch = path.match(/^\/tours\/([^/]+)\/calendar\/pull$/);
    if (req.method === "POST" && tourCalendarPullMatch) {
      return sendJson(res, 200, { tour: await pullTourFromGoogleCalendar(db, user, tourCalendarPullMatch[1]) });
    }
    const tourMatch = path.match(/^\/tours\/([^/]+)$/);
    if (req.method === "PATCH" && tourMatch) {
      return sendJson(res, 200, { tour: await updateTourDetails(db, user, tourMatch[1], body) });
    }
    if (req.method === "DELETE" && tourMatch) {
      return sendJson(res, 200, await hardDeleteTour(db, user, tourMatch[1], body));
    }

    const tourLinkMatch = path.match(/^\/tours\/([^/]+)\/public-link$/);
    if (req.method === "GET" && tourLinkMatch) {
      return sendJson(res, 200, await getTourPublicLink(db, user, tourLinkMatch[1]));
    }

    if (req.method === "POST" && path === "/follow-ups") {
      return sendJson(res, 201, { followUp: await createFollowUp(db, user, body) });
    }

    const followUpStatusMatch = path.match(/^\/follow-ups\/([^/]+)\/status$/);
    if (req.method === "PATCH" && followUpStatusMatch) {
      return sendJson(res, 200, { followUp: await updateFollowUpStatus(db, user, followUpStatusMatch[1], clean(body.status)) });
    }
    const followUpMatch = path.match(/^\/follow-ups\/([^/]+)$/);
    if (req.method === "DELETE" && followUpMatch) {
      return sendJson(res, 200, await hardDeleteFollowUp(db, user, followUpMatch[1], body));
    }

    if (req.method === "POST" && path === "/tasks") {
      return sendJson(res, 201, { task: await createTask(db, user, body) });
    }

    const taskStatusMatch = path.match(/^\/tasks\/([^/]+)\/status$/);
    if (req.method === "PATCH" && taskStatusMatch) {
      return sendJson(res, 200, { task: await updateTaskStatus(db, user, taskStatusMatch[1], clean(body.status)) });
    }
    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (req.method === "DELETE" && taskMatch) {
      return sendJson(res, 200, await hardDeleteTask(db, user, taskMatch[1], body));
    }

    if (req.method === "GET" && path === "/operating-plan") {
      return sendJson(res, 200, await getDailyOperatingPlan(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    const operatingPlanMatch = path.match(/^\/operating-plan\/([^/]+)$/);
    if (req.method === "PATCH" && operatingPlanMatch) {
      return sendJson(res, 200, { item: await updateOperatingPlanItem(db, user, operatingPlanMatch[1], body) });
    }

    if (req.method === "GET" && path === "/operations") {
      return sendJson(res, 200, await listOperations(db, user, locationId));
    }

    if (req.method === "GET" && path === "/rooms") {
      return sendJson(res, 200, { rooms: await listRooms(db, user, Object.fromEntries(url.searchParams.entries())) });
    }

    if (req.method === "GET" && path === "/rooms/availability") {
      return sendJson(res, 200, await getRoomAvailability(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "GET" && path === "/room-matches") {
      return sendJson(res, 200, await getRoomMatches(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "GET" && path === "/revenue-command") {
      return sendJson(res, 200, await getRevenueCommand(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "POST" && path === "/rooms") {
      return sendJson(res, 201, { room: await createRoom(db, user, body) });
    }

    const roomMatch = path.match(/^\/rooms\/([^/]+)$/);
    if (req.method === "GET" && roomMatch) {
      return sendJson(res, 200, await getRoomDetail(db, user, roomMatch[1]));
    }
    if (req.method === "PATCH" && roomMatch) {
      return sendJson(res, 200, { room: await updateRoom(db, user, roomMatch[1], body) });
    }
    if (req.method === "DELETE" && roomMatch) {
      if (body.permanent === true || body.permanent === "true") return sendJson(res, 200, await hardDeleteRoom(db, user, roomMatch[1], body));
      return sendJson(res, 200, { room: await archiveRoom(db, user, roomMatch[1], body) });
    }

    if (req.method === "GET" && path === "/check-ins") {
      return sendJson(res, 200, { checkIns: await listCheckIns(db, user, locationId) });
    }

    if (req.method === "POST" && path === "/residents") {
      return sendJson(res, 201, { resident: await createResident(db, user, body) });
    }

    if (req.method === "GET" && path === "/workflows") {
      return sendJson(res, 200, await listWorkflows(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "GET" && path === "/escalations") {
      return sendJson(res, 200, await getEscalationSummary(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    if (req.method === "GET" && path === "/placement-desk") {
      return sendJson(res, 200, await getPlacementDesk(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    const workflowStepMatch = path.match(/^\/workflows\/steps\/([^/]+)$/);
    if (req.method === "PATCH" && workflowStepMatch) {
      return sendJson(res, 200, { step: await updateWorkflowStep(db, user, workflowStepMatch[1], body) });
    }

    const residentStatusMatch = path.match(/^\/residents\/([^/]+)\/status$/);
    if (req.method === "PATCH" && residentStatusMatch) {
      return sendJson(res, 200, { resident: await updateResidentStatus(db, user, residentStatusMatch[1], body) });
    }
    const residentMatch = path.match(/^\/residents\/([^/]+)$/);
    if (req.method === "DELETE" && residentMatch) {
      return sendJson(res, 200, await hardDeleteResident(db, user, residentMatch[1], body));
    }

    if (req.method === "POST" && path === "/notes") {
      return sendJson(res, 201, { note: await createNote(db, user, body) });
    }

    if (req.method === "POST" && path === "/documents/upload-url") {
      return sendJson(res, 201, await createSignedUpload(db, user, body));
    }

    if (req.method === "POST" && path === "/documents") {
      return sendJson(res, 201, { document: await createDocumentRecord(db, user, body) });
    }

    const docUrlMatch = path.match(/^\/documents\/([^/]+)\/signed-url$/);
    if (req.method === "GET" && docUrlMatch) {
      return sendJson(res, 200, await getSignedDocumentUrl(db, user, docUrlMatch[1]));
    }

    if (req.method === "GET" && path === "/users") {
      return sendJson(res, 200, { users: await listUsers(db, user) });
    }

    if (req.method === "POST" && path === "/users") {
      return sendJson(res, 201, { user: await createUserWithAccess(db, user, body) });
    }

    const userActiveMatch = path.match(/^\/users\/([^/]+)\/active$/);
    if (req.method === "PATCH" && userActiveMatch) {
      return sendJson(res, 200, { user: await setUserActive(db, user, userActiveMatch[1], body.active !== false) });
    }

    if (req.method === "POST" && path === "/migrate-legacy") {
      return sendJson(res, 200, await migrateLegacyData(db, user));
    }

    // ---------- Care Ops: Incidents ----------
    if (req.method === "GET" && path === "/care/incidents") {
      return sendJson(res, 200, await careOps.listIncidents(db, user, Object.fromEntries(url.searchParams.entries())));
    }
    if (req.method === "POST" && path === "/care/incidents") {
      return sendJson(res, 201, await careOps.createIncident(db, user, body));
    }
    const incidentMatch = path.match(/^\/care\/incidents\/([^/]+)$/);
    if (req.method === "PATCH" && incidentMatch) {
      return sendJson(res, 200, await careOps.updateIncident(db, user, incidentMatch[1], body));
    }
    if (req.method === "DELETE" && incidentMatch) {
      return sendJson(res, 200, await careOps.hardDeleteIncident(db, user, incidentMatch[1]));
    }

    // ---------- Care Ops: Handoffs ----------
    if (req.method === "GET" && path === "/care/handoffs") {
      return sendJson(res, 200, await careOps.listHandoffs(db, user, Object.fromEntries(url.searchParams.entries())));
    }
    if (req.method === "POST" && path === "/care/handoffs") {
      return sendJson(res, 201, await careOps.createHandoff(db, user, body));
    }
    const handoffAckMatch = path.match(/^\/care\/handoffs\/([^/]+)\/acknowledge$/);
    if (req.method === "POST" && handoffAckMatch) {
      return sendJson(res, 200, await careOps.acknowledgeHandoff(db, user, handoffAckMatch[1]));
    }
    const handoffMatch = path.match(/^\/care\/handoffs\/([^/]+)$/);
    if (req.method === "PATCH" && handoffMatch) {
      return sendJson(res, 200, await careOps.updateHandoff(db, user, handoffMatch[1], body));
    }
    if (req.method === "DELETE" && handoffMatch) {
      return sendJson(res, 200, await careOps.hardDeleteHandoff(db, user, handoffMatch[1]));
    }

    // ---------- Care Ops: Family updates ----------
    if (req.method === "GET" && path === "/care/family-updates") {
      return sendJson(res, 200, await careOps.listFamilyUpdates(db, user, Object.fromEntries(url.searchParams.entries())));
    }
    if (req.method === "POST" && path === "/care/family-updates") {
      return sendJson(res, 201, await careOps.sendFamilyUpdate(db, user, body));
    }
    const familyUpdateMatch = path.match(/^\/care\/family-updates\/([^/]+)$/);
    if (req.method === "DELETE" && familyUpdateMatch) {
      return sendJson(res, 200, await careOps.hardDeleteFamilyUpdate(db, user, familyUpdateMatch[1]));
    }

    // ---------- Care Ops: Schedule ----------
    if (req.method === "GET" && path === "/care/schedule") {
      return sendJson(res, 200, await careOps.getWeeklySchedule(db, user, Object.fromEntries(url.searchParams.entries())));
    }
    if (req.method === "POST" && path === "/care/schedule/shifts") {
      return sendJson(res, 201, await careOps.createShift(db, user, body));
    }
    const shiftMatch = path.match(/^\/care\/schedule\/shifts\/([^/]+)$/);
    if (req.method === "PATCH" && shiftMatch) {
      return sendJson(res, 200, await careOps.updateShift(db, user, shiftMatch[1], body));
    }
    if (req.method === "DELETE" && shiftMatch) {
      return sendJson(res, 200, await careOps.hardDeleteShift(db, user, shiftMatch[1]));
    }
    const shiftCancelMatch = path.match(/^\/care\/schedule\/shifts\/([^/]+)\/cancel$/);
    if (req.method === "POST" && shiftCancelMatch) {
      return sendJson(res, 200, await careOps.cancelShift(db, user, shiftCancelMatch[1]));
    }
    if (req.method === "POST" && path === "/care/schedule/publish") {
      return sendJson(res, 200, await careOps.publishWeek(db, user, body));
    }
    if (req.method === "POST" && path === "/care/schedule/swaps") {
      return sendJson(res, 201, await careOps.requestSwap(db, user, body));
    }
    const swapRespondMatch = path.match(/^\/care\/schedule\/swaps\/([^/]+)\/respond$/);
    if (req.method === "POST" && swapRespondMatch) {
      return sendJson(res, 200, await careOps.respondToSwap(db, user, swapRespondMatch[1], body));
    }

    // ---------- Care Ops: Roster (for pickers) ----------
    if (req.method === "GET" && path === "/care/staff") {
      return sendJson(res, 200, await careOps.listLocationStaff(db, user, Object.fromEntries(url.searchParams.entries())));
    }

    return sendJson(res, 404, { error: "V2 route not found." });
  } catch (err) {
    console.error("api/v2", err);
    return sendJson(res, err.statusCode || 500, { error: err.message || "Something went wrong." });
  }
};

async function handleCronIntelligenceScan(req, res) {
  const expected = process.env.CRON_SECRET || "";
  const bearer = String(req.headers.authorization || req.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const headerSecret = String(req.headers["x-cron-secret"] || "");
  if (!expected) return sendJson(res, 503, { error: "CRON_SECRET is not configured." });
  if (bearer !== expected && headerSecret !== expected) return sendJson(res, 401, { error: "Unauthorized cron request." });
  const systemUser = {
    id: null,
    email: "system@comfortcarecrm.com",
    role: "super_admin",
    isSuperAdmin: true,
    locations: [],
    profile: { full_name: "Operational Intelligence Engine", role: "super_admin" }
  };
  const db = getClient();
  return sendJson(res, 200, await runIntelligenceScan(db, systemUser, "", "vercel-cron"));
}

async function handlePublicIntake(req, res) {
  const db = getClient();
  const body = await readBody(req);
  const locationSlug = clean(body.locationSlug || body.location_slug || body.location || "");
  const { data: locations, error: locationError } = await db
    .from("locations")
    .select("id, name, slug")
    .or(`slug.eq.${locationSlug},name.eq.${locationSlug}`)
    .eq("active", true)
    .limit(1);
  if (locationError) throw locationError;
  const location = locations?.[0];
  if (!location) {
    const error = new Error("Choose a valid location.");
    error.statusCode = 422;
    throw error;
  }

  const systemUser = {
    id: null,
    isSuperAdmin: true,
    locations: [],
    profile: { full_name: "Public Intake" },
    role: "public"
  };
  const result = await createLead(db, systemUser, {
    ...body,
    locationId: location.id,
    source: ["Website", "Tablet"].includes(clean(body.source)) ? clean(body.source) : "Website"
  });
  await db.from("intake_submissions").insert({
    location_id: location.id,
    lead_id: result.lead.id,
    source: clean(body.source || "Website"),
    payload: body,
    user_agent: clean(req.headers["user-agent"] || "")
  });
  return sendJson(res, 201, { ok: true, leadId: result.lead.id, duplicate: Boolean(result.duplicate) });
}

function getPath(req) {
  const raw = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
  if (raw) return `/${String(raw).replace(/^\/+/, "")}`.replace(/\/$/, "") || "/";
  const url = new URL(req.url || "/api/v2", "http://localhost");
  return url.pathname.replace(/^\/api\/v2/, "") || "/";
}

function getLoginClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase auth config is missing.");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
