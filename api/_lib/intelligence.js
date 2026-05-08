const crypto = require("crypto");
const { clean } = require("./helpers");
const { assertLocationAccess } = require("./v2-auth");

const ACTIVE_EVENT_STATUSES = ["active", "acknowledged"];
const EVENT_STATUS = new Set(["active", "acknowledged", "resolved"]);

function isMissingTable(error) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`.toLowerCase();
  return text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find") || error?.code === "42P01";
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function hoursBetween(a, b = new Date()) {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return (end - start) / 36e5;
}

function daysBetween(a, b = new Date()) {
  return hoursBetween(a, b) / 24;
}

function addHours(hours) {
  return new Date(Date.now() + hours * 36e5).toISOString();
}

function hashInput(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizePhone(value) {
  return clean(value).replace(/\D/g, "");
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function estimateLeadScore(lead = {}) {
  if (Number.isFinite(Number(lead.score))) return Number(lead.score);
  if (Number.isFinite(Number(lead.lead_score))) return Number(lead.lead_score);

  const text = [
    lead.notes,
    lead.current_situation,
    lead.move_timeline,
    lead.payment_type,
    lead.care_type,
    lead.priority_tags,
    lead.status,
    lead.source
  ].join(" ").toLowerCase();

  let score = 0;
  if (text.includes("urgent") || text.includes("asap") || text.includes("immediate")) score += 32;
  if (text.includes("within 30") || text.includes("30 days")) score += 24;
  if (text.includes("30-60") || text.includes("60 days")) score += 14;
  if (text.includes("memory")) score += 15;
  if (text.includes("tour") || text.includes("visit")) score += 16;
  if (text.includes("pricing") || text.includes("cost") || text.includes("rate")) score += 10;
  if (text.includes("hospital") || text.includes("discharge") || text.includes("unsafe") || text.includes("wandering")) score += 18;
  if (clean(lead.source).toLowerCase() === "tablet") score += 8;
  if (lead.phone) score += 6;
  if (lead.email) score += 4;
  if (lead.status === "tour_scheduled") score += 24;
  if (lead.status === "move_in") score += 32;
  if (lead.status === "archived") score = Math.min(score, 20);
  return Math.max(0, Math.min(100, score));
}

function leadTemperature(score) {
  if (score >= 70) return "hot";
  if (score >= 35) return "warm";
  return "cold";
}

function displayLocationName(locationsById, locationId) {
  return locationsById.get(locationId)?.name || "This location";
}

function relativeTime(value, base = new Date()) {
  if (!value) return "";
  const then = new Date(value).getTime();
  const now = new Date(base).getTime();
  if (!Number.isFinite(then) || !Number.isFinite(now)) return "";
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function recentWithin(value, days = 7) {
  if (!value) return false;
  return daysBetween(value) <= days;
}

function durationText(hours) {
  const value = Math.max(0, Number(hours) || 0);
  if (value < 1) return `${Math.max(1, Math.round(value * 60))}m`;
  if (value < 24) {
    const whole = Math.floor(value);
    const minutes = Math.round((value - whole) * 60);
    return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
  }
  const days = Math.floor(value / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function activityMatches(row, patterns = []) {
  const text = [
    row.action,
    row.detail,
    row.metadata?.detail,
    row.metadata?.status,
    row.metadata?.new_status,
    row.metadata?.subject
  ].join(" ").toLowerCase();
  return patterns.some((pattern) => pattern.test(text));
}

function confidenceForType(type, metadata = {}) {
  if (["follow_up_overdue", "high_intent_lead_uncontacted", "tour_no_show_risk"].includes(type)) return "high";
  if (type === "occupancy_warning" && Number(metadata.capacity || 0) > 0) return "high";
  if (["lead_stale", "response_time_decline", "recovery_opportunity_detected", "inactive_pipeline_segment"].includes(type)) return "medium";
  return "low";
}

function actionForType(type) {
  return {
    follow_up_overdue: "open_queue",
    high_intent_lead_uncontacted: "contact_lead",
    lead_stale: "generate_recovery",
    recovery_opportunity_detected: "generate_recovery",
    tour_no_show_risk: "confirm_tour",
    inactive_pipeline_segment: "open_queue",
    response_time_decline: "view_details",
    occupancy_warning: "escalate",
    conversion_drop_detected: "view_details",
    pipeline_shortfall_risk: "view_details"
  }[type] || "view_details";
}

function urgencyForEvent(type, severity, metadata = {}) {
  if (severity === "critical") return "now";
  if (["follow_up_overdue", "high_intent_lead_uncontacted"].includes(type)) return "now";
  if (type === "tour_no_show_risk" && Number(metadata.hours_until_tour || 99) <= 12) return "now";
  if (severity === "high") return "soon";
  if (["lead_stale", "recovery_opportunity_detected", "tour_no_show_risk", "response_time_decline"].includes(type)) return "soon";
  return "watch";
}

function reasonForEvent(type, metadata = {}) {
  return {
    follow_up_overdue: `${metadata.count || 1} open follow-up${Number(metadata.count || 1) === 1 ? "" : "s"} past due.`,
    high_intent_lead_uncontacted: `Lead score is ${metadata.score || "high"} and status is still new.`,
    lead_stale: `No meaningful lead activity since ${relativeTime(metadata.last_touch_at)}.`,
    recovery_opportunity_detected: "Lead is warm or hot, stale, and still reachable.",
    tour_no_show_risk: `Tour is within ${metadata.hours_until_tour || 24}h with no recent confirmation.`,
    inactive_pipeline_segment: "Open leads exist but pipeline movement has stalled.",
    response_time_decline: `First-contact time moved from ${metadata.prior_hours || "prior"}h to ${metadata.current_hours || "current"}h.`,
    occupancy_warning: "Occupancy is below the configured target.",
    conversion_drop_detected: "Current conversion trend is weaker than the prior period.",
    pipeline_shortfall_risk: "No hot active leads or scheduled tours are available for the location."
  }[type] || "Rule-based operational signal detected.";
}

function conciseRecommendation(type) {
  return {
    follow_up_overdue: "Open overdue queue",
    high_intent_lead_uncontacted: "Call today and assign next follow-up",
    lead_stale: "Generate recovery outreach",
    recovery_opportunity_detected: "Generate recovery outreach",
    tour_no_show_risk: "Confirm tour and send directions",
    inactive_pipeline_segment: "Review location leads",
    response_time_decline: "Review response workflow",
    occupancy_warning: "Escalate to manager",
    conversion_drop_detected: "Review tour outcomes",
    pipeline_shortfall_risk: "Review pipeline sources"
  }[type] || "View details";
}

function resolvedSignal(type) {
  return {
    follow_up_overdue: "Follow-up overdue resolved",
    high_intent_lead_uncontacted: "Hot lead contacted",
    lead_stale: "Stale lead recovered",
    recovery_opportunity_detected: "Recovery opportunity addressed",
    tour_no_show_risk: "Tour risk resolved",
    inactive_pipeline_segment: "Pipeline movement restored",
    response_time_decline: "Response time recovered",
    occupancy_warning: "Occupancy risk resolved",
    conversion_drop_detected: "Conversion risk resolved",
    pipeline_shortfall_risk: "Pipeline shortfall resolved"
  }[type] || "Operational risk resolved";
}

function enrichEvent(event = {}) {
  const metadata = event.metadata || {};
  const type = event.event_type || event.type || "";
  const detectedAt = event.detected_at || event.created_at || nowIso();
  const ageHours = Number(hoursBetween(detectedAt).toFixed(2));
  const confidence = metadata.confidence || event.confidence || confidenceForType(type, metadata);
  const urgency = metadata.urgency || event.urgency || urgencyForEvent(type, event.severity, metadata);
  const recommendedActionType = metadata.recommended_action_type || event.recommended_action_type || actionForType(type);
  const lastActivityAt = metadata.last_touch_at || metadata.last_movement_at || metadata.scheduled_at || "";
  const enrichedMetadata = {
    ...metadata,
    confidence,
    urgency,
    reason: metadata.reason || reasonForEvent(type, metadata),
    time_context: metadata.time_context || `Detected ${relativeTime(detectedAt)}`,
    escalation_context: metadata.escalation_context || (ageHours >= 48 ? `Escalated after ${durationText(ageHours)} open` : ""),
    recommended_action_type: recommendedActionType,
    resolved_signal: metadata.resolved_signal || resolvedSignal(type)
  };
  return {
    ...event,
    confidence,
    urgency,
    reason: enrichedMetadata.reason,
    time_context: enrichedMetadata.time_context,
    escalation_context: enrichedMetadata.escalation_context,
    recommended_action_type: recommendedActionType,
    resolved_signal: enrichedMetadata.resolved_signal,
    detectedAgo: relativeTime(detectedAt),
    ageHours,
    lastActivityAgo: lastActivityAt ? relativeTime(lastActivityAt) : "",
    trendWindow: metadata.trend_window || "7 days",
    primaryActionLabel: conciseRecommendation(type),
    metadata: enrichedMetadata
  };
}

function buildEvent({ type, severity = "medium", locationId, title, description, recommendation, entityType = "location", entityId = null, metadata = {} }) {
  const dedupeKey = [type, locationId || "global", entityType || "location", entityId || "summary"].join(":");
  return enrichEvent({
    id: `transient:${hashInput(dedupeKey).slice(0, 16)}`,
    dedupe_key: dedupeKey,
    location_id: locationId,
    event_type: type,
    severity,
    status: "active",
    title,
    description,
    recommendation,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    detected_at: nowIso(),
    resolved_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    transient: true
  });
}

async function getAccessibleLocations(db, user, locationId = "") {
  if (locationId) assertLocationAccess(user, locationId);
  if (!user.isSuperAdmin) {
    const locations = (user.locations || []).filter((location) => !locationId || location.id === locationId);
    return locations.map((location) => ({
      id: location.id,
      name: location.name || "Assigned location",
      slug: location.slug || "",
      city: location.city || "",
      state: location.state || "",
      active: location.active !== false
    }));
  }
  let query = db.from("locations").select("id, name, slug, city, state, phone, active").eq("active", true).order("name");
  if (locationId) query = query.eq("id", locationId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function scopedQuery(query, locationIds) {
  if (!locationIds.length) return query.eq("location_id", "00000000-0000-0000-0000-000000000000");
  if (locationIds.length === 1) return query.eq("location_id", locationIds[0]);
  return query.in("location_id", locationIds);
}

async function safeSelect(query, fallback = []) {
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return fallback;
    throw error;
  }
  return data || fallback;
}

async function loadOperationalData(db, user, locationId = "") {
  const locations = await getAccessibleLocations(db, user, locationId);
  const locationIds = locations.map((location) => location.id);
  const [leads, tours, followUps, tasks, activityLogs, emails, occupancy] = await Promise.all([
    safeSelect(scopedQuery(db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(2000), locationIds)),
    safeSelect(scopedQuery(db.from("tours").select("*").order("scheduled_at", { ascending: true }).limit(2000), locationIds)),
    safeSelect(scopedQuery(db.from("follow_ups").select("*").order("due_at", { ascending: true }).limit(2000), locationIds)),
    safeSelect(scopedQuery(db.from("staff_tasks").select("*").order("due_at", { ascending: true }).limit(2000), locationIds)),
    safeSelect(scopedQuery(db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(4000), locationIds)),
    safeSelect(scopedQuery(db.from("email_history").select("*").order("created_at", { ascending: false }).limit(2000), locationIds)),
    safeSelect(scopedQuery(db.from("occupancy_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(500), locationIds))
  ]);
  return { locations, locationIds, leads, tours, followUps, tasks, activityLogs, emails, occupancy };
}

function groupBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = row[key] || "";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
    return map;
  }, new Map());
}

function latestDate(...values) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : "";
}

function firstContactAt(lead, activityRows, emailRows, tourRows) {
  const leadId = lead.id;
  const candidates = [
    ...activityRows
      .filter((row) => row.entity_type === "lead" && row.entity_id === leadId && /contact|email|tour|status/i.test(`${row.action || ""} ${row.metadata?.status || ""}`))
      .map((row) => row.created_at),
    ...emailRows.filter((row) => row.lead_id === leadId).map((row) => row.created_at),
    ...tourRows.filter((row) => row.lead_id === leadId).map((row) => row.created_at)
  ].filter(Boolean).sort();
  return candidates[0] || "";
}

function lastLeadTouchAt(lead, data) {
  const leadId = lead.id;
  const activity = data.activityLogs
    .filter((row) => row.entity_type === "lead" && row.entity_id === leadId)
    .map((row) => row.created_at);
  const emails = data.emails.filter((row) => row.lead_id === leadId).map((row) => row.created_at);
  const followUps = data.followUps.filter((row) => row.lead_id === leadId).map((row) => row.updated_at || row.created_at || row.due_at);
  const tours = data.tours.filter((row) => row.lead_id === leadId).map((row) => row.updated_at || row.created_at || row.scheduled_at);
  return latestDate(lead.updated_at, lead.created_at, ...activity, ...emails, ...followUps, ...tours);
}

function evaluateOperationalRules(data) {
  const events = [];
  const locationsById = new Map(data.locations.map((location) => [location.id, location]));
  const leadsByLocation = groupBy(data.leads, "location_id");
  const activeLeads = data.leads.filter((lead) => !["move_in", "archived"].includes(clean(lead.status)));
  const openFollowUps = data.followUps.filter((item) => !["completed", "archived"].includes(clean(item.status)));
  const now = new Date();

  for (const [locationId, followUps] of groupBy(openFollowUps.filter((item) => item.due_at && new Date(item.due_at) < now), "location_id")) {
    const locationName = displayLocationName(locationsById, locationId);
    events.push(buildEvent({
      type: "follow_up_overdue",
      severity: followUps.length >= 5 ? "high" : "medium",
      locationId,
      title: `${followUps.length} overdue follow-up${followUps.length === 1 ? "" : "s"}`,
      description: `${locationName} has follow-ups past their due time.`,
      recommendation: "Review the overdue queue and complete or reschedule each follow-up today.",
      metadata: { count: followUps.length, follow_up_ids: followUps.map((item) => item.id).slice(0, 25) }
    }));
  }

  for (const lead of activeLeads) {
    const score = estimateLeadScore(lead);
    const temperature = leadTemperature(score);
    const lastTouch = lastLeadTouchAt(lead, data);
    const staleDays = daysBetween(lastTouch || lead.created_at);
    const locationName = displayLocationName(locationsById, lead.location_id);
    if (staleDays >= 7) {
      events.push(buildEvent({
        type: "lead_stale",
        severity: temperature === "hot" ? "high" : "medium",
        locationId: lead.location_id,
        title: `${lead.full_name || lead.name || "Lead"} has gone stale`,
        description: `No meaningful activity has been recorded for ${Math.floor(staleDays)} days.`,
        recommendation: "Call or send a personal follow-up and record the next step.",
        entityType: "lead",
        entityId: lead.id,
        metadata: { lead_id: lead.id, score, temperature, last_touch_at: lastTouch, location_name: locationName }
      }));
    }
    if (score >= 70 && clean(lead.status) === "new" && hoursBetween(lead.created_at) >= 2) {
      events.push(buildEvent({
        type: "high_intent_lead_uncontacted",
        severity: "high",
        locationId: lead.location_id,
        title: `Hot lead still uncontacted`,
        description: `${lead.full_name || lead.name || "This lead"} looks high-intent but is still marked new.`,
        recommendation: "Contact this family now or assign the next follow-up before the lead cools down.",
        entityType: "lead",
        entityId: lead.id,
        metadata: { lead_id: lead.id, score, temperature, hours_open: Math.round(hoursBetween(lead.created_at)) }
      }));
    }
    if (staleDays >= 7 && score >= 35 && (lead.email || lead.phone)) {
      events.push(buildEvent({
        type: "recovery_opportunity_detected",
        severity: score >= 70 ? "high" : "medium",
        locationId: lead.location_id,
        title: `Recovery opportunity`,
        description: `${lead.full_name || lead.name || "A warm lead"} is stale but still reachable.`,
        recommendation: "Generate a recovery outreach draft or schedule a personal call.",
        entityType: "lead",
        entityId: lead.id,
        metadata: { lead_id: lead.id, score, temperature, email: Boolean(lead.email), phone: Boolean(lead.phone) }
      }));
    }
  }

  for (const tour of data.tours.filter((item) => clean(item.status) === "scheduled")) {
    const untilTour = hoursBetween(now, new Date(tour.scheduled_at));
    if (untilTour >= 0 && untilTour <= 24) {
      const confirmations = data.activityLogs.filter((row) => (
        row.location_id === tour.location_id &&
        ((row.entity_type === "tour" && row.entity_id === tour.id) || (row.entity_type === "lead" && row.entity_id === tour.lead_id)) &&
        /confirm|email|call|remind/i.test(`${row.action || ""} ${row.detail || ""} ${JSON.stringify(row.metadata || {})}`) &&
        hoursBetween(row.created_at) <= 48
      ));
      if (!confirmations.length) {
        events.push(buildEvent({
          type: "tour_no_show_risk",
          severity: "medium",
          locationId: tour.location_id,
          title: "Upcoming tour needs confirmation",
          description: `A tour is scheduled within 24 hours without recent confirmation activity.`,
          recommendation: "Confirm the tour time and send directions before the visit.",
          entityType: "tour",
          entityId: tour.id,
          metadata: { tour_id: tour.id, lead_id: tour.lead_id, scheduled_at: tour.scheduled_at, hours_until_tour: Math.round(untilTour) }
        }));
      }
    }
  }

  for (const location of data.locations) {
    const rows = leadsByLocation.get(location.id) || [];
    const activeRows = rows.filter((lead) => !["archived", "move_in"].includes(clean(lead.status)));
    const latestMovement = latestDate(
      ...activeRows.map((lead) => lead.updated_at || lead.created_at),
      ...data.activityLogs.filter((row) => row.location_id === location.id && /status|lead|tour|follow/i.test(row.action || "")).map((row) => row.created_at)
    );
    if (activeRows.length && (!latestMovement || daysBetween(latestMovement) >= 7)) {
      events.push(buildEvent({
        type: "inactive_pipeline_segment",
        severity: "medium",
        locationId: location.id,
        title: "Pipeline has not moved",
        description: `${location.name} has open leads but no pipeline movement in the last 7 days.`,
        recommendation: "Review open leads and assign next actions to prevent missed admissions opportunities.",
        metadata: { active_leads: activeRows.length, last_movement_at: latestMovement }
      }));
    }
  }

  const sevenDaysAgo = Date.now() - 7 * 864e5;
  const fourteenDaysAgo = Date.now() - 14 * 864e5;
  for (const location of data.locations) {
    const rows = (leadsByLocation.get(location.id) || []).filter((lead) => lead.created_at);
    const avgHours = (items) => {
      const durations = items
        .map((lead) => {
          const first = firstContactAt(lead, data.activityLogs, data.emails, data.tours);
          return first ? hoursBetween(lead.created_at, new Date(first)) : null;
        })
        .filter((value) => Number.isFinite(value));
      if (!durations.length) return null;
      return durations.reduce((sum, value) => sum + value, 0) / durations.length;
    };
    const current = avgHours(rows.filter((lead) => new Date(lead.created_at).getTime() >= sevenDaysAgo));
    const prior = avgHours(rows.filter((lead) => {
      const t = new Date(lead.created_at).getTime();
      return t >= fourteenDaysAgo && t < sevenDaysAgo;
    }));
    if (current !== null && prior !== null && current > Math.max(prior * 1.25, prior + 2) && current > 4) {
      events.push(buildEvent({
        type: "response_time_decline",
        severity: current > 12 ? "high" : "medium",
        locationId: location.id,
        title: "Response time is slipping",
        description: `Average first-contact time rose from ${prior.toFixed(1)}h to ${current.toFixed(1)}h.`,
        recommendation: "Prioritize new lead callbacks and check whether follow-up ownership is clear.",
        metadata: { current_hours: Number(current.toFixed(2)), prior_hours: Number(prior.toFixed(2)) }
      }));
    }
  }

  for (const [locationId, snapshots] of groupBy(data.occupancy, "location_id")) {
    const latest = snapshots.sort((a, b) => new Date(b.snapshot_date || b.created_at) - new Date(a.snapshot_date || a.created_at))[0];
    const capacity = Number(latest?.capacity || 0);
    const occupied = Number(latest?.occupied_count || 0);
    if (capacity > 0) {
      const occupancyRate = occupied / capacity;
      const target = Number(latest?.metadata?.target_occupancy || 0.85);
      if (occupancyRate < target) {
        events.push(buildEvent({
          type: "occupancy_warning",
          severity: occupancyRate < target - 0.1 ? "high" : "medium",
          locationId,
          title: "Occupancy below target",
          description: `${displayLocationName(locationsById, locationId)} is at ${Math.round(occupancyRate * 100)}% occupancy.`,
          recommendation: "Review tour pipeline and recovery opportunities for this location.",
          metadata: { occupied_count: occupied, capacity, occupancy_rate: occupancyRate, target }
        }));
      }
    }
  }

  events.push(...evaluatePredictiveRules(data, locationsById));
  return dedupeEvents(events);
}

function evaluatePredictiveRules(data, locationsById) {
  const events = [];
  const byLocation = groupBy(data.leads, "location_id");
  const now = Date.now();
  const seven = 7 * 864e5;
  const fourteen = 14 * 864e5;
  for (const [locationId, leads] of byLocation) {
    const current = leads.filter((lead) => new Date(lead.created_at).getTime() >= now - seven);
    const prior = leads.filter((lead) => {
      const t = new Date(lead.created_at).getTime();
      return t >= now - fourteen && t < now - seven;
    });
    const currentMoveIns = current.filter((lead) => lead.status === "move_in").length;
    const priorMoveIns = prior.filter((lead) => lead.status === "move_in").length;
    const currentRate = current.length ? currentMoveIns / current.length : 0;
    const priorRate = prior.length ? priorMoveIns / prior.length : 0;
    if (prior.length >= 3 && priorRate > 0 && current.length >= 3 && priorRate - currentRate >= 0.1) {
      events.push(buildEvent({
        type: "conversion_drop_detected",
        severity: "medium",
        locationId,
        title: "Conversion rate dropped",
        description: `${displayLocationName(locationsById, locationId)} conversion is down compared with the prior week.`,
        recommendation: "Review recent tour outcomes and stalled follow-ups for this location.",
        metadata: { current_rate: currentRate, prior_rate: priorRate }
      }));
    }
    const hotActive = leads.filter((lead) => !["move_in", "archived"].includes(lead.status) && estimateLeadScore(lead) >= 70).length;
    const tours = data.tours.filter((tour) => tour.location_id === locationId && tour.status === "scheduled").length;
    if (leads.length >= 3 && hotActive + tours === 0) {
      events.push(buildEvent({
        type: "pipeline_shortfall_risk",
        severity: "medium",
        locationId,
        title: "Pipeline shortfall risk",
        description: `${displayLocationName(locationsById, locationId)} has no hot active leads or scheduled tours.`,
        recommendation: "Use outreach and source review to rebuild the near-term move-in pipeline.",
        metadata: { active_hot_leads: hotActive, scheduled_tours: tours }
      }));
    }
  }
  return events;
}

function dedupeEvents(events) {
  const map = new Map();
  for (const event of events) map.set(event.dedupe_key, event);
  return [...map.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || new Date(b.detected_at) - new Date(a.detected_at));
}

function severityRank(value) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[value] || 0;
}

function buildPriorityQueues(data, events) {
  const leadById = new Map(data.leads.map((lead) => [lead.id, lead]));
  const overdueFollowUps = data.followUps
    .filter((item) => !["completed", "archived"].includes(item.status) && item.due_at && new Date(item.due_at) < new Date())
    .slice(0, 8);
  const hotUncontacted = events
    .filter((event) => event.event_type === "high_intent_lead_uncontacted")
    .map((event) => ({ ...event, lead: leadById.get(event.entity_id) }))
    .slice(0, 8);
  const staleRecovery = events
    .filter((event) => event.event_type === "recovery_opportunity_detected")
    .map((event) => ({ ...event, lead: leadById.get(event.entity_id) }))
    .slice(0, 8);
  const tourRisks = events.filter((event) => event.event_type === "tour_no_show_risk").slice(0, 8);
  const inactivePipeline = events.filter((event) => event.event_type === "inactive_pipeline_segment").slice(0, 8);

  return {
    overdueFollowUps,
    hotUncontacted,
    staleRecovery,
    tourRisks,
    inactivePipeline
  };
}

function buildZones(events, predictive = {}) {
  const active = events.filter((event) => ACTIVE_EVENT_STATUSES.includes(event.status || "active"));
  const now = active
    .filter((event) => ["now", "soon"].includes(event.urgency) || ["critical", "high"].includes(event.severity))
    .slice(0, 3);
  const nowKeys = new Set(now.map((event) => event.dedupe_key || event.id));
  const watch = active
    .filter((event) => !nowKeys.has(event.dedupe_key || event.id))
    .filter((event) => event.urgency === "watch" || event.severity === "medium")
    .slice(0, 4);
  const healthSignals = [
    {
      id: "healthy:response",
      label: "Response time",
      status: predictive.responseHealth?.value === "Watch" ? "Watch" : "Healthy",
      detail: predictive.responseHealth?.detail || "No response decline detected."
    },
    {
      id: "healthy:occupancy",
      label: "Occupancy",
      status: Number(predictive.occupancyRisk?.value || 0) > 0 ? "Watch" : "Healthy",
      detail: predictive.occupancyRisk?.detail || "No occupancy warning in current scope."
    },
    {
      id: "healthy:tours",
      label: "Tour risk",
      status: active.some((event) => event.event_type === "tour_no_show_risk") ? "Watch" : "Healthy",
      detail: active.some((event) => event.event_type === "tour_no_show_risk") ? "Upcoming tours need confirmation." : "No near-term tour risk detected."
    }
  ];
  return {
    now,
    watch,
    healthy: healthSignals
  };
}

function pulseTitleForEvent(event) {
  return {
    follow_up_overdue: "Follow-up became overdue",
    high_intent_lead_uncontacted: "Hot lead needs contact",
    lead_stale: "Lead became stale",
    recovery_opportunity_detected: "Recovery opportunity detected",
    tour_no_show_risk: "Tour needs confirmation",
    inactive_pipeline_segment: "Pipeline movement stalled",
    response_time_decline: "Response time trend declined",
    occupancy_warning: "Occupancy risk detected",
    conversion_drop_detected: "Conversion drop detected",
    pipeline_shortfall_risk: "Pipeline shortfall detected"
  }[event.event_type] || event.title || "Operational signal detected";
}

function buildOperationalPulse(data, events) {
  const eventItems = events.slice(0, 10).map((event) => ({
    id: `event:${event.id}`,
    kind: "signal",
    title: event.status === "resolved" ? event.resolved_signal : pulseTitleForEvent(event),
    detail: event.title,
    severity: event.severity,
    confidence: event.confidence,
    location_id: event.location_id,
    created_at: event.updated_at || event.detected_at || event.created_at,
    ago: relativeTime(event.updated_at || event.detected_at || event.created_at)
  }));
  const activityItems = (data.activityLogs || [])
    .filter((row) => /tour|follow|email|recovery|status|lead/i.test(row.action || ""))
    .slice(0, 12)
    .map((row) => ({
      id: `activity:${row.id}`,
      kind: "activity",
      title: titleCaseAction(row.action || "Activity recorded"),
      detail: clean(row.detail || row.metadata?.detail || ""),
      severity: "low",
      confidence: "high",
      location_id: row.location_id,
      created_at: row.created_at,
      ago: relativeTime(row.created_at)
    }));
  const grouped = new Map();
  for (const item of [...eventItems, ...activityItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    const key = [item.kind, item.title, item.location_id, item.severity].join(":");
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (new Date(item.created_at) > new Date(existing.created_at)) {
        existing.created_at = item.created_at;
        existing.ago = item.ago;
      }
      continue;
    }
    grouped.set(key, { ...item, count: 1 });
  }
  return [...grouped.values()]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 12);
}

function titleCaseAction(action = "") {
  return clean(action).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildDeterministicSummary(data, events) {
  const active = events.filter((event) => ACTIVE_EVENT_STATUSES.includes(event.status || "active"));
  const bySeverity = active.reduce((acc, event) => {
    acc[event.severity] = (acc[event.severity] || 0) + 1;
    return acc;
  }, {});
  const byType = active.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});
  const hotUncontacted = active.filter((event) => event.event_type === "high_intent_lead_uncontacted").length;
  const overdue = active.filter((event) => event.event_type === "follow_up_overdue").reduce((sum, event) => sum + Number(event.metadata?.count || 1), 0);
  const recovery = active.filter((event) => event.event_type === "recovery_opportunity_detected").length;
  const headline = active.length
    ? `${active.length} operational signal${active.length === 1 ? "" : "s"} need review`
    : "Operations are calm right now";
  const summary = active.length
    ? [
      hotUncontacted ? `${hotUncontacted} hot lead${hotUncontacted === 1 ? "" : "s"} need contact.` : "",
      overdue ? `${overdue} follow-up${overdue === 1 ? "" : "s"} are overdue.` : "",
      recovery ? `${recovery} recovery opportunit${recovery === 1 ? "y" : "ies"} found.` : ""
    ].filter(Boolean).join(" ")
    : "No stale, overdue, or high-risk workflow issues were detected in the current scope.";
  return {
    headline,
    summary,
    bySeverity,
    byType,
    totalActive: active.length,
    lastComputedAt: nowIso()
  };
}

function buildOutcomeFeedback(data, events) {
  const recentActivity = (data.activityLogs || []).filter((row) => recentWithin(row.created_at, 7));
  const resolvedSignals = events.filter((event) => event.status === "resolved" && recentWithin(event.resolved_at || event.updated_at, 7)).length;
  const recoveryActions = recentActivity.filter((row) => activityMatches(row, [/recovery/, /email sent/, /email_sent/, /outreach/])).length;
  const followUpsCompleted = recentActivity.filter((row) => activityMatches(row, [/follow.*complete/, /completed.*follow/, /follow_up_completed/])).length;
  const toursConfirmed = recentActivity.filter((row) => activityMatches(row, [/tour.*confirm/, /confirmed.*tour/])).length;
  const moveIns = recentActivity.filter((row) => activityMatches(row, [/move.?in/, /moved in/])).length;
  const outcomes = [
    resolvedSignals ? `${resolvedSignals} risk signal${resolvedSignals === 1 ? "" : "s"} resolved` : "",
    recoveryActions ? `${recoveryActions} recovery action${recoveryActions === 1 ? "" : "s"} completed` : "",
    followUpsCompleted ? `${followUpsCompleted} follow-up${followUpsCompleted === 1 ? "" : "s"} completed` : "",
    toursConfirmed ? `${toursConfirmed} tour${toursConfirmed === 1 ? "" : "s"} confirmed` : "",
    moveIns ? `${moveIns} move-in${moveIns === 1 ? "" : "s"} recorded` : ""
  ].filter(Boolean);
  return {
    label: outcomes.length ? "Operational progress" : "Stability watch",
    summary: outcomes.length ? outcomes.slice(0, 2).join(". ") : "No recent recovery outcomes logged yet.",
    outcomes,
    window: "Last 7 days"
  };
}

function buildOperationalStateBanner(data, events, queues, predictive) {
  const active = events.filter((event) => ACTIVE_EVENT_STATUSES.includes(event.status || "active"));
  const pressureLocations = new Set(active.filter((event) => ["critical", "high", "medium"].includes(event.severity)).map((event) => event.location_id).filter(Boolean));
  const totalLocations = Math.max(1, data.locations.length || data.locationIds.length || 1);
  const stableLocations = Math.max(0, totalLocations - pressureLocations.size);
  const high = active.filter((event) => ["critical", "high"].includes(event.severity)).length;
  const overdue = queues.overdueFollowUps?.length || 0;
  const recovery = queues.staleRecovery?.length || 0;
  const responseWatch = predictive.responseHealth?.value === "Watch";
  const pressureScore = high * 3 + overdue * 2 + recovery + (responseWatch ? 2 : 0);
  let state = "stable";
  let title = `Operations stable across ${stableLocations}/${totalLocations} locations`;
  let detail = "Admissions flow is calm. Keep planned follow-ups moving.";
  if (pressureScore >= 8) {
    state = "pressure";
    title = "Admissions pressure increasing";
    detail = "Several workflows need coordinated attention before families cool down.";
  } else if (high || overdue) {
    state = "recovery";
    title = "Recovery actions required";
    detail = "Prioritize the recommended sequence to stabilize follow-ups and lead response.";
  } else if (active.length || recovery || responseWatch) {
    state = "stabilizing";
    title = "Admissions flow stabilizing";
    detail = "No crisis, but a few signals need ownership today.";
  }
  return {
    state,
    title,
    detail,
    stableLocations,
    totalLocations,
    pressureScore,
    pressureLabel: pressureScore >= 8 ? "High pressure" : pressureScore >= 3 ? "Moderate pressure" : "Low pressure"
  };
}

function buildStructuredDigest(intelligence) {
  const events = intelligence.events || [];
  const queues = intelligence.queues || {};
  const zones = intelligence.zones || buildZones(events, intelligence.predictive || {});
  const focus = intelligence.operationalFocus || {};
  const overdueCount = queues.overdueFollowUps?.length || 0;
  const hotCount = queues.hotUncontacted?.length || 0;
  const recoveryCount = queues.staleRecovery?.length || 0;
  const tourRiskCount = queues.tourRisks?.length || 0;
  const responseHealthy = !events.some((event) => event.event_type === "response_time_decline");
  const occupancyHealthy = !events.some((event) => event.event_type === "occupancy_warning");
  const bullets = [
    overdueCount ? `${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"} require attention` : "",
    hotCount ? `${hotCount} hot lead${hotCount === 1 ? " remains" : "s remain"} uncontacted` : "",
    recoveryCount ? `${recoveryCount} stale lead${recoveryCount === 1 ? "" : "s"} can be recovered` : "",
    tourRiskCount ? `${tourRiskCount} tour${tourRiskCount === 1 ? " needs" : "s need"} confirmation` : "",
    responseHealthy ? "Response times remain healthy" : "Response-time trend needs review",
    occupancyHealthy ? "No occupancy risks detected" : "Occupancy risk is active"
  ].filter(Boolean).slice(0, 6);
  const primaryAction = overdueCount ? "Open overdue follow-ups"
    : hotCount ? "Contact hot leads"
    : recoveryCount ? "Generate recovery outreach"
    : tourRiskCount ? "Confirm upcoming tours"
    : focus.primaryAction?.actionLabel || "Review operational pulse";
  const sectionItem = (event) => ({
    id: event.id,
    title: event.title,
    detail: event.reason || event.description,
    action: event.primaryActionLabel || conciseRecommendation(event.event_type),
    actionType: event.recommended_action_type,
    severity: event.severity,
    confidence: event.confidence,
    timeContext: event.time_context
  });
  return {
    summary: {
      title: "Today's Operational Summary",
      bullets: bullets.length ? bullets : ["Operations are calm right now"],
      primaryAction,
      generatedAt: nowIso(),
      provider: "deterministic",
      cached: false,
      state: focus.state || "stable",
      mode: focus.mode || "Calm mode",
      whyThisMatters: focus.whyThisMatters || ""
    },
    sections: [
      { label: "Needs action now", severity: "high", items: zones.now.map(sectionItem) },
      { label: "Watch next", severity: "medium", items: zones.watch.map(sectionItem) },
      { label: "Healthy", severity: "low", items: (zones.healthy || []).map((item) => ({ title: item.label, detail: item.detail, action: item.status, severity: "low", confidence: "high" })) }
    ]
  };
}

function eventPriority(event = {}) {
  const typeWeight = {
    follow_up_overdue: 96,
    high_intent_lead_uncontacted: 94,
    tour_no_show_risk: 88,
    recovery_opportunity_detected: 78,
    lead_stale: 72,
    occupancy_warning: 70,
    response_time_decline: 66,
    inactive_pipeline_segment: 62,
    conversion_drop_detected: 58,
    pipeline_shortfall_risk: 54
  }[event.event_type] || 40;
  return typeWeight + severityRank(event.severity) * 4 + (event.urgency === "now" ? 10 : event.urgency === "soon" ? 5 : 0);
}

function actionCopyForEvent(event, leadById, locationsById) {
  const lead = leadById.get(event.entity_id) || {};
  const locationName = displayLocationName(locationsById, event.location_id);
  const leadName = lead.full_name || lead.name || event.title || "this lead";
  const count = Number(event.metadata?.count || 1);
  const copy = {
    follow_up_overdue: {
      title: `Work ${locationName} follow-ups first`,
      why: `${count} famil${count === 1 ? "y is" : "ies are"} waiting past the promised follow-up window.`,
      impact: "Fast follow-up protects tour conversion and keeps families from going cold.",
      actionLabel: "Open overdue queue",
      targetView: "followups"
    },
    high_intent_lead_uncontacted: {
      title: `Contact ${leadName}`,
      why: "This is a high-intent lead still marked new.",
      impact: "Early response has the highest chance of creating a tour.",
      actionLabel: "Open lead",
      targetView: "leads",
      leadId: event.entity_id
    },
    tour_no_show_risk: {
      title: `Confirm ${locationName} tour timing`,
      why: "A near-term tour has no recent confirmation activity.",
      impact: "A quick confirmation reduces no-show risk and improves the family experience.",
      actionLabel: "Open tours",
      targetView: "tours"
    },
    recovery_opportunity_detected: {
      title: `Recover ${leadName}`,
      why: "This lead is still reachable but has gone quiet.",
      impact: "A personal recovery touch can bring a warm family back into motion.",
      actionLabel: event.transient ? "Open lead" : "Generate recovery outreach",
      targetView: "leads",
      leadId: event.entity_id,
      eventId: event.id
    },
    lead_stale: {
      title: `Restart ${leadName}`,
      why: event.reason || "No meaningful activity has been recorded recently.",
      impact: "Stale leads need a clear next step before they disappear from the pipeline.",
      actionLabel: event.transient ? "Open lead" : "Generate recovery outreach",
      targetView: "leads",
      leadId: event.entity_id,
      eventId: event.id
    },
    occupancy_warning: {
      title: `Escalate ${locationName} occupancy risk`,
      why: "Occupancy is below the configured target.",
      impact: "Early escalation helps rebuild tours before occupancy pressure increases.",
      actionLabel: "Escalate",
      targetView: "reports",
      eventId: event.id
    },
    response_time_decline: {
      title: `Tighten ${locationName} response rhythm`,
      why: "First-contact timing is trending slower than the prior period.",
      impact: "Clear ownership prevents new inquiries from waiting too long.",
      actionLabel: "View details",
      targetView: "reports"
    },
    inactive_pipeline_segment: {
      title: `Move ${locationName} pipeline`,
      why: "Open leads exist but pipeline movement has stalled.",
      impact: "A focused review restores momentum and prevents missed admissions opportunities.",
      actionLabel: "Open leads",
      targetView: "leads"
    },
    conversion_drop_detected: {
      title: `Review ${locationName} conversion drop`,
      why: "Conversion is weaker than the prior period.",
      impact: "Finding the bottleneck early can protect month-end move-ins.",
      actionLabel: "View reports",
      targetView: "reports"
    },
    pipeline_shortfall_risk: {
      title: `Rebuild ${locationName} near-term pipeline`,
      why: "No hot active leads or scheduled tours are available.",
      impact: "The location needs new motion before future move-ins slow down.",
      actionLabel: "View reports",
      targetView: "reports"
    }
  }[event.event_type];
  return copy || {
    title: event.title || "Review operational signal",
    why: event.reason || event.description || "A workflow signal needs review.",
    impact: "Reviewing this keeps the admissions pipeline coordinated.",
    actionLabel: event.primaryActionLabel || "View details",
    targetView: "reports"
  };
}

function buildNextBestActions(data, events) {
  const leadById = new Map(data.leads.map((lead) => [lead.id, lead]));
  const locationsById = new Map(data.locations.map((location) => [location.id, location]));
  const active = events
    .filter((event) => ACTIVE_EVENT_STATUSES.includes(event.status || "active"))
    .sort((a, b) => eventPriority(b) - eventPriority(a));
  const seen = new Set();
  return active
    .map((event) => {
      const copy = actionCopyForEvent(event, leadById, locationsById);
      const key = [event.event_type, copy.targetView, copy.leadId || event.location_id].join(":");
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: `nba:${event.id}`,
        rank: seen.size,
        priority: eventPriority(event),
        state: event.urgency === "now" || event.severity === "high" ? "now" : "next",
        title: copy.title,
        why: copy.why,
        impact: copy.impact,
        actionLabel: copy.actionLabel,
        actionType: event.recommended_action_type,
        targetView: copy.targetView,
        leadId: copy.leadId || null,
        eventId: copy.eventId || (!event.transient ? event.id : null),
        locationId: event.location_id,
        severity: event.severity,
        confidence: event.confidence,
        timeContext: event.time_context,
        estimatedMinutes: event.event_type === "follow_up_overdue" ? 15 : event.event_type === "tour_no_show_risk" ? 5 : 10
      };
    })
    .filter(Boolean)
    .slice(0, 5)
    .map((action, index) => ({ ...action, rank: index + 1 }));
}

function buildOperationalFocus(data, events, queues, predictive) {
  const nextBestActions = buildNextBestActions(data, events);
  const high = events.filter((event) => ["critical", "high"].includes(event.severity)).length;
  const overdue = queues.overdueFollowUps?.length || 0;
  const hot = queues.hotUncontacted?.length || 0;
  const recovery = queues.staleRecovery?.length || 0;
  const tourRisks = queues.tourRisks?.length || 0;
  const activeSignals = events.filter((event) => ACTIVE_EVENT_STATUSES.includes(event.status || "active")).length;
  const state = high || overdue || hot ? "attention_required" : activeSignals ? "watching" : "stable";
  const title = state === "attention_required" ? "Attention required"
    : state === "watching" ? "Operations need light coordination"
    : "Operations are stable";
  const summary = state === "attention_required"
    ? [
      overdue ? `${overdue} follow-up${overdue === 1 ? " is" : "s are"} waiting.` : "",
      hot ? `${hot} high-intent lead${hot === 1 ? " needs" : "s need"} contact.` : "",
      tourRisks ? `${tourRisks} tour${tourRisks === 1 ? " needs" : "s need"} confirmation.` : ""
    ].filter(Boolean).join(" ")
    : state === "watching"
      ? "No crisis, but the pipeline has signals worth guiding today."
      : "No urgent admissions coordination issues are active right now.";
  const whyThisMatters = state === "attention_required"
    ? "Delayed follow-ups and unconfirmed tours reduce tour conversion probability."
    : state === "watching"
      ? "Small delays can become stale pipeline if no one owns the next step."
      : "Stable operations mean staff can keep working planned follow-ups without distraction.";
  const mode = state === "attention_required" ? "Focus mode"
    : recovery ? "Recovery mode"
    : predictive.responseHealth?.value === "Watch" ? "Rhythm watch"
    : "Calm mode";
  const progress = buildOutcomeFeedback(data, events);
  const progressSteps = [
    {
      label: overdue ? "Follow-up queue active" : "Follow-up queue clear",
      state: overdue ? "active" : "complete",
      detail: overdue ? `${overdue} overdue item${overdue === 1 ? "" : "s"} still need ownership.` : "No overdue follow-ups in the current scope."
    },
    {
      label: recovery ? "Recovery in progress" : "Pipeline stabilized",
      state: recovery ? "active" : "complete",
      detail: recovery ? `${recovery} stale lead${recovery === 1 ? "" : "s"} can still be recovered.` : "No stale recovery queue is active."
    },
    {
      label: tourRisks ? "Tour confirmation needed" : "Tour risk clear",
      state: tourRisks ? "active" : "complete",
      detail: tourRisks ? `${tourRisks} upcoming tour${tourRisks === 1 ? "" : "s"} need confirmation.` : "No near-term tour risk detected."
    }
  ];
  return {
    state,
    mode,
    title,
    summary,
    whyThisMatters,
    focusWindow: state === "attention_required" ? "Next 60 minutes" : "Today",
    primaryAction: nextBestActions[0] || null,
    recommendedSequence: nextBestActions,
    operationalTone: state === "stable" ? "calm" : state === "attention_required" ? "focused" : "measured",
    momentum: {
      label: predictive.responseHealth?.value === "Watch" ? "Momentum slowing" : "Momentum stable",
      detail: predictive.responseHealth?.detail || "No response decline detected."
    },
    progress,
    progressSteps
  };
}

function buildPredictiveCards(data, events) {
  const active = data.leads.filter((lead) => !["archived", "move_in"].includes(lead.status));
  const hot = active.filter((lead) => estimateLeadScore(lead) >= 70).length;
  const scheduledTours = data.tours.filter((tour) => tour.status === "scheduled").length;
  const projectedMoveIns = Math.max(0, Math.round(hot * 0.25 + scheduledTours * 0.35));
  const bottleneckEvents = events.filter((event) => ["follow_up_overdue", "inactive_pipeline_segment", "response_time_decline"].includes(event.event_type));
  const responseEvents = events.filter((event) => event.event_type === "response_time_decline");
  const occupancyEvents = events.filter((event) => event.event_type === "occupancy_warning");
  const sourceCounts = data.leads.reduce((acc, lead) => {
    const source = clean(lead.source || "Unknown");
    if (!acc[source]) acc[source] = { leads: 0, moveIns: 0 };
    acc[source].leads += 1;
    if (lead.status === "move_in") acc[source].moveIns += 1;
    return acc;
  }, {});
  const bestSource = Object.entries(sourceCounts)
    .sort((a, b) => (b[1].moveIns / Math.max(1, b[1].leads)) - (a[1].moveIns / Math.max(1, a[1].leads)))[0];
  return {
    projectedMoveIns: {
      label: "Projected move-ins",
      value: `${projectedMoveIns}`,
      detail: "Rule-based estimate from hot leads and scheduled tours."
    },
    bottlenecks: {
      label: "Location bottlenecks",
      value: `${bottleneckEvents.length}`,
      detail: bottleneckEvents.length ? "Follow-up or pipeline attention needed." : "No major bottlenecks detected."
    },
    responseHealth: {
      label: "Response time health",
      value: responseEvents.length ? "Watch" : "Healthy",
      detail: responseEvents.length ? "One or more locations are slowing down." : "No response decline detected."
    },
    occupancyRisk: {
      label: "Occupancy risk",
      value: occupancyEvents.length ? `${occupancyEvents.length}` : "0",
      detail: occupancyEvents.length ? "Occupancy alerts are active." : "No occupancy warning in current scope."
    },
    sourceQuality: {
      label: "Source quality",
      value: bestSource?.[0] || "Not enough data",
      detail: bestSource ? `${bestSource[1].moveIns}/${bestSource[1].leads} moved in from this source.` : "Lead sources need more activity."
    }
  };
}

async function listIntelligence(db, user, locationId = "") {
  const data = await loadOperationalData(db, user, locationId);
  const computedEvents = evaluateOperationalRules(data).map(enrichEvent);
  let events = computedEvents;
  let lastRun = null;
  let mode = "live-preview";
  try {
    const query = scopedQuery(
      db.from("operational_events").select("*").in("status", ACTIVE_EVENT_STATUSES).order("detected_at", { ascending: false }).limit(100),
      data.locationIds
    );
    const { data: persisted, error } = await query;
    if (error) throw error;
    if (persisted?.length) {
      events = persisted.map(enrichEvent);
      mode = "persisted";
    }
    const { data: runs, error: runError } = await db.from("operational_event_runs").select("*").order("started_at", { ascending: false }).limit(1);
    if (runError) throw runError;
    lastRun = runs?.[0] || null;
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    mode = "live-preview";
  }
  const queues = buildPriorityQueues(data, events);
  const predictive = buildPredictiveCards(data, events);
  const zones = buildZones(events, predictive);
  const operationalFocus = buildOperationalFocus(data, events, queues, predictive);
  const stateBanner = buildOperationalStateBanner(data, events, queues, predictive);
  const outcomeFeedback = operationalFocus.progress || buildOutcomeFeedback(data, events);
  return {
    mode,
    events,
    counts: buildDeterministicSummary(data, events),
    queues,
    predictive,
    zones,
    nextBestActions: operationalFocus.recommendedSequence,
    operationalFocus,
    stateBanner,
    outcomeFeedback,
    operationalPulse: buildOperationalPulse(data, events),
    lastRun
  };
}

async function runIntelligenceScan(db, user, locationId = "", source = "manual") {
  const startedAt = new Date();
  const data = await loadOperationalData(db, user, locationId);
  const events = evaluateOperationalRules(data).map(enrichEvent);
  const run = {
    started_at: startedAt.toISOString(),
    finished_at: nowIso(),
    status: "completed",
    scanned_location_ids: data.locationIds,
    events_detected: events.length,
    events_resolved: 0,
    errors: "",
    metadata: { source }
  };
  try {
    const payload = events.map((event) => ({
      dedupe_key: event.dedupe_key,
      location_id: event.location_id,
      event_type: event.event_type,
      severity: event.severity,
      status: "active",
      title: event.title,
      description: event.description,
      recommendation: event.recommendation,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      metadata: {
        ...(event.metadata || {}),
        confidence: event.confidence,
        urgency: event.urgency,
        reason: event.reason,
        time_context: event.time_context,
        escalation_context: event.escalation_context,
        recommended_action_type: event.recommended_action_type,
        resolved_signal: event.resolved_signal
      },
      detected_at: event.detected_at,
      resolved_at: null,
      updated_at: nowIso()
    }));
    if (payload.length) {
      const { error } = await db.from("operational_events").upsert(payload, { onConflict: "dedupe_key" });
      if (error) throw error;
    }
    const { data: activeRows, error: activeError } = await scopedQuery(
      db.from("operational_events").select("id, dedupe_key").in("status", ACTIVE_EVENT_STATUSES),
      data.locationIds
    );
    if (activeError) throw activeError;
    const currentKeys = new Set(events.map((event) => event.dedupe_key));
    const toResolve = (activeRows || []).filter((row) => !currentKeys.has(row.dedupe_key));
    for (const row of toResolve) {
      const { error } = await db.from("operational_events").update({ status: "resolved", resolved_at: nowIso(), updated_at: nowIso() }).eq("id", row.id);
      if (error) throw error;
    }
    run.events_resolved = toResolve.length;
    const { error: runError } = await db.from("operational_event_runs").insert(run);
    if (runError) throw runError;
    return { ok: true, mode: "persisted", ...run };
  } catch (error) {
    if (isMissingTable(error)) {
      return { ok: true, mode: "live-preview", warning: "Run the operational intelligence SQL migration to persist events.", ...run };
    }
    try {
      await db.from("operational_event_runs").insert({ ...run, status: "failed", errors: error.message || "Scan failed" });
    } catch (_) {}
    throw error;
  }
}

async function updateOperationalEventStatus(db, user, eventId, status) {
  const normalized = clean(status).toLowerCase();
  if (!EVENT_STATUS.has(normalized)) throw httpError("Invalid event status.", 422);
  const { data: existing, error: findError } = await db.from("operational_events").select("*").eq("id", eventId).single();
  if (findError) throw findError;
  assertLocationAccess(user, existing.location_id);
  const patch = {
    status: normalized,
    resolved_at: normalized === "resolved" ? nowIso() : null,
    updated_at: nowIso()
  };
  const { data, error } = await db.from("operational_events").update(patch).eq("id", eventId).select("*").single();
  if (error) throw error;
  await logActivity(db, {
    locationId: existing.location_id,
    actorId: user.id,
    entityType: "operational_event",
    entityId: existing.id,
    action: `operational_event_${normalized}`,
    metadata: {
      event_type: existing.event_type,
      title: existing.title,
      status: normalized,
      resolved_signal: existing.metadata?.resolved_signal || resolvedSignal(existing.event_type)
    }
  });
  return enrichEvent(data);
}

async function getPriorityQueues(db, user, locationId = "") {
  const data = await loadOperationalData(db, user, locationId);
  const events = evaluateOperationalRules(data).map(enrichEvent);
  return { queues: buildPriorityQueues(data, events), counts: buildDeterministicSummary(data, events) };
}

async function getCache(db, cacheKey, inputHash) {
  try {
    const { data, error } = await db
      .from("ai_summary_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .eq("input_hash", inputHash)
      .gt("expires_at", nowIso())
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

async function setCache(db, record) {
  try {
    await db.from("ai_summary_cache").upsert(record, { onConflict: "cache_key" });
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
}

async function logActivity(db, { locationId, actorId, entityType, entityId, action, metadata = {} }) {
  try {
    await db.from("activity_logs").insert({
      location_id: locationId,
      actor_id: actorId || null,
      created_by: actorId || null,
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      metadata
    });
  } catch (error) {
    if (!isMissingTable(error)) console.error("activity log failed", error.message || error);
  }
}

async function generateWithAI(prompt, options = {}) {
  const providerOrder = [
    process.env.AI_PROVIDER || "gemini",
    "gemini",
    "openai",
    "anthropic",
    "ollama"
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
  const maxTokens = options.maxTokens || 500;
  const temperature = options.temperature ?? 0.25;
  const errors = [];

  for (const provider of providerOrder) {
    try {
      if (provider === "gemini" && process.env.GEMINI_API_KEY) {
        const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens }
          })
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message || "Gemini request failed.");
        const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim();
        if (text) return { text, provider, model };
      }
      if (provider === "openai" && process.env.OPENAI_API_KEY) {
        const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message || "OpenAI-compatible request failed.");
        const text = json.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider, model };
      }
      if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
        const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message || "Anthropic request failed.");
        const text = json.content?.map((part) => part.text).join("").trim();
        if (text) return { text, provider, model };
      }
      if (provider === "ollama" && process.env.OLLAMA_BASE_URL) {
        const model = process.env.OLLAMA_MODEL || "llama3.1";
        const response = await fetch(`${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false, options: { temperature } })
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Ollama request failed.");
        const text = clean(json.response || "");
        if (text) return { text, provider, model };
      }
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }
  return { text: "", provider: "deterministic", model: "fallback", errors };
}

async function generateIntelligenceDigest(db, user, locationId = "") {
  const intelligence = await listIntelligence(db, user, locationId);
  const deterministicDigest = buildStructuredDigest(intelligence);
  const input = {
    events: intelligence.events.slice(0, 20).map((event) => ({
      type: event.event_type,
      severity: event.severity,
      confidence: event.confidence,
      urgency: event.urgency,
      title: event.title,
      description: event.description,
      recommendation: event.recommendation,
      timeContext: event.time_context
    })),
    counts: intelligence.counts,
    queues: Object.fromEntries(Object.entries(intelligence.queues || {}).map(([key, rows]) => [key, rows.length])),
    predictive: intelligence.predictive,
    deterministicDigest
  };
  const inputHash = hashInput(input);
  const cacheKey = `intelligence-digest:${locationId || "all"}:${inputHash.slice(0, 12)}`;
  const cached = await getCache(db, cacheKey, inputHash);
  if (cached) {
    const parsed = parseJsonDigest(cached.summary) || deterministicDigest;
    parsed.summary.provider = cached.provider;
    parsed.summary.cached = true;
    return { ...parsed, digest: digestText(parsed), digestText: digestText(parsed), cached: true, provider: cached.provider, model: cached.model };
  }
  const prompt = `You are improving a senior living admissions operations digest. Return ONLY valid JSON with the same shape as deterministicDigest. Do not invent counts. Keep bullets short, calm, and operational. Preserve action labels and section labels. Facts:\n\n${JSON.stringify(input, null, 2)}`;
  const ai = await generateWithAI(prompt, { maxTokens: 700, temperature: 0.15 });
  const aiDigest = parseJsonDigest(ai.text);
  const structured = aiDigest || deterministicDigest;
  structured.summary = {
    ...structured.summary,
    generatedAt: nowIso(),
    provider: aiDigest ? ai.provider : "deterministic",
    cached: false
  };
  await setCache(db, {
    cache_key: cacheKey,
    scope_type: "intelligence",
    scope_id: locationId || null,
    input_hash: inputHash,
    provider: structured.summary.provider,
    model: aiDigest ? ai.model : "fallback",
    summary: JSON.stringify(structured),
    expires_at: addHours(Number(process.env.AI_CACHE_TTL_HOURS || 24))
  });
  return { ...structured, digest: digestText(structured), digestText: digestText(structured), cached: false, provider: structured.summary.provider, model: aiDigest ? ai.model : "fallback" };
}

function parseJsonDigest(text) {
  if (!text) return null;
  const raw = String(text).trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.summary?.bullets || !Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch (_) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        if (parsed?.summary?.bullets && Array.isArray(parsed.sections)) return parsed;
      } catch (_) {}
    }
  }
  return null;
}

function digestText(digest) {
  const bullets = digest?.summary?.bullets || [];
  return `${digest?.summary?.title || "Today's Operational Summary"}\n${bullets.map((item) => `- ${item}`).join("\n")}`;
}

async function generateRecoveryDraft(db, user, eventId) {
  const { data: event, error } = await db.from("operational_events").select("*").eq("id", eventId).single();
  if (error) throw error;
  assertLocationAccess(user, event.location_id);
  if (event.entity_type !== "lead" || !event.entity_id) throw httpError("Recovery drafts are only available for lead events.", 422);
  const { data: lead, error: leadError } = await db.from("leads_v2").select("*").eq("id", event.entity_id).single();
  if (leadError) throw leadError;
  assertLocationAccess(user, lead.location_id);
  const input = { event, lead };
  const inputHash = hashInput(input);
  const cacheKey = `recovery-draft:${eventId}:${inputHash.slice(0, 12)}`;
  const cached = await getCache(db, cacheKey, inputHash);
  if (cached) {
    await logActivity(db, {
      locationId: lead.location_id,
      actorId: user.id,
      entityType: "lead",
      entityId: lead.id,
      action: "recovery_draft_generated",
      metadata: {
        event_id: eventId,
        event_type: event.event_type,
        provider: cached.provider,
        cached: true
      }
    });
    return { draft: cached.summary, cached: true, provider: cached.provider, model: cached.model };
  }
  const firstName = clean(lead.full_name || lead.name).split(" ")[0] || "there";
  const prompt = `Write a warm, short recovery outreach email draft for a senior living lead. Human staff will review before sending. Avoid pressure. Include a subject line as "Subject: ...". Facts:\n${JSON.stringify({ firstName, lead, event }, null, 2)}`;
  const ai = await generateWithAI(prompt, { maxTokens: 450 });
  const fallback = `Subject: Checking in from Comfort Care Senior Living\n\nHi ${firstName},\n\nI wanted to check in and see how your search for senior living support is going. If it would help, we can answer questions, talk through care options, or schedule a private tour at your convenience.\n\nWarmly,\nThe Comfort Care Team`;
  const draft = ai.text || fallback;
  await setCache(db, {
    cache_key: cacheKey,
    scope_type: "event",
    scope_id: eventId,
    input_hash: inputHash,
    provider: ai.provider,
    model: ai.model,
    summary: draft,
    expires_at: addHours(Number(process.env.AI_CACHE_TTL_HOURS || 24))
  });
  await logActivity(db, {
    locationId: lead.location_id,
    actorId: user.id,
    entityType: "lead",
    entityId: lead.id,
    action: "recovery_draft_generated",
    metadata: {
      event_id: eventId,
      event_type: event.event_type,
      provider: ai.provider,
      cached: false
    }
  });
  return { draft, cached: false, provider: ai.provider, model: ai.model };
}

async function generateLeadSummary(db, user, leadId) {
  const { data: lead, error } = await db.from("leads_v2").select("*").eq("id", leadId).single();
  if (error) throw error;
  assertLocationAccess(user, lead.location_id);
  const [activity, emails, followUps, tours] = await Promise.all([
    safeSelect(db.from("activity_logs").select("*").eq("entity_type", "lead").eq("entity_id", leadId).order("created_at", { ascending: false }).limit(25)),
    safeSelect(db.from("email_history").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10)),
    safeSelect(db.from("follow_ups").select("*").eq("lead_id", leadId).order("due_at", { ascending: false }).limit(10)),
    safeSelect(db.from("tours").select("*").eq("lead_id", leadId).order("scheduled_at", { ascending: false }).limit(10))
  ]);
  const input = { lead, activity, emails, followUps, tours };
  const inputHash = hashInput(input);
  const cacheKey = `lead-summary:${leadId}:${inputHash.slice(0, 12)}`;
  const cached = await getCache(db, cacheKey, inputHash);
  if (cached) return { summary: cached.summary, cached: true, provider: cached.provider, model: cached.model };
  const prompt = `Summarize this senior living lead for an admissions staff member. Use bullet points, include current need, urgency, next best action, and open risks. Do not invent facts.\n\n${JSON.stringify(input, null, 2)}`;
  const ai = await generateWithAI(prompt, { maxTokens: 450 });
  const score = estimateLeadScore(lead);
  const fallback = `${lead.full_name || lead.name || "This lead"} is a ${leadTemperature(score)} lead (${score}/100). Current status: ${lead.status}. Suggested next action: review notes and schedule the next follow-up.`;
  const summary = ai.text || fallback;
  await setCache(db, {
    cache_key: cacheKey,
    scope_type: "lead",
    scope_id: leadId,
    input_hash: inputHash,
    provider: ai.provider,
    model: ai.model,
    summary,
    expires_at: addHours(Number(process.env.AI_CACHE_TTL_HOURS || 24))
  });
  return { summary, cached: false, provider: ai.provider, model: ai.model };
}

module.exports = {
  listIntelligence,
  runIntelligenceScan,
  updateOperationalEventStatus,
  getPriorityQueues,
  generateIntelligenceDigest,
  generateRecoveryDraft,
  generateLeadSummary
};
