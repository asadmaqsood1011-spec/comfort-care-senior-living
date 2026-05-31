const crypto = require("crypto");
const { clean, isValidEmail, isValidPhone, normalizePhone, sendEmail, buildBrandedEmail, personalizeEmail, mostCommon } = require("./helpers");
const { assertLocationAccess } = require("./v2-auth");

const LEAD_STATUSES = new Set(["new", "contacted", "tour_scheduled", "move_in", "archived"]);
const USER_ROLES = new Set(["super_admin", "regional_manager", "location_admin", "staff"]);
const TASK_STATUSES = new Set(["todo", "in_progress", "done", "archived"]);
const FOLLOW_UP_STATUSES = new Set(["open", "completed", "missed", "archived"]);
const TOUR_STATUSES = new Set(["scheduled", "completed", "no_show", "cancelled"]);
const ROOM_STATUSES = new Set(["available", "occupied", "reserved", "maintenance", "offline"]);
const ROOM_CONDITIONS = new Set(["ready", "lived_in", "needs_cleaning", "maintenance", "damaged", "offline"]);
const OPERATING_PLAN_STATUSES = new Set(["open", "assigned", "snoozed", "completed", "dismissed", "escalated"]);
const OPERATING_PLAN_PRIORITIES = new Set(["critical", "high", "medium", "low"]);
const INTELLIGENCE_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const DOCUMENT_BUCKET = "operations-documents";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email";

const INTELLIGENCE_RULE_DEFINITIONS = [
  { event_type: "follow_up_overdue", label: "Follow-up overdue", description: "Open follow-up due before now.", severity: "medium", threshold_hours: 0, cooldown_hours: 4, settings: {} },
  { event_type: "lead_stale", label: "Stale lead", description: "Lead has gone untouched past the stale threshold.", severity: "medium", threshold_hours: 168, cooldown_hours: 24, settings: { stale_days: 7 } },
  { event_type: "high_intent_lead_uncontacted", label: "High-intent uncontacted lead", description: "High-fit lead has not been contacted fast enough.", severity: "high", threshold_hours: 2, cooldown_hours: 4, settings: { min_score: 70 } },
  { event_type: "tour_no_show_risk", label: "Tour no-show risk", description: "Upcoming tour needs confirmation inside the risk window.", severity: "medium", threshold_hours: 24, cooldown_hours: 4, settings: { tour_window_hours: 24 } },
  { event_type: "inactive_pipeline_segment", label: "Inactive pipeline segment", description: "Location pipeline has gone quiet.", severity: "medium", threshold_hours: 168, cooldown_hours: 24, settings: { inactive_days: 7 } },
  { event_type: "response_time_decline", label: "Response time decline", description: "Recent response behavior is slowing down.", severity: "medium", threshold_hours: null, cooldown_hours: 24, settings: { min_hours: 4, decline_ratio: 1.25 } },
  { event_type: "recovery_opportunity_detected", label: "Recovery opportunity", description: "Dormant lead still has enough fit to recover.", severity: "medium", threshold_hours: 168, cooldown_hours: 24, settings: { min_score: 35 } },
  { event_type: "occupancy_warning", label: "Occupancy warning", description: "Occupancy is below operating target.", severity: "medium", threshold_hours: null, cooldown_hours: 24, settings: { target_occupancy: 0.85 } },
  { event_type: "conversion_drop_detected", label: "Conversion drop", description: "Conversion is slipping against recent baseline.", severity: "medium", threshold_hours: null, cooldown_hours: 24, settings: { drop: 0.1 } },
  { event_type: "pipeline_shortfall_risk", label: "Pipeline shortfall", description: "Pipeline may not support near-term occupancy goal.", severity: "medium", threshold_hours: null, cooldown_hours: 24, settings: { min_hot_or_tours: 1 } },
  { event_type: "available_room_no_match", label: "Available room with no match", description: "Vacant inventory has no compatible active lead.", severity: "medium", threshold_hours: null, cooldown_hours: 24, settings: {} },
  { event_type: "high_intent_no_compatible_room", label: "Hot lead without room fit", description: "High-intent lead has no compatible room.", severity: "high", threshold_hours: null, cooldown_hours: 12, settings: { min_score: 60 } },
  { event_type: "vacant_room_revenue_risk", label: "Vacant room revenue risk", description: "Available room is creating monthly revenue risk.", severity: "high", threshold_hours: null, cooldown_hours: 24, settings: {} },
  { event_type: "reserved_room_pending_move_in", label: "Reserved room pending move-in", description: "Reserved room needs move-in workflow follow-through.", severity: "medium", threshold_hours: null, cooldown_hours: 12, settings: {} },
  { event_type: "maintenance_room_blocks_occupancy", label: "Maintenance room blocking occupancy", description: "Room upkeep is blocking admissions capacity.", severity: "high", threshold_hours: null, cooldown_hours: 12, settings: {} },
  { event_type: "room_inventory_occupancy_warning", label: "Room inventory occupancy warning", description: "Room-based occupancy is below target.", severity: "medium", threshold_hours: null, cooldown_hours: 24, settings: { target_occupancy: 0.85 } }
];

async function getLocations(db, user) {
  if (user.isSuperAdmin) {
    const { data, error } = await db.from("locations").select("*").eq("active", true).order("name");
    if (error) throw error;
    return data || [];
  }
  return user.locations.filter((location) => location.active !== false).sort((a, b) => a.name.localeCompare(b.name));
}

async function getDashboard(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, locationId);
  const [leads, tours, followUps, tasks, activity] = await Promise.all([
    selectByLocations(db.from("leads_v2").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("staff_tasks").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("activity_logs").select("*, profiles:actor_id(full_name,email)").order("created_at", { ascending: false }).limit(80), locationIds, "location_id")
  ]);
  throwFirstError(leads, tours, followUps, tasks, activity);

  const leadRows = leads.data || [];
  const tourRows = tours.data || [];
  const followRows = followUps.data || [];
  const taskRows = tasks.data || [];
  const now = Date.now();
  const overdue = followRows.filter((row) => row.status === "open" && new Date(row.due_at).getTime() < now).length;
  const moveIns = leadRows.filter((lead) => lead.status === "move_in").length;
  const conversionRate = leadRows.length ? Math.round((moveIns / leadRows.length) * 100) : 0;

  return {
    scope: { locationId: locationId || "", locationIds },
    metrics: {
      totalLeads: leadRows.length,
      toursScheduled: tourRows.filter((tour) => tour.status === "scheduled").length,
      moveIns,
      conversionRate,
      overdueFollowUps: overdue,
      openTasks: taskRows.filter((task) => !["done", "archived"].includes(task.status)).length
    },
    locationComparison: locations
      .filter((location) => locationIds.includes(location.id))
      .map((location) => {
        const localLeads = leadRows.filter((lead) => lead.location_id === location.id);
        const localMoveIns = localLeads.filter((lead) => lead.status === "move_in").length;
        return {
          locationId: location.id,
          name: location.name,
          leads: localLeads.length,
          tours: tourRows.filter((tour) => tour.location_id === location.id).length,
          moveIns: localMoveIns,
          conversionRate: localLeads.length ? Math.round((localMoveIns / localLeads.length) * 100) : 0,
          overdueFollowUps: followRows.filter((follow) => follow.location_id === location.id && follow.status === "open" && new Date(follow.due_at).getTime() < now).length
        };
      }),
    recentActivity: activity.data || []
  };
}

async function listLeads(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || ""));
  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.min(200, Math.max(10, parseInt(params.limit, 10) || 100));
  const from = (page - 1) * limit;

  let countQuery = db.from("leads_v2").select("id", { count: "exact", head: true });
  let dataQuery = db.from("leads_v2").select("*").order("created_at", { ascending: false }).range(from, from + limit - 1);
  countQuery = scopeQuery(countQuery, locationIds, "location_id");
  dataQuery = scopeQuery(dataQuery, locationIds, "location_id");
  if (params.status && LEAD_STATUSES.has(params.status)) {
    countQuery = countQuery.eq("status", params.status);
    dataQuery = dataQuery.eq("status", params.status);
  }
  if (params.search) {
    const search = clean(params.search).toLowerCase();
    const or = `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`;
    countQuery = countQuery.or(or);
    dataQuery = dataQuery.or(or);
  }
  const [{ count, error: cErr }, { data, error }] = await Promise.all([countQuery, dataQuery]);
  if (cErr) throw cErr;
  if (error) throw error;
  const total = count || 0;
  return { leads: data || [], total, page, pageCount: Math.ceil(total / limit), limit };
}

async function getLeadDetail(db, user, id) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const [activity, notes, emails, tours, followUps] = await Promise.all([
    db.from("activity_logs").select("*, profiles:actor_id(full_name,email)").eq("entity_type", "lead").eq("entity_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("notes").select("*").eq("entity_type", "lead").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("email_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("tours").select("*").eq("lead_id", id).order("scheduled_at", { ascending: false }).limit(50),
    db.from("follow_ups").select("*").eq("lead_id", id).order("due_at", { ascending: false }).limit(50)
  ]);
  throwFirstError(activity, notes, emails, tours, followUps);
  const timeline = buildLeadTimeline({
    lead,
    activity: activity.data || [],
    notes: notes.data || [],
    emails: emails.data || [],
    tours: tours.data || [],
    followUps: followUps.data || []
  });
  return {
    lead,
    activity: activity.data || [],
    notes: notes.data || [],
    emailHistory: emails.data || [],
    tours: tours.data || [],
    followUps: followUps.data || [],
    timeline
  };
}

async function updateLeadNotes(db, user, id, notes) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const body = clean(notes);
  const { data, error } = await db
    .from("leads_v2")
    .update({ notes_summary: body })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await db.from("notes").insert({
    location_id: lead.location_id,
    entity_type: "lead",
    entity_id: id,
    body: body || "Notes cleared.",
    visibility: "internal",
    created_by: user.id
  });
  await logActivity(db, user, lead.location_id, "lead", id, "notes_updated", {});
  return data;
}

async function generateLeadEmailDraft(db, user, id) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const location = await getLocationById(db, lead.location_id);
  let subject = `Checking in from ${location?.name || "Comfort Care Senior Living"}`;
  let body = `Hi {{first_name}},

Thank you for reaching out to Comfort Care Senior Living. I wanted to personally follow up about {{care_type}} at {{community}} and see how we can help your family think through next steps.

If it would be helpful, we can answer questions about care, availability, pricing, and tour options.

Warmly,
The Comfort Care Team`;
  let ai = false;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (OPENAI_API_KEY) {
    try {
      const prompt = `Write a short, warm, human-reviewed follow-up email for a senior living inquiry.

Company: Comfort Care Senior Living
Community: ${location?.name || ""}
Lead name: ${lead.full_name}
Care type: ${lead.care_type || ""}
Timeline: ${lead.move_timeline || ""}
Payment: ${lead.payment_type || ""}
Situation/notes: ${lead.current_situation || lead.notes_summary || ""}

Rules:
- Be compassionate and professional.
- Do not invent offers, discounts, availability, or medical claims.
- Keep it under 170 words.
- Use {{first_name}}, {{community}}, and {{care_type}} placeholders where useful.
- Return exactly:
Subject: ...
Body:
...`;
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.45
        })
      });
      const json = await aiRes.json();
      const text = json.choices?.[0]?.message?.content || "";
      const subjectMatch = text.match(/Subject:\s*(.+)/i);
      const bodyMatch = text.match(/Body:\s*([\s\S]+)/i);
      if (subjectMatch && bodyMatch) {
        subject = clean(subjectMatch[1]);
        body = bodyMatch[1].trim();
        ai = true;
      }
    } catch (err) {
      console.error("V2 email draft error:", err.message);
    }
  }

  await logActivity(db, user, lead.location_id, "lead", lead.id, "email_draft_generated", { ai });
  return { subject, body, ai };
}

async function sendLeadEmail(db, user, id, body = {}) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  if (!isValidEmail(lead.email || "")) validationError("This lead does not have a valid email address.");
  const location = await getLocationById(db, lead.location_id);
  const subject = clean(body.subject);
  const draftBody = String(body.body || "").trim();
  if (!subject || !draftBody) validationError("Subject and email body are required.");
  const leadForTemplate = {
    ...lead,
    name: lead.full_name,
    location: location?.name || "",
    preferred_community: location?.name || ""
  };
  const personalizedSubject = personalizeEmail(subject, leadForTemplate);
  const personalizedBody = personalizeEmail(draftBody, leadForTemplate);
  const gmailRequested = body.sendFrom === "gmail" || body.useStaffGmail === true;
  const gmailIntegration = gmailRequested ? await getGoogleIntegration(db, user, "google_gmail", lead.location_id) : null;
  const result = gmailRequested
    ? await sendGoogleGmailMessage(db, gmailIntegration, {
      to: lead.email,
      subject: personalizedSubject,
      body: personalizedBody,
      fromName: user.full_name || user.email || "Comfort Care"
    })
    : await sendEmail({
      to: lead.email,
      subject: personalizedSubject,
      body: personalizedBody,
      html: buildBrandedEmail(personalizedBody)
    });
  const { data, error } = await db.from("email_history").insert({
    location_id: lead.location_id,
    lead_id: lead.id,
    recipient_email: lead.email,
    subject: personalizedSubject,
    body: personalizedBody,
    status: clean(result.status || "sent").toLowerCase(),
    provider: result.mode || (gmailRequested ? "google_gmail" : "gmail"),
    sent_by: user.id,
    sent_at: new Date().toISOString(),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, lead.location_id, "lead", lead.id, "email_sent", { subject: personalizedSubject, status: result.status, emailHistoryId: data.id });
  return { email: data, result };
}

async function draftMassOutreach(db, user, body = {}) {
  const target = await resolveOutreachTargets(db, user, body.filters || {});
  const commonCareType = mostCommon(target.leads.map((lead) => lead.care_type)) || "senior living";
  const commonLocation = mostCommon(target.leads.map((lead) => target.locationNames.get(lead.location_id))) || "Comfort Care Senior Living";
  const subjectHint = clean(body.subjectHint || "");
  let subject = target.locationIds.length === 1
    ? `A personal note from ${commonLocation}`
    : "A personal note from Comfort Care Senior Living";
  let draftBody = `Hi {{first_name}},

I wanted to personally follow up from Comfort Care Senior Living. Based on your interest in {{care_type}} at {{community}}, our team can help answer questions about care options, transparent pricing, and scheduling a private tour.

If there is anything specific your family shared with us, our team will review it carefully: {{lead_message}}

Would you like to schedule a call or tour?

Warmly,
The Comfort Care Team`;
  let ai = false;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (OPENAI_API_KEY) {
    try {
      const prompt = `You write reusable campaign email templates for Comfort Care Senior Living.

Create ONE reusable email template for a bulk lead campaign. It will be personalized separately for each recipient at send time.

Campaign context:
- Matching leads: ${target.leads.length}
- Mailable leads: ${target.validLeads.length}
- Location scope: ${target.locationIds.length === 1 ? commonLocation : "Multiple assigned Comfort Care communities"}
- Common care interest: ${commonCareType}
${subjectHint ? `- Campaign theme or subject hint: "${subjectHint}"` : ""}

Instructions:
- This must NOT be written to one real person.
- Do NOT include any actual lead name, phone, email, or one person's notes.
- Start the body with exactly: Hi {{first_name}},
- Use placeholders where personalization belongs: {{first_name}}, {{community}}, {{care_type}}, {{lead_message}}
- If the campaign spans multiple communities, do not hardcode one community; use {{community}}.
- Keep it under 150 words, warm and human, not salesy.
- Sign off as "The Comfort Care Team".
- Return JSON with keys: subject (string) and body (string).`;
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.45
        })
      });
      const aiData = await aiRes.json();
      const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
      if (parsed.subject && parsed.body) {
        subject = clean(parsed.subject);
        draftBody = String(parsed.body || "").trim();
        ai = true;
      }
    } catch (err) {
      console.error("V2 mass outreach draft error:", err.message);
    }
  }

  return {
    subject,
    body: draftBody,
    ai,
    recipients: target.validLeads.length,
    matching: target.leads.length,
    invalidEmails: target.invalidEmailCount,
    cap: target.cap
  };
}

async function sendMassOutreach(db, user, body = {}) {
  const subject = clean(body.subject || "");
  const draftBody = String(body.body || "").trim().slice(0, 12000);
  if (!subject || !draftBody) validationError("Subject and email body are required.");

  const target = await resolveOutreachTargets(db, user, body.filters || {});
  const validLeads = target.validLeads;
  const testRecipient = clean(body.testRecipient || "").toLowerCase();
  const campaignName = clean(body.campaignName || subject).slice(0, 120) || "Mass outreach campaign";

  if (testRecipient) {
    if (!isValidEmail(testRecipient)) validationError("Enter a valid test email.");
    const sampleLead = validLeads[0] || target.leads[0] || fallbackOutreachLead(target.locationNames);
    const leadForTemplate = leadTemplateData(sampleLead, target.locationNames, testRecipient);
    const personalizedSubject = personalizeEmail(subject, leadForTemplate);
    const personalizedBody = personalizeEmail(draftBody, leadForTemplate);
    const result = await sendEmail({
      to: testRecipient,
      subject: `[TEST] ${personalizedSubject}`,
      body: personalizedBody,
      html: buildBrandedEmail(personalizedBody)
    });
    await insertOutreachEmail(db, user, sampleLead, {
      locationId: sampleLead.location_id || target.locationIds[0],
      recipientEmail: testRecipient,
      subject: `[TEST] ${personalizedSubject}`,
      body: personalizedBody,
      status: result.status || "sent",
      provider: "mass_outreach_test",
      campaignId: "",
      campaignName
    });
    return { ok: true, sent: 1, failed: 0, mode: result.mode || "test", message: result.message || "Test email sent." };
  }

  if (!validLeads.length) validationError("No matching leads have a valid email address.");

  const demoOnly = body.demoOnly === true;
  const targets = validLeads.slice(0, target.cap);
  const campaignId = `cmp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  await insertOutreachCampaignMarker(db, user, {
    campaignId,
    campaignName,
    subject,
    body: draftBody,
    filters: body.filters || {},
    locationId: targets[0]?.location_id || target.locationIds[0],
    recipientCount: targets.length,
    matchingCount: target.leads.length,
    invalidEmailCount: target.invalidEmailCount,
    mode: demoOnly ? "Demo" : "Live"
  });

  let sent = 0;
  let failed = 0;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  for (const lead of targets) {
    let finalSubject = personalizeEmail(subject, leadTemplateData(lead, target.locationNames));
    let finalBody = personalizeEmail(draftBody, leadTemplateData(lead, target.locationNames));

    if (!demoOnly && OPENAI_API_KEY && body.personalize !== false) {
      try {
        const firstName = clean(lead.full_name || "").split(" ")[0] || "there";
        const community = target.locationNames.get(lead.location_id) || "Comfort Care";
        const context = [lead.care_type, lead.move_timeline, lead.payment_type, lead.current_situation, lead.notes_summary].filter(Boolean).join(" | ");
        const prompt = `Write a short, warm, personalized outreach email for Comfort Care Senior Living.

Recipient details:
- Name: ${firstName}
- Community interested in: ${community}
- Context: "${context}"

Campaign template subject:
"${subject}"

Campaign template body:
"${draftBody}"

Rules:
1. Start with "Hi ${firstName},"
2. Use the campaign template as the theme, but personalize it to this one recipient.
3. Mention ${community} naturally.
4. Do not invent availability, discounts, medical claims, or promises.
5. Keep under 150 words.
6. Sign off as "The Comfort Care Team".
7. Return JSON with keys: subject (string) and body (string).`;
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 400,
            temperature: 0.45
          })
        });
        const aiData = await aiRes.json();
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
        if (parsed.subject) finalSubject = clean(parsed.subject);
        if (parsed.body) finalBody = String(parsed.body || "").trim();
      } catch (err) {
        console.error(`V2 outreach personalization error for ${lead.email}:`, err.message);
      }
    }

    const result = demoOnly
      ? { mode: "demo", status: "demo sent", message: "Demo outreach logged." }
      : await sendEmail({ to: lead.email, subject: finalSubject, body: finalBody, html: buildBrandedEmail(finalBody) });
    await insertOutreachEmail(db, user, lead, {
      locationId: lead.location_id,
      recipientEmail: lead.email,
      subject: finalSubject,
      body: finalBody,
      status: result.status || (demoOnly ? "demo sent" : "sent"),
      provider: `mass_outreach:${campaignId}`,
      campaignId,
      campaignName
    });
    if (!demoOnly && /sent/i.test(result.status || "sent")) {
      await db.from("leads_v2").update({ status: "contacted", updated_at: new Date().toISOString() }).eq("id", lead.id);
    }
    if (/sent/i.test(result.status || "")) sent += 1;
    else failed += 1;
  }

  return {
    ok: true,
    campaignId,
    sent,
    failed,
    matching: target.leads.length,
    invalidEmails: target.invalidEmailCount,
    message: demoOnly
      ? `Demo campaign logged for ${targets.length} lead${targets.length === 1 ? "" : "s"}.`
      : `Sent ${sent} email${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`
  };
}

async function listMassOutreachCampaigns(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || ""));
  const includeArchived = params.archived === "true" || params.archived === true;
  const [markers, emails] = await Promise.all([
    scopeQuery(db.from("email_history").select("*").like("recipient_email", "campaign:%").order("created_at", { ascending: false }).limit(100), locationIds, "location_id"),
    scopeQuery(db.from("email_history").select("*").like("provider", "mass_outreach:%").order("created_at", { ascending: false }).limit(1000), locationIds, "location_id")
  ]);
  throwFirstError(markers, emails);

  const campaigns = new Map();
  (markers.data || []).forEach((row) => {
    const parsed = parseJson(row.body);
    const campaignId = parsed.campaignId || String(row.recipient_email || "").replace(/^campaign:/, "");
    campaigns.set(campaignId, {
      id: campaignId,
      name: parsed.campaignName || row.subject || "Mass outreach campaign",
      subject: parsed.subject || row.subject || "",
      body: parsed.body || "",
      filters: parsed.filters || {},
      mode: parsed.mode || (/demo/i.test(row.status || "") ? "Demo" : "Live"),
      archived: parsed.archived === true || /archived/i.test(row.status || ""),
      expectedRecipients: Number(parsed.recipientCount || 0),
      matchingCount: Number(parsed.matchingCount || 0),
      invalidEmailCount: Number(parsed.invalidEmailCount || 0),
      createdAt: row.created_at,
      locationId: row.location_id,
      recipients: []
    });
  });

  (emails.data || []).forEach((row) => {
    const campaignId = String(row.provider || "").replace(/^mass_outreach:/, "");
    if (!campaignId || campaignId === row.provider) return;
    if (!campaigns.has(campaignId)) {
      campaigns.set(campaignId, {
        id: campaignId,
        name: "Mass outreach campaign",
        subject: row.subject || "",
        body: "",
        filters: {},
        mode: /demo/i.test(row.status || "") ? "Demo" : "Live",
        archived: false,
        expectedRecipients: 0,
        matchingCount: 0,
        invalidEmailCount: 0,
        createdAt: row.created_at,
        locationId: row.location_id,
        recipients: []
      });
    }
    const campaign = campaigns.get(campaignId);
    campaign.recipients.push({
      leadId: row.lead_id,
      email: row.recipient_email,
      subject: row.subject,
      status: row.status,
      createdAt: row.sent_at || row.created_at
    });
  });

  return [...campaigns.values()]
    .filter((campaign) => includeArchived || !campaign.archived)
    .map((campaign) => {
      const sent = campaign.recipients.filter((item) => /sent/i.test(item.status || "")).length;
      const failed = campaign.recipients.filter((item) => /failed|error/i.test(item.status || "")).length;
      return {
        ...campaign,
        sent,
        failed,
        recipientCount: campaign.recipients.length || campaign.expectedRecipients,
        recipients: campaign.recipients.slice(0, 100)
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 30);
}

async function setMassOutreachCampaignArchived(db, user, body = {}) {
  const campaignId = clean(body.campaignId || "");
  if (!campaignId) validationError("Campaign id is required.");
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(body.locationId || ""));
  const { data, error } = await scopeQuery(
    db.from("email_history").select("*").eq("recipient_email", `campaign:${campaignId}`).limit(1),
    locationIds,
    "location_id"
  );
  if (error) throw error;
  const marker = data?.[0];
  if (!marker) validationError("Campaign was not found in your location scope.");
  const parsed = parseJson(marker.body);
  const archived = body.archived !== false;
  const nextBody = JSON.stringify({
    ...parsed,
    campaignId,
    archived,
    archivedAt: archived ? new Date().toISOString() : ""
  });
  const { error: updateError } = await db
    .from("email_history")
    .update({ body: nextBody, status: archived ? "campaign_archived" : (parsed.mode === "Demo" ? "campaign_demo" : "campaign_live") })
    .eq("id", marker.id);
  if (updateError) throw updateError;
  await logActivity(db, user, marker.location_id, "campaign", null, archived ? "mass_outreach_campaign_archived" : "mass_outreach_campaign_restored", { campaignId });
  return { ok: true, archived };
}

async function exportLeadsCsv(db, user, params = {}) {
  const { leads } = await listLeads(db, user, { ...params, limit: 2000 });
  const headers = ["Full name", "Phone number", "Email", "Location ID", "Source", "Care type", "Status", "Move timeline", "Payment type", "Priority tags", "Notes", "Date submitted"];
  const rows = leads.map((lead) => [
    lead.full_name,
    lead.phone,
    lead.email || "",
    lead.location_id,
    lead.source,
    lead.care_type,
    lead.status,
    lead.move_timeline || "",
    lead.payment_type || "",
    (lead.priority_tags || []).join(", "),
    lead.notes_summary || "",
    lead.created_at
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

async function createLead(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const payload = buildLeadPayload(body, locationId, user.id);
  const duplicate = await findDuplicateLead(db, payload);
  if (duplicate) {
    payload.duplicate_of = duplicate.id;
    payload.duplicate_reason = "Matching phone or email";
  }
  const { data, error } = await db.from("leads_v2").insert(payload).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "lead", data.id, "lead_created", { source: data.source, duplicateOf: data.duplicate_of });
  return { lead: data, duplicate };
}

async function updateLeadStatus(db, user, id, status) {
  if (!LEAD_STATUSES.has(status)) {
    const error = new Error("Invalid lead status.");
    error.statusCode = 422;
    throw error;
  }
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const { data, error } = await db
    .from("leads_v2")
    .update({ status, archived_at: status === "archived" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, lead.location_id, "lead", id, "status_changed", { status });
  if (status === "move_in" && lead.status !== "move_in") {
    await seedMoveInTasks(db, user, data).catch((err) => console.error("seedMoveInTasks failed:", err.message));
  }
  return data;
}

async function bulkUpdateLeads(db, user, body = {}) {
  const ids = Array.isArray(body.ids) ? body.ids.map(clean).filter(Boolean) : [];
  const status = clean(body.status);
  if (!ids.length) validationError("No leads selected.");
  if (!LEAD_STATUSES.has(status)) validationError("Invalid status.");
  const { data: leads, error: fetchErr } = await db.from("leads_v2").select("id, location_id, status").in("id", ids);
  if (fetchErr) throw fetchErr;
  (leads || []).forEach((row) => assertLocationAccess(user, row.location_id));
  const patch = { status, archived_at: status === "archived" ? new Date().toISOString() : null };
  const { data: updated, error } = await db.from("leads_v2").update(patch).in("id", ids).select("id, location_id, status");
  if (error) throw error;
  await Promise.all((updated || []).map((row) =>
    logActivity(db, user, row.location_id, "lead", row.id, "status_changed", { status, bulk: true })
  ));
  return { updated: updated?.length || 0, status };
}

const MOVE_IN_TEMPLATE = {
  default: [
    { title: "Welcome packet prepared", days: 0 },
    { title: "Room setup and inspection", days: 0 },
    { title: "Family orientation scheduled", days: 1 },
    { title: "Move-in day point-of-contact assigned", days: 0 },
    { title: "Initial care plan review", days: 3 }
  ],
  "Memory Care": [
    { title: "Memory care safety assessment", days: 0 },
    { title: "Wandering risk evaluation", days: 1 },
    { title: "Behavioral baseline documented", days: 3 }
  ],
  "Assisted Living": [
    { title: "Medication setup with pharmacy", days: 1 },
    { title: "ADL assessment scheduled", days: 2 }
  ],
  "Independent Living": [
    { title: "Amenity tour with resident", days: 1 }
  ]
};

async function seedMoveInTasks(db, user, lead) {
  const careType = clean(lead.care_type);
  const baseTemplate = MOVE_IN_TEMPLATE.default;
  const careTemplate = MOVE_IN_TEMPLATE[careType] || [];
  const allTasks = [...baseTemplate, ...careTemplate];
  const now = Date.now();
  const rows = allTasks.map((task) => ({
    location_id: lead.location_id,
    lead_id: lead.id,
    title: `[Move-in] ${task.title} — ${lead.full_name || "resident"}`,
    task_type: "move_in",
    status: "todo",
    due_at: new Date(now + task.days * 24 * 60 * 60 * 1000).toISOString(),
    created_by: user.id || null
  }));
  if (!rows.length) return;
  const { error } = await db.from("staff_tasks").insert(rows);
  if (error) throw error;
}

function tourSecret() {
  return process.env.TOUR_LINK_SECRET || process.env.CRON_SECRET || "";
}

function signTourToken(tourId) {
  const secret = tourSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(String(tourId)).digest("hex").slice(0, 24);
}

async function getTourPublicLink(db, user, tourId) {
  const tour = await getEntityById(db, "tours", tourId);
  assertLocationAccess(user, tour.location_id);
  const token = signTourToken(tour.id);
  if (!token) {
    const error = new Error("Server is missing TOUR_LINK_SECRET (or CRON_SECRET).");
    error.statusCode = 500;
    throw error;
  }
  return { tourId: tour.id, token, path: `/tour/${tour.id}?t=${token}` };
}

async function getPublicTour(db, tourId, token) {
  if (!token || token !== signTourToken(tourId)) {
    const error = new Error("Invalid or expired tour link.");
    error.statusCode = 401;
    throw error;
  }
  const { data: tour, error } = await db.from("tours").select("*").eq("id", tourId).maybeSingle();
  if (error) throw error;
  if (!tour) {
    const err = new Error("Tour not found.");
    err.statusCode = 404;
    throw err;
  }
  const [{ data: lead }, { data: location }] = await Promise.all([
    tour.lead_id ? db.from("leads_v2").select("full_name").eq("id", tour.lead_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("locations").select("name, address, phone").eq("id", tour.location_id).maybeSingle()
  ]);
  return {
    tour: { id: tour.id, scheduled_at: tour.scheduled_at, status: tour.status, notes: tour.notes },
    lead: lead ? { full_name: lead.full_name } : null,
    location: location || null
  };
}

async function getOccupancyForecast(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(locationId));
  const [leads, residents, tours, roomsRaw] = await Promise.all([
    selectByLocations(db.from("leads_v2").select("*"), locationIds, "location_id"),
    selectByLocations(db.from("residents_v2").select("id, location_id, status, move_in_date"), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("id, location_id, lead_id, status, scheduled_at"), locationIds, "location_id"),
    selectByLocations(db.from("rooms_v2").select("*"), locationIds, "location_id")
  ]);
  const roomsRes = roomsRaw?.error && isMissingTableError(roomsRaw.error) ? { data: [] } : roomsRaw;
  throwFirstError(leads, residents, tours, roomsRes);
  const leadRows = leads.data || [];
  const residentRows = residents.data || [];
  const tourRows = tours.data || [];
  const roomRows = roomsRes.data || [];
  const STAGE_PROB = { new: 0.05, contacted: 0.18, tour_scheduled: 0.4, move_in: 1, archived: 0 };
  const activeMoveIns = residentRows.filter((r) => r.status === "active").length;
  const projected = leadRows.reduce((sum, lead) => sum + (STAGE_PROB[lead.status] ?? 0), 0);
  const tour30 = tourRows.filter((t) => t.status === "scheduled" && new Date(t.scheduled_at).getTime() <= Date.now() + 30 * 86400000).length;
  const fillableRooms = roomRows
    .filter((room) => roomCurrentStatusValue(room) === "available")
    .sort((a, b) => roomRevenueValue(b) - roomRevenueValue(a));
  const topFillRooms = fillableRooms.slice(0, 3).map((room) => ({
    id: room.id,
    roomNumber: room.room_number || "",
    locationId: room.location_id,
    monthlyRate: roomRevenueValue(room),
    careLevel: room.care_level_supported || room.care_level || "",
    matches: buildRoomMatches([room], leadRows, { limit: 3 }).map((match) => ({
      leadId: match.lead.id,
      leadName: match.lead.full_name,
      score: match.score
    }))
  }));
  const fill3MonthlyRevenue = topFillRooms.reduce((sum, room) => sum + Number(room.monthlyRate || 0), 0);
  return {
    current: activeMoveIns,
    projected30: Math.round(activeMoveIns + projected * 0.4),
    projected60: Math.round(activeMoveIns + projected * 0.65),
    projected90: Math.round(activeMoveIns + projected * 0.85),
    weightedPipeline: Number(projected.toFixed(1)),
    upcomingTours: tour30,
    fill3MonthlyRevenue,
    topFillRooms,
    roomRevenueForecast: {
      openRooms: fillableRooms.length,
      fillOneMonthlyRevenue: topFillRooms[0]?.monthlyRate || 0,
      fillThreeMonthlyRevenue: fill3MonthlyRevenue,
      projectedMonthlyRevenue: residentRows.filter((r) => r.status === "active").length * 6500 + fill3MonthlyRevenue
    },
    breakdown: {
      new: leadRows.filter((l) => l.status === "new").length,
      contacted: leadRows.filter((l) => l.status === "contacted").length,
      tour_scheduled: leadRows.filter((l) => l.status === "tour_scheduled").length,
      move_in: leadRows.filter((l) => l.status === "move_in").length
    }
  };
}

async function getReferralRoi(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(locationId));
  const [leadsRes, toursRes, roomsRaw] = await Promise.all([
    selectByLocations(db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(1000), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("lead_id,status").limit(1000), locationIds, "location_id"),
    selectByLocations(db.from("rooms_v2").select("*").limit(500), locationIds, "location_id")
  ]);
  const roomsRes = roomsRaw?.error && isMissingTableError(roomsRaw.error) ? { data: [] } : roomsRaw;
  throwFirstError(leadsRes, toursRes, roomsRes);
  const leads = leadsRes.data || [];
  const tours = toursRes.data || [];
  const rooms = roomsRes.data || [];
  const leadTours = new Map();
  tours.forEach((tour) => {
    if (!tour.lead_id) return;
    leadTours.set(tour.lead_id, (leadTours.get(tour.lead_id) || 0) + 1);
  });
  const matches = buildRoomMatches(rooms, leads, { limit: 500 });
  const matchesByLead = new Map();
  matches.forEach((match) => {
    matchesByLead.set(match.lead.id, Math.max(matchesByLead.get(match.lead.id) || 0, match.score));
  });
  const groups = new Map();
  leads.forEach((lead) => {
    const key = clean(lead.source) || "Unknown";
    if (!groups.has(key)) groups.set(key, {
      source: key,
      leads: 0,
      activeLeads: 0,
      hotLeads: 0,
      roomFitLeads: 0,
      moveIns: 0,
      tours: 0,
      disqualified: 0,
      estimatedRoomRevenue: 0
    });
    const g = groups.get(key);
    const status = clean(lead.status).toLowerCase();
    g.leads += 1;
    if (!["archived", "move_in"].includes(status)) g.activeLeads += 1;
    if (estimateLeadIntentScore(lead) >= 55) g.hotLeads += 1;
    if (matchesByLead.has(lead.id)) {
      g.roomFitLeads += 1;
      g.estimatedRoomRevenue += 6500 * (matchesByLead.get(lead.id) / 100);
    }
    if (status === "move_in") g.moveIns += 1;
    if (status === "archived") g.disqualified += 1;
    if (status === "tour_scheduled" || status === "move_in" || leadTours.has(lead.id)) g.tours += 1;
  });
  return [...groups.values()]
    .map((g) => {
      const conversionRate = g.leads ? Math.round((g.moveIns / g.leads) * 1000) / 10 : 0;
      const tourRate = g.leads ? Math.round((g.tours / g.leads) * 1000) / 10 : 0;
      const roomFitRate = g.activeLeads ? Math.round((g.roomFitLeads / g.activeLeads) * 1000) / 10 : 0;
      const qualityScore = Math.min(100, Math.round((conversionRate * 1.4) + (tourRate * 0.35) + (roomFitRate * 0.25) + (g.hotLeads * 3) - (g.disqualified * 2)));
      return {
        ...g,
        conversionRate,
        tourRate,
        roomFitRate,
        qualityScore,
        estimatedRoomRevenue: Math.round(g.estimatedRoomRevenue)
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore || b.leads - a.leads);
}

async function listReferralPartners(db, user, params = {}) {
  const locationId = clean(params.locationId || params.location_id || "");
  const [roi, locations] = await Promise.all([
    getReferralRoi(db, user, locationId),
    getLocations(db, user)
  ]);
  const locationIds = resolveLocationIds(user, locations, locationId);
  const metricBySource = new Map(roi.map((row) => [clean(row.source).toLowerCase(), row]));
  let partnerRows = [];
  try {
    let query = db.from("referral_partners_v2").select("*").order("updated_at", { ascending: false }).limit(200);
    query = selectByLocations(query, locationIds, "location_id");
    const { data, error } = await query;
    if (error) throw error;
    partnerRows = data || [];
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return {
      schemaInstalled: false,
      partners: roi.map((row) => referralPartnerFromRoi(row, locations)),
      message: "Run supabase/referral-partners-v2.sql to persist referral partners."
    };
  }
  const existing = new Set(partnerRows.map((row) => clean(row.source_name).toLowerCase()));
  const derived = roi.filter((row) => !existing.has(clean(row.source).toLowerCase())).map((row) => referralPartnerFromRoi(row, locations));
  return {
    schemaInstalled: true,
    partners: [
      ...partnerRows.map((row) => ({
        ...row,
        source: row.source_name,
        metrics: metricBySource.get(clean(row.source_name).toLowerCase()) || {}
      })),
      ...derived
    ].sort((a, b) => Number(b.metrics?.qualityScore || 0) - Number(a.metrics?.qualityScore || 0))
  };
}

async function upsertReferralPartner(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const sourceName = clean(body.sourceName || body.source_name || body.source);
  if (!sourceName) validationError("Source name is required.");
  const payload = {
    organization_id: clean(body.organizationId || body.organization_id || "comfort-care"),
    location_id: locationId,
    source_name: sourceName,
    category: clean(body.category || "referral") || "referral",
    contact_name: clean(body.contactName || body.contact_name),
    phone: clean(body.phone),
    email: clean(body.email).toLowerCase(),
    status: clean(body.status || "active").toLowerCase(),
    notes: clean(body.notes),
    created_by: user.id,
    updated_at: new Date().toISOString()
  };
  if (!["active", "watch", "paused", "archived"].includes(payload.status)) validationError("Invalid partner status.");
  if (payload.email && !isValidEmail(payload.email)) validationError("Enter a valid partner email.");
  const { data, error } = await db
    .from("referral_partners_v2")
    .upsert(payload, { onConflict: "location_id,source_name" })
    .select("*")
    .single();
  if (error) {
    if (isMissingTableError(error)) validationError("Referral partners table is not installed yet. Run supabase/referral-partners-v2.sql.");
    throw error;
  }
  await logActivity(db, user, locationId, "referral_partner", data.id, "referral_partner_saved", { sourceName });
  return data;
}

function referralPartnerFromRoi(row = {}, locations = []) {
  return {
    id: `source:${row.source}`,
    location_id: row.location_id || "",
    source: row.source,
    source_name: row.source,
    category: "source",
    contact_name: "",
    phone: "",
    email: "",
    status: Number(row.qualityScore || 0) >= 60 ? "active" : "watch",
    notes: "Derived from lead source performance.",
    derived: true,
    metrics: row,
    locations
  };
}

async function archiveLeadWithReason(db, user, id, body = {}) {
  const reason = clean(body.reason);
  const competitor = clean(body.competitor);
  const lead = await getEntityById(db, "leads_v2", id);
  assertLocationAccess(user, lead.location_id);
  const tag = `[LOST: ${reason || "unspecified"}${competitor ? ` | competitor: ${competitor}` : ""}]`;
  const newNotes = `${tag}\n${lead.notes_summary || ""}`.trim();
  const { data, error } = await db
    .from("leads_v2")
    .update({ status: "archived", archived_at: new Date().toISOString(), notes_summary: newNotes })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, lead.location_id, "lead", id, "lead_archived", { reason, competitor });
  return data;
}

async function mergeLeads(db, user, body = {}) {
  const primaryId = clean(body.primaryId);
  const duplicateId = clean(body.duplicateId);
  if (!primaryId || !duplicateId || primaryId === duplicateId) validationError("Pick two different leads.");
  const [primary, duplicate] = await Promise.all([
    getEntityById(db, "leads_v2", primaryId),
    getEntityById(db, "leads_v2", duplicateId)
  ]);
  assertLocationAccess(user, primary.location_id);
  assertLocationAccess(user, duplicate.location_id);
  const merged = {};
  const fields = ["email", "phone", "care_type", "move_timeline", "payment_type", "current_situation", "relationship_to_resident", "preferred_contact_method", "best_contact_time"];
  fields.forEach((f) => {
    if (clean(primary[f])) merged[f] = primary[f];
    else if (clean(duplicate[f])) merged[f] = duplicate[f];
  });
  const tagsA = primary.priority_tags || [];
  const tagsB = duplicate.priority_tags || [];
  merged.priority_tags = [...new Set([...tagsA, ...tagsB])];
  merged.notes_summary = [primary.notes_summary, duplicate.notes_summary].filter(Boolean).join("\n---\n");
  const { data, error } = await db.from("leads_v2").update(merged).eq("id", primary.id).select("*").single();
  if (error) throw error;
  await db.from("leads_v2").update({ status: "archived", archived_at: new Date().toISOString(), duplicate_of: primary.id, duplicate_reason: "Merged into primary" }).eq("id", duplicate.id);
  await logActivity(db, user, primary.location_id, "lead", primary.id, "lead_merged", { duplicateId: duplicate.id });
  return { primary: data };
}

async function hardDeleteLead(db, user, id, body = {}) {
  const lead = await getEntityById(db, "leads_v2", id);
  assertSuperAdmin(user, "Only super admins can permanently delete leads.");
  assertLocationAccess(user, lead.location_id);
  await writeHardDeleteAudit(db, user, lead.location_id, "lead", id, lead, body);
  await db.from("rooms_v2").update({
    reserved_for_lead_id: null,
    current_status: "available",
    status: "available",
    updated_at: new Date().toISOString()
  }).eq("reserved_for_lead_id", id);
  const { error } = await db.from("leads_v2").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, lead.location_id, "lead", id, "lead_hard_deleted", { reason: clean(body.reason || "") });
  return { ok: true, deletedId: id };
}

async function callLLM(prompt, { json = false, maxTokens = 800, system = "" } = {}) {
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages,
          temperature: 0.4,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: "json_object" } } : {})
        })
      });
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content || "";
      if (text) return { text, provider: "openai" };
    } catch (err) { console.error("OpenAI failed:", err.message); }
  }
  if (geminiKey) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (system ? `${system}\n\n` : "") + prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) }
        })
      });
      const j = await res.json();
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) return { text, provider: "gemini" };
    } catch (err) { console.error("Gemini failed:", err.message); }
  }
  return { text: "", provider: "none" };
}

function safeParseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) {} }
  return null;
}

async function generateMorningBrief(db, user, locationId = "") {
  const dashboard = await getDashboard(db, user, locationId);
  const ops = await listOperations(db, user, locationId);
  const now = Date.now();
  const upcomingTours = (ops.tours || []).filter((t) => t.status === "scheduled" && new Date(t.scheduled_at).getTime() > now).slice(0, 8);
  const overdueFollowUps = (ops.followUps || []).filter((f) => f.status === "open" && new Date(f.due_at).getTime() < now).slice(0, 8);
  const recentLeads = ((await listLeads(db, user, { locationId, limit: 10 })).leads || []).slice(0, 10);
  const context = {
    metrics: dashboard.metrics,
    locationComparison: dashboard.locationComparison,
    upcomingTours: upcomingTours.map((t) => ({ when: t.scheduled_at, lead: t.lead_id, notes: t.notes })),
    overdueFollowUps: overdueFollowUps.map((f) => ({ due: f.due_at, lead: f.lead_id, note: f.note })),
    recentLeads: recentLeads.map((l) => ({ name: l.full_name, status: l.status, careType: l.care_type, source: l.source, createdAt: l.created_at }))
  };
  const prompt = `You are an admissions operations chief-of-staff for a senior-living community. Based on this snapshot, produce the morning briefing.

Snapshot:
${JSON.stringify(context, null, 2)}

Return JSON with this shape:
{
  "headline": "one sentence on the state of admissions",
  "overnight": ["3 short bullets on what changed or needs attention from yesterday/overnight"],
  "today": ["4-6 prioritized actions for today, each starting with a verb"],
  "watch": ["2-3 things to keep an eye on this week"],
  "celebrate": "one short sentence on a positive signal (or empty string)"
}
Only output JSON.`;
  const { text, provider } = await callLLM(prompt, { json: true, maxTokens: 700 });
  const parsed = safeParseJson(text) || { headline: "Operations are stable.", overnight: [], today: [], watch: [], celebrate: "" };
  return { brief: parsed, provider, generatedAt: new Date().toISOString() };
}

async function generateTourPrepBrief(db, user, tourId) {
  const tour = await getEntityById(db, "tours", tourId);
  assertLocationAccess(user, tour.location_id);
  if (!tour.lead_id) return { brief: { talkingPoints: [], sensitivities: [], questionsToAsk: [] }, provider: "none" };
  const detail = await getLeadDetail(db, user, tour.lead_id);
  const lead = detail.lead;
  const recentEmails = (detail.emailHistory || []).slice(0, 5).map((e) => ({ subject: e.subject, snippet: String(e.body || "").slice(0, 240), at: e.created_at }));
  const recentNotes = (detail.notes || []).slice(0, 8).map((n) => ({ body: n.body, at: n.created_at }));
  const activity = (detail.activity || []).slice(0, 12).map((a) => ({ action: a.action, at: a.created_at }));
  const prompt = `You are briefing an admissions counselor 15 minutes before a senior-living tour.

Lead profile:
${JSON.stringify({
  name: lead.full_name,
  careType: lead.care_type,
  moveTimeline: lead.move_timeline,
  paymentType: lead.payment_type,
  source: lead.source,
  notes: lead.notes_summary,
  currentSituation: lead.current_situation
}, null, 2)}

Recent emails: ${JSON.stringify(recentEmails)}
Recent internal notes: ${JSON.stringify(recentNotes)}
Recent activity: ${JSON.stringify(activity)}

Return JSON:
{
  "summary": "2-3 sentence sketch of who is touring and where they are emotionally/logistically",
  "talkingPoints": ["4-6 specific points to mention, tailored to this family"],
  "sensitivities": ["2-4 things to be careful about (emotional triggers, prior frustrations, unspoken concerns)"],
  "questionsToAsk": ["3-4 open-ended questions that move the decision forward"],
  "redFlags": ["any urgent risks (or empty array)"]
}
Be specific to THIS family, not generic. Avoid medical claims. Only output JSON.`;
  const { text, provider } = await callLLM(prompt, { json: true, maxTokens: 700 });
  const parsed = safeParseJson(text) || { summary: "Limited context available.", talkingPoints: [], sensitivities: [], questionsToAsk: [], redFlags: [] };
  return { brief: parsed, provider, lead: { id: lead.id, name: lead.full_name }, generatedAt: new Date().toISOString() };
}

async function triageInboundMessage(db, user, body = {}) {
  const rawText = clean(body.text || body.message || "");
  if (!rawText) validationError("Paste the inbound message.");
  const leadId = clean(body.leadId || "");
  let leadContext = null;
  if (leadId) {
    try {
      const detail = await getLeadDetail(db, user, leadId);
      leadContext = { name: detail.lead.full_name, careType: detail.lead.care_type, status: detail.lead.status };
    } catch (_) {}
  }
  const prompt = `Triage this inbound family message for a senior-living admissions team.

Inbound message:
"""
${rawText}
"""

${leadContext ? `Existing lead context: ${JSON.stringify(leadContext)}` : "No existing lead context."}

Return JSON:
{
  "summary": "1 sentence summary",
  "intent": "tour_request|info_request|reschedule|complaint|pricing|move_in|other",
  "urgency": "low|medium|high|critical",
  "sentiment": "positive|neutral|concerned|frustrated|angry",
  "extractedFields": {
    "careType": "Memory Care|Assisted Living|Independent Living|Unknown",
    "moveTimeline": "ASAP|1-3 months|3-6 months|6+ months|Unknown",
    "decisionMaker": "self|spouse|adult_child|other|Unknown",
    "budgetSignal": "any wording about budget or empty"
  },
  "suggestedReply": {
    "subject": "short subject line",
    "body": "warm, professional reply (under 150 words). Use {{first_name}} placeholder. No medical claims, no pricing promises."
  },
  "internalNotes": "1-2 sentence note for the activity log"
}
Only output JSON.`;
  const { text, provider } = await callLLM(prompt, { json: true, maxTokens: 800 });
  const parsed = safeParseJson(text) || { summary: rawText.slice(0, 120), intent: "other", urgency: "medium", sentiment: "neutral", extractedFields: {}, suggestedReply: { subject: "", body: "" }, internalNotes: "" };
  return { triage: parsed, provider, generatedAt: new Date().toISOString() };
}

async function respondToPublicTour(db, tourId, token, action) {
  if (!token || token !== signTourToken(tourId)) {
    const error = new Error("Invalid or expired tour link.");
    error.statusCode = 401;
    throw error;
  }
  const valid = new Set(["confirmed", "cancelled"]);
  if (!valid.has(action)) {
    const error = new Error("Invalid response.");
    error.statusCode = 422;
    throw error;
  }
  const { data: tour, error: fetchErr } = await db.from("tours").select("*").eq("id", tourId).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!tour) {
    const err = new Error("Tour not found.");
    err.statusCode = 404;
    throw err;
  }
  const patch = action === "confirmed"
    ? { family_confirmed_at: new Date().toISOString() }
    : { status: "cancelled" };
  const { error: updateErr } = await db.from("tours").update(patch).eq("id", tour.id);
  if (updateErr && !String(updateErr.message || "").includes("family_confirmed_at")) throw updateErr;
  try {
    const { error: logErr } = await db.from("activity_logs").insert({
      location_id: tour.location_id,
      actor_id: null,
      entity_type: "tour",
      entity_id: tour.id,
      action: `tour_family_${action}`,
      metadata: { source: "public_link" }
    });
    if (logErr) throw logErr;
  } catch (err) {
    console.error("tour family response activity log failed:", err.message);
  }
  return { ok: true, action };
}

async function scheduleTour(db, user, body = {}) {
  const lead = await getEntityById(db, "leads_v2", clean(body.leadId || body.lead_id));
  assertLocationAccess(user, lead.location_id);
  const scheduledAt = parseRequiredDate(body.scheduledAt || body.scheduled_at, "Choose a valid tour time.");
  const { data, error } = await db.from("tours").insert({
    location_id: lead.location_id,
    lead_id: lead.id,
    scheduled_at: scheduledAt.toISOString(),
    status: "scheduled",
    notes: clean(body.notes),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await db.from("leads_v2").update({ status: "tour_scheduled" }).eq("id", lead.id);
  await logActivity(db, user, lead.location_id, "tour", data.id, "tour_scheduled", { leadId: lead.id, scheduledAt: scheduledAt.toISOString() });
  return syncTourToGoogleCalendar(db, user, data).catch(() => data);
}

async function updateTourStatus(db, user, id, status) {
  if (!TOUR_STATUSES.has(status)) {
    const error = new Error("Invalid tour status.");
    error.statusCode = 422;
    throw error;
  }
  const tour = await getEntityById(db, "tours", id);
  assertLocationAccess(user, tour.location_id);
  const now = new Date().toISOString();
  const patch = {
    status,
    completed_at: status === "completed" ? now : null,
    no_show_at: status === "no_show" ? now : null
  };
  const { data, error } = await db.from("tours").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  if (tour.lead_id && status === "completed") {
    await db.from("leads_v2").update({ status: "contacted" }).eq("id", tour.lead_id).neq("status", "move_in");
  }
  await logActivity(db, user, tour.location_id, "tour", id, "tour_status_changed", { status, leadId: tour.lead_id });
  if (["cancelled", "no_show", "completed"].includes(status)) {
    return syncTourToGoogleCalendar(db, user, data).catch(() => data);
  }
  return data;
}

async function updateTourDetails(db, user, id, body = {}) {
  const tour = await getEntityById(db, "tours", id);
  assertLocationAccess(user, tour.location_id);
  const patch = { updated_at: new Date().toISOString() };
  if (body.scheduledAt !== undefined || body.scheduled_at !== undefined) {
    patch.scheduled_at = parseRequiredDate(body.scheduledAt || body.scheduled_at, "Choose a valid tour time.").toISOString();
  }
  if (body.notes !== undefined) patch.notes = clean(body.notes);
  if (body.status !== undefined) {
    const status = clean(body.status);
    if (!TOUR_STATUSES.has(status)) validationError("Invalid tour status.");
    patch.status = status;
  }
  if (Object.keys(patch).length === 1) validationError("No tour changes provided.");
  const { data, error } = await db.from("tours").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, tour.location_id, "tour", id, "tour_updated", {
    leadId: tour.lead_id,
    scheduledAt: patch.scheduled_at || tour.scheduled_at
  });
  return syncTourToGoogleCalendar(db, user, data).catch(() => data);
}

function googleOAuthConfig(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const origin = process.env.APP_BASE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    || `${req?.headers?.["x-forwarded-proto"] || "https"}://${req?.headers?.host || ""}`;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${origin}/api/v2/integrations/google-calendar/callback`;
  return { clientId, clientSecret, redirectUri };
}

async function listIntegrations(db, user) {
  const { data, error } = await db
    .from("external_integrations")
    .select("id,provider,status,calendar_id,calendar_name,connected_at,updated_at,last_error")
    .eq("user_id", user.id)
    .in("provider", ["google_calendar", "google_gmail"])
    .limit(5);
  if (error) {
    if (isMissingTableError(error)) return { schemaInstalled: false, integrations: [], message: "Run supabase/google-calendar-v2.sql to enable app integrations." };
    throw error;
  }
  return { schemaInstalled: true, integrations: data || [] };
}

async function createGoogleCalendarConnectUrl(db, user, req) {
  return createGoogleConnectUrl(db, user, req, "google_calendar", GOOGLE_CALENDAR_SCOPE, "Google Calendar");
}

async function createGoogleGmailConnectUrl(db, user, req) {
  return createGoogleConnectUrl(db, user, req, "google_gmail", GOOGLE_GMAIL_SCOPE, "Gmail");
}

async function createGoogleConnectUrl(db, user, req, provider, scope, label) {
  const config = googleOAuthConfig(req);
  if (!config.clientId || !config.clientSecret) {
    validationError(`${label} is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.`);
  }
  const state = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const locationId = clean(req?.query?.locationId || "") || null;
  const { error } = await db.from("external_oauth_states").insert({
    state,
    provider,
    user_id: user.id,
    location_id: locationId,
    redirect_uri: config.redirectUri,
    expires_at: expiresAt
  });
  if (error) {
    if (isMissingTableError(error)) validationError("App integration schema is not installed yet. Run supabase/google-calendar-v2.sql.");
    throw error;
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope,
    state
  });
  return { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, expiresAt };
}

async function handleGoogleCalendarCallback(db, params = {}, req = null) {
  const code = clean(params.code || "");
  const state = clean(params.state || "");
  if (!code || !state) return integrationCallbackHtml("Google connection failed", "Missing OAuth response.");
  const { data: stateRow, error: stateError } = await db.from("external_oauth_states").select("*").eq("state", state).maybeSingle();
  if (stateError) throw stateError;
  const provider = clean(stateRow?.provider || "google_calendar");
  const label = provider === "google_gmail" ? "Gmail" : "Google Calendar";
  const scope = provider === "google_gmail" ? GOOGLE_GMAIL_SCOPE : GOOGLE_CALENDAR_SCOPE;
  if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    return integrationCallbackHtml(`${label} connection expired`, "Return to admin-v2 and connect again.");
  }
  const config = googleOAuthConfig(req);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: stateRow.redirect_uri || config.redirectUri,
      grant_type: "authorization_code"
    })
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) {
    return integrationCallbackHtml(`${label} connection failed`, token.error_description || token.error || "Token exchange failed.");
  }
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  }).catch(() => null);
  const profile = profileRes?.ok ? await profileRes.json() : {};
  const expiresAt = new Date(Date.now() + Math.max(60, Number(token.expires_in || 3600) - 60) * 1000).toISOString();
  const patch = {
    provider,
    user_id: stateRow.user_id,
    location_id: stateRow.location_id || null,
    status: "connected",
    access_token: token.access_token,
    refresh_token: token.refresh_token || null,
    token_expires_at: expiresAt,
    calendar_id: "primary",
    calendar_name: profile.email || (provider === "google_gmail" ? "Gmail inbox" : "Primary calendar"),
    scopes: scope,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null
  };
  const existingQuery = db.from("external_integrations").select("id").eq("provider", provider).eq("user_id", stateRow.user_id);
  const existingRes = stateRow.location_id
    ? await existingQuery.eq("location_id", stateRow.location_id).maybeSingle()
    : await existingQuery.is("location_id", null).maybeSingle();
  if (existingRes.error) throw existingRes.error;
  const writeRes = existingRes.data?.id
    ? await db.from("external_integrations").update(patch).eq("id", existingRes.data.id)
    : await db.from("external_integrations").insert(patch);
  if (writeRes.error) throw writeRes.error;
  await db.from("external_oauth_states").delete().eq("state", state);
  return integrationCallbackHtml(`${label} connected`, provider === "google_gmail" ? "Return to admin-v2 and pull recent inbox messages." : "Return to admin-v2. New scheduled tours will sync to Google Calendar.");
}

function integrationCallbackHtml(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtmlText(title)}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#071417;color:#f5f1e8;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:520px;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:24px;background:rgba(255,255,255,.06)}p{color:#b8c6c0;line-height:1.5}</style></head><body><main class="card"><h1>${escapeHtmlText(title)}</h1><p>${escapeHtmlText(message)}</p><script>setTimeout(()=>{try{window.close()}catch(e){}},1600)</script></main></body></html>`;
}

function escapeHtmlText(value = "") {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function disconnectGoogleCalendar(db, user) {
  const { error } = await db
    .from("external_integrations")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("provider", "google_calendar");
  if (error) {
    if (isMissingTableError(error)) validationError("Google Calendar schema is not installed yet. Run supabase/google-calendar-v2.sql.");
    throw error;
  }
  return { ok: true };
}

async function disconnectGoogleGmail(db, user) {
  const { error } = await db
    .from("external_integrations")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("provider", "google_gmail");
  if (error) {
    if (isMissingTableError(error)) validationError("App integration schema is not installed yet. Run supabase/google-calendar-v2.sql.");
    throw error;
  }
  return { ok: true };
}

async function pullGoogleGmailInbox(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  const integration = await getGoogleIntegration(db, user, "google_gmail", locationIds[0]);
  if (!integration) validationError("Gmail is not connected.");
  const token = await ensureGoogleAccessToken(db, integration);
  const list = await googleApiRequest(token, "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in%3Ainbox%20newer_than%3A30d");
  const messages = list.messages || [];
  let imported = 0;
  for (const item of messages) {
    const message = await googleApiRequest(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
    const headers = Object.fromEntries((message.payload?.headers || []).map((header) => [String(header.name || "").toLowerCase(), header.value || ""]));
    const existing = await safeTableQuery(db.from("communication_messages").select("id").eq("provider", "gmail").eq("provider_message_id", item.id).maybeSingle());
    const row = {
      organization_id: "comfort-care",
      location_id: integration.location_id || locationIds[0],
      direction: "inbound",
      channel: "email",
      provider: "gmail",
      provider_message_id: item.id,
      from_email: cleanEmailHeader(headers.from || ""),
      to_email: cleanEmailHeader(headers.to || integration.calendar_name || user.email || ""),
      subject: clean(headers.subject || "(No subject)").slice(0, 240),
      body: clean(message.snippet || ""),
      status: "received",
      received_at: gmailReceivedAt(headers.date, message.internalDate),
      metadata: { threadId: message.threadId || "", gmailLabelIds: message.labelIds || [] },
      created_by: user.id
    };
    if (existing.schemaInstalled === false) validationError("Run supabase/scope-a-v2.sql to enable Gmail inbox persistence.");
    const write = existing.data?.id
      ? await db.from("communication_messages").update({ ...row, updated_at: new Date().toISOString() }).eq("id", existing.data.id)
      : await db.from("communication_messages").insert(row);
    if (write.error) throw write.error;
    imported += 1;
  }
  return { ok: true, imported };
}

async function sendGoogleGmailMessage(db, integration, message = {}) {
  if (!integration) validationError("Gmail is not connected. Link or reconnect Gmail first.");
  if (!String(integration.scopes || "").includes("gmail.send")) {
    validationError("Gmail needs reconnect for send access. Unlink Gmail, then link again.");
  }
  const token = await ensureGoogleAccessToken(db, integration);
  const from = cleanEmailHeader(integration.calendar_name || "");
  const headers = [
    ...(isValidEmail(from) ? [`From: ${rfc2047(message.fromName || "Comfort Care")} <${from}>`] : []),
    `To: ${message.to}`,
    `Subject: ${rfc2047(message.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8"
  ];
  const mime = [...headers, "", buildBrandedEmail(message.body || "")].join("\r\n");
  const raw = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const data = await googleApiRequest(token, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: { raw }
  }, "Gmail send failed.");
  return { status: "sent", mode: "google_gmail", message: "Sent from staff Gmail.", providerMessageId: data.id || "" };
}

function rfc2047(value = "") {
  const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
  return /^[\x20-\x7E]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text).toString("base64")}?=`;
}

function cleanEmailHeader(value = "") {
  const match = String(value || "").match(/<([^>]+)>/);
  return clean(match ? match[1] : value).toLowerCase();
}

function gmailReceivedAt(headerDate, internalDate) {
  const headerMs = headerDate ? new Date(headerDate).getTime() : 0;
  if (headerMs && !Number.isNaN(headerMs)) return new Date(headerMs).toISOString();
  const internalMs = Number(internalDate || 0);
  if (internalMs && !Number.isNaN(internalMs)) return new Date(internalMs).toISOString();
  return new Date().toISOString();
}

async function syncTourToGoogleCalendar(db, user, tour) {
  const integration = await getGoogleCalendarIntegration(db, user, tour.location_id);
  if (!integration) return tour;
  try {
    const token = await ensureGoogleAccessToken(db, integration);
    const lead = tour.lead_id ? await getEntityById(db, "leads_v2", tour.lead_id).catch(() => null) : null;
    const location = tour.location_id ? await getEntityById(db, "locations", tour.location_id).catch(() => null) : null;
    const existingEventId = clean(tour.external_calendar_event_id || "");
    const inactive = ["cancelled", "no_show"].includes(clean(tour.status).toLowerCase());
    if (inactive && existingEventId) {
      await googleCalendarRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id || "primary")}/events/${encodeURIComponent(existingEventId)}`, { method: "DELETE" });
      return updateTourCalendarSync(db, tour.id, { status: "deleted", eventId: null, error: null });
    }
    const body = googleTourEventBody(tour, lead, location);
    const event = existingEventId
      ? await googleCalendarRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id || "primary")}/events/${encodeURIComponent(existingEventId)}`, { method: "PATCH", body })
      : await googleCalendarRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id || "primary")}/events`, { method: "POST", body });
    await logActivity(db, user, tour.location_id, "tour", tour.id, existingEventId ? "calendar_event_updated" : "calendar_event_created", { provider: "google_calendar", eventId: event.id });
    return updateTourCalendarSync(db, tour.id, { status: "synced", eventId: event.id, error: null });
  } catch (err) {
    await updateTourCalendarSync(db, tour.id, { status: "failed", eventId: tour.external_calendar_event_id || null, error: err.message || "Google Calendar sync failed." }).catch(() => {});
    await db.from("external_integrations").update({ last_error: err.message || "Google Calendar sync failed.", updated_at: new Date().toISOString() }).eq("id", integration.id);
    return tour;
  }
}

async function resyncTourToGoogleCalendar(db, user, id) {
  const tour = await getEntityById(db, "tours", id);
  assertLocationAccess(user, tour.location_id);
  return syncTourToGoogleCalendar(db, user, tour);
}

async function pullTourFromGoogleCalendar(db, user, id) {
  const tour = await getEntityById(db, "tours", id);
  assertLocationAccess(user, tour.location_id);
  const eventId = clean(tour.external_calendar_event_id || "");
  if (!eventId) validationError("This tour has no linked Google Calendar event yet.");
  const integration = await getGoogleCalendarIntegration(db, user, tour.location_id);
  if (!integration) validationError("Google Calendar is not connected.");
  try {
    const token = await ensureGoogleAccessToken(db, integration);
    const event = await googleCalendarRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendar_id || "primary")}/events/${encodeURIComponent(eventId)}`);
    const startValue = event.start?.dateTime || event.start?.date || "";
    const patch = {
      external_calendar_provider: "google_calendar",
      external_calendar_sync_status: event.status === "cancelled" ? "deleted" : "synced",
      external_calendar_synced_at: new Date().toISOString(),
      external_calendar_error: null
    };
    if (startValue && event.status !== "cancelled") patch.scheduled_at = new Date(startValue).toISOString();
    if (event.status === "cancelled") patch.status = "cancelled";
    const { data, error } = await db.from("tours").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    await logActivity(db, user, tour.location_id, "tour", id, "calendar_event_pulled", {
      provider: "google_calendar",
      eventId,
      googleStatus: event.status || "confirmed",
      scheduledAt: patch.scheduled_at || tour.scheduled_at
    });
    return data;
  } catch (err) {
    await updateTourCalendarSync(db, id, { status: "failed", eventId, error: err.message || "Google Calendar pull failed." }).catch(() => {});
    await db.from("external_integrations").update({ last_error: err.message || "Google Calendar pull failed.", updated_at: new Date().toISOString() }).eq("id", integration.id);
    throw err;
  }
}

async function getGoogleCalendarIntegration(db, user, locationId) {
  return getGoogleIntegration(db, user, "google_calendar", locationId);
}

async function getGoogleIntegration(db, user, provider, locationId) {
  const { data, error } = await db
    .from("external_integrations")
    .select("*")
    .eq("provider", provider)
    .eq("user_id", user.id)
    .eq("status", "connected")
    .or(`location_id.is.null,location_id.eq.${locationId}`)
    .order("location_id", { ascending: false })
    .limit(1);
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data?.[0] || null;
}

async function ensureGoogleAccessToken(db, integration) {
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  if (integration.access_token && expiresAt > Date.now() + 60000) return integration.access_token;
  if (!integration.refresh_token) throw new Error("Google Calendar needs reconnect.");
  const config = googleOAuthConfig();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token"
    })
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(token.error_description || token.error || "Google token refresh failed.");
  const nextExpiry = new Date(Date.now() + Math.max(60, Number(token.expires_in || 3600) - 60) * 1000).toISOString();
  await db.from("external_integrations").update({
    access_token: token.access_token,
    token_expires_at: nextExpiry,
    updated_at: new Date().toISOString(),
    last_error: null
  }).eq("id", integration.id);
  return token.access_token;
}

function googleTourEventBody(tour, lead, location) {
  const start = new Date(tour.scheduled_at);
  const end = new Date(start.getTime() + 60 * 60000);
  const leadName = lead?.full_name || lead?.name || "Family tour";
  const locationName = location?.name || "Comfort Care";
  return {
    summary: `Tour: ${leadName}`,
    location: locationName,
    description: [
      `Comfort Care tour for ${leadName}.`,
      tour.notes ? `Notes: ${tour.notes}` : "",
      `Status: ${tour.status || "scheduled"}`,
      "Created from Comfort Care admissions operations."
    ].filter(Boolean).join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: true }
  };
}

async function googleCalendarRequest(accessToken, url, options = {}) {
  return googleApiRequest(accessToken, url, options, "Google Calendar request failed.");
}

async function googleApiRequest(accessToken, url, options = {}, fallbackMessage = "Google request failed.") {
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || data.error_description || fallbackMessage);
  return data;
}

async function updateTourCalendarSync(db, tourId, { status, eventId, error }) {
  const patch = {
    external_calendar_provider: "google_calendar",
    external_calendar_sync_status: status,
    external_calendar_synced_at: new Date().toISOString(),
    external_calendar_error: error || null
  };
  if (eventId !== undefined) patch.external_calendar_event_id = eventId;
  const { data, error: updateError } = await db.from("tours").update(patch).eq("id", tourId).select("*").single();
  if (updateError) throw updateError;
  return data;
}

async function hardDeleteTour(db, user, id, body = {}) {
  const tour = await getEntityById(db, "tours", id);
  assertSuperAdmin(user, "Only super admins can permanently delete tours.");
  assertLocationAccess(user, tour.location_id);
  await writeHardDeleteAudit(db, user, tour.location_id, "tour", id, tour, body);
  const { error } = await db.from("tours").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, tour.location_id, "tour", id, "tour_hard_deleted", { reason: clean(body.reason || "") });
  return { ok: true, deletedId: id };
}

async function createFollowUp(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const dueAt = parseRequiredDate(body.dueAt || body.due_at, "Choose a valid follow-up time.");
  const status = FOLLOW_UP_STATUSES.has(body.status) ? body.status : "open";
  const { data, error } = await db.from("follow_ups").insert({
    location_id: locationId,
    lead_id: clean(body.leadId || body.lead_id) || null,
    resident_id: clean(body.residentId || body.resident_id) || null,
    assigned_to: clean(body.assignedTo || body.assigned_to) || null,
    due_at: dueAt.toISOString(),
    status,
    note: clean(body.note),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "follow_up", data.id, "follow_up_created", { dueAt: dueAt.toISOString() });
  return data;
}

async function updateFollowUpStatus(db, user, id, status) {
  if (!FOLLOW_UP_STATUSES.has(status)) {
    const error = new Error("Invalid follow-up status.");
    error.statusCode = 422;
    throw error;
  }
  const followUp = await getEntityById(db, "follow_ups", id);
  assertLocationAccess(user, followUp.location_id);
  const { data, error } = await db
    .from("follow_ups")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, followUp.location_id, "follow_up", id, "follow_up_status_changed", { status, leadId: followUp.lead_id, residentId: followUp.resident_id });
  return data;
}

async function hardDeleteFollowUp(db, user, id, body = {}) {
  const followUp = await getEntityById(db, "follow_ups", id);
  assertSuperAdmin(user, "Only super admins can permanently delete follow-ups.");
  assertLocationAccess(user, followUp.location_id);
  await writeHardDeleteAudit(db, user, followUp.location_id, "follow_up", id, followUp, body);
  const { error } = await db.from("follow_ups").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, followUp.location_id, "follow_up", id, "follow_up_hard_deleted", { reason: clean(body.reason || "") });
  return { ok: true, deletedId: id };
}

async function createTask(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const title = clean(body.title);
  if (!title) {
    const error = new Error("Task title is required.");
    error.statusCode = 422;
    throw error;
  }
  const status = TASK_STATUSES.has(body.status) ? body.status : "todo";
  const { data, error } = await db.from("staff_tasks").insert({
    location_id: locationId,
    lead_id: clean(body.leadId || body.lead_id) || null,
    resident_id: clean(body.residentId || body.resident_id) || null,
    assigned_to: clean(body.assignedTo || body.assigned_to) || null,
    title,
    task_type: clean(body.taskType || body.task_type || "Other"),
    status,
    due_at: body.dueAt ? new Date(body.dueAt).toISOString() : null,
    notes: clean(body.notes),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "staff_task", data.id, "task_created", { title });
  return data;
}

async function updateTaskStatus(db, user, id, status) {
  if (!TASK_STATUSES.has(status)) {
    const error = new Error("Invalid task status.");
    error.statusCode = 422;
    throw error;
  }
  const task = await getEntityById(db, "staff_tasks", id);
  assertLocationAccess(user, task.location_id);
  const { data, error } = await db
    .from("staff_tasks")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, task.location_id, "staff_task", id, "task_status_changed", { status });
  return data;
}

async function hardDeleteTask(db, user, id, body = {}) {
  const task = await getEntityById(db, "staff_tasks", id);
  assertSuperAdmin(user, "Only super admins can permanently delete tasks.");
  assertLocationAccess(user, task.location_id);
  await writeHardDeleteAudit(db, user, task.location_id, "staff_task", id, task, body);
  const { error } = await db.from("staff_tasks").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, task.location_id, "staff_task", id, "task_hard_deleted", { reason: clean(body.reason || "") });
  return { ok: true, deletedId: id };
}

async function getDailyOperatingPlan(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  const candidates = await buildOperatingPlanCandidates(db, user, locations, locationIds);

  try {
    await syncOperatingPlanCandidates(db, user, candidates);
    await retireStaleOperatingPlanItems(db, user, candidates, locationIds);
    await applyOperatingPlanEscalations(db, user, locationIds);
    let query = db
      .from("operating_plan_items")
      .select("*, locations:location_id(name, city, state)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(200);
    query = selectByLocations(query, locationIds, "location_id");
    query = query.in("status", ["open", "assigned", "snoozed", "escalated"]);
    const { data, error } = await query;
    if (error) throw error;
    const items = (data || []).sort(compareOperatingPlanItems);
    return {
      schemaInstalled: true,
      generatedAt: new Date().toISOString(),
      items,
      summary: summarizeOperatingPlan(items),
      candidates: candidates.length
    };
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const fallback = candidates.map((item) => ({
      ...item,
      id: item.plan_key,
      status: "open",
      schema_fallback: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      locations: { name: locationNameById(locations, item.location_id) }
    })).sort(compareOperatingPlanItems);
    return {
      schemaInstalled: false,
      generatedAt: new Date().toISOString(),
      items: fallback,
      summary: summarizeOperatingPlan(fallback),
      warning: "Run supabase/operating-plan-v2.sql to persist Daily Operating Plan items and enable actions."
    };
  }
}

async function updateOperatingPlanItem(db, user, id, body = {}) {
  const item = await getEntityById(db, "operating_plan_items", id);
  assertLocationAccess(user, item.location_id);
  const action = clean(body.action || body.status || "").toLowerCase();
  const now = new Date().toISOString();
  const patch = {};

  if (action === "complete" || action === "completed") {
    patch.status = "completed";
    patch.completed_at = now;
  } else if (action === "dismiss" || action === "dismissed") {
    patch.status = "dismissed";
    patch.dismissed_at = now;
  } else if (action === "reopen" || action === "open") {
    patch.status = "open";
    patch.snoozed_until = null;
    patch.completed_at = null;
    patch.dismissed_at = null;
  } else if (action === "snooze" || action === "snoozed") {
    const minutes = Math.max(15, Math.min(10080, Number.parseInt(body.minutes || body.snoozeMinutes || "1440", 10) || 1440));
    patch.status = "snoozed";
    patch.snoozed_until = new Date(Date.now() + minutes * 60000).toISOString();
  } else if (action === "assign" || action === "assigned") {
    patch.status = "assigned";
  } else if (OPERATING_PLAN_STATUSES.has(action)) {
    patch.status = action;
  } else {
    validationError("Choose a valid Daily Operating Plan action.");
  }

  const ownerUserId = clean(body.ownerUserId || body.owner_user_id || "");
  const ownerRole = clean(body.ownerRole || body.owner_role || "");
  const dueAt = clean(body.dueAt || body.due_at || "");
  if (ownerUserId) patch.owner_user_id = ownerUserId;
  if (ownerRole) patch.owner_role = ownerRole;
  if (dueAt) patch.due_at = new Date(dueAt).toISOString();

  const metadata = { ...(item.metadata || {}) };
  if ((action === "assign" || action === "assigned") && body.createTask !== false && !metadata.createdTaskId) {
    const task = await createTask(db, user, {
      locationId: item.location_id,
      leadId: metadata.leadId || (item.source_type === "lead" ? item.source_id : ""),
      title: item.recommended_action || item.title,
      taskType: `Operating Plan: ${item.department}`,
      dueAt: patch.due_at || item.due_at || new Date(Date.now() + 4 * 3600000).toISOString(),
      notes: `${item.reason || ""}${item.impact ? `\nImpact: ${item.impact}` : ""}`.trim()
    });
    metadata.createdTaskId = task.id;
    patch.metadata = metadata;
  }

  const { data, error } = await db
    .from("operating_plan_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logActivity(db, user, item.location_id, "operating_plan_item", id, "operating_plan_item_updated", {
    action,
    status: data.status,
    createdTaskId: metadata.createdTaskId || ""
  });
  return data;
}

async function listOperations(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(locationId));
  const [residents, tours, followUps, tasks, notes, documents, emails, roomsRaw] = await Promise.all([
    selectByLocations(db.from("residents_v2").select("*").order("created_at", { ascending: false }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("*").order("scheduled_at", { ascending: true }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*").order("due_at", { ascending: true }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("staff_tasks").select("*").order("created_at", { ascending: false }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("notes").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id"),
    selectByLocations(db.from("documents").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id"),
    selectByLocations(db.from("email_history").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id"),
    selectByLocations(db.from("rooms_v2").select("*").order("room_number", { ascending: true }).limit(500), locationIds, "location_id")
  ]);
  const rooms = roomsRaw?.error && isMissingTableError(roomsRaw.error) ? { data: [] } : roomsRaw;
  throwFirstError(residents, tours, followUps, tasks, notes, documents, emails, rooms);
  return {
    residents: residents.data || [],
    rooms: rooms.data || [],
    tours: tours.data || [],
    followUps: followUps.data || [],
    tasks: tasks.data || [],
    notes: notes.data || [],
    documents: documents.data || [],
    emailHistory: emails.data || []
  };
}

async function listCheckIns(db, user, locationId = "") {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(locationId));
  const allowedLocations = locations.filter((location) => locationIds.includes(location.id));
  const { data, error } = await db
    .from("facility_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (String(error.message || "").toLowerCase().includes("does not exist")) return [];
    throw error;
  }
  if (user.isSuperAdmin && !clean(locationId)) return data || [];
  return (data || []).filter((row) => {
    const community = normalizeLocationName(row.community || row.location || "");
    return allowedLocations.some((location) => {
      const name = normalizeLocationName(location.name);
      const city = normalizeLocationName(location.city);
      return community === name || community.includes(name) || name.includes(community) || (city && community.includes(city));
    });
  });
}

async function listRooms(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  let query = db.from("rooms_v2").select("*").order("room_number", { ascending: true }).limit(500);
  query = selectByLocations(query, locationIds, "location_id");
  const status = clean(params.status || "");
  const careLevel = clean(params.careLevel || params.care_level || params.care_level_supported || "");
  const roomType = clean(params.roomType || params.room_type || "");
  if (status) query = query.or(`current_status.eq.${status},status.eq.${status}`);
  if (careLevel) query = query.or(`care_level_supported.ilike.%${careLevel}%,care_level.ilike.%${careLevel}%`);
  if (roomType) query = query.eq("room_type", roomType);
  const result = await query;
  if (result.error) {
    if (isMissingTableError(result.error)) return [];
    throw result.error;
  }
  return result.data || [];
}

async function getRoomDetail(db, user, id) {
  const room = await getEntityById(db, "rooms_v2", id);
  assertLocationAccess(user, room.location_id);
  const [resident, lead] = await Promise.all([
    room.current_resident_id ? db.from("residents_v2").select("*").eq("id", room.current_resident_id).maybeSingle() : Promise.resolve({ data: null }),
    room.reserved_for_lead_id ? db.from("leads_v2").select("*").eq("id", room.reserved_for_lead_id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  throwFirstError(resident, lead);
  return { room, resident: resident.data || null, reservedLead: lead.data || null };
}

async function getRoomAvailability(db, user, params = {}) {
  const [rooms, leadsResult] = await Promise.all([
    listRooms(db, user, params),
    listLeads(db, user, { locationId: params.locationId || params.location_id || "", limit: 500 })
  ]);
  const leads = leadsResult.leads || [];
  const matches = buildRoomMatches(rooms, leads, { limit: 100 });
  const counts = ["available", "occupied", "reserved", "maintenance", "offline"].reduce((acc, status) => {
    acc[status] = rooms.filter((room) => roomCurrentStatusValue(room) === status).length;
    return acc;
  }, {});
  const revenueRooms = rooms.filter((room) => roomCurrentStatusValue(room) !== "offline");
  const occupiedRooms = rooms.filter((room) => roomCurrentStatusValue(room) === "occupied");
  const availableRooms = rooms.filter((room) => roomCurrentStatusValue(room) === "available");
  const estimatedMonthlyRevenue = occupiedRooms.reduce((sum, room) => sum + roomRevenueValue(room), 0);
  const lostRevenue = availableRooms.reduce((sum, room) => sum + roomRevenueValue(room), 0);
  const nearTermRevenueOpportunity = matches
    .filter((match) => match.score >= 65)
    .reduce((sum, match) => sum + roomRevenueValue(match.room), 0);
  const occupancyRate = revenueRooms.length ? Math.round((occupiedRooms.length / revenueRooms.length) * 100) : 0;
  const signals = buildRoomSignals(rooms, leads, matches, { lostRevenue, occupiedRooms: occupiedRooms.length });
  return {
    counts: { total: rooms.length, ...counts },
    occupancyRate,
    estimatedMonthlyRevenue,
    lostRevenue,
    nearTermRevenueOpportunity,
    matches: matches.slice(0, 10),
    signals,
    generatedAt: new Date().toISOString()
  };
}

async function getRoomMatches(db, user, params = {}) {
  const [rooms, leadsResult] = await Promise.all([
    listRooms(db, user, params),
    listLeads(db, user, { locationId: params.locationId || params.location_id || "", limit: 500 })
  ]);
  const leads = leadsResult.leads || [];
  const roomId = clean(params.roomId || params.room_id || "");
  const leadId = clean(params.leadId || params.lead_id || "");
  const limit = Math.max(1, Math.min(100, Number.parseInt(params.limit || "25", 10) || 25));
  const filteredRooms = roomId ? rooms.filter((room) => room.id === roomId) : rooms;
  const filteredLeads = leadId ? leads.filter((lead) => lead.id === leadId) : leads;
  return { matches: buildRoomMatches(filteredRooms, filteredLeads, { limit }), generatedAt: new Date().toISOString() };
}

async function getRevenueCommand(db, user, params = {}) {
  const requestedLocationId = clean(params.locationId || params.location_id || "");
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, requestedLocationId);
  const [rooms, leadsResult, toursRes, followUpsRes, tasksRes] = await Promise.all([
    listRooms(db, user, params),
    listLeads(db, user, { locationId: requestedLocationId, limit: 500 }),
    selectByLocations(db.from("tours").select("*").order("scheduled_at", { ascending: true }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*").order("due_at", { ascending: true }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("staff_tasks").select("*").order("due_at", { ascending: true }).limit(500), locationIds, "location_id")
  ]);
  const leads = leadsResult.leads || [];
  throwFirstError(toursRes, followUpsRes, tasksRes);

  const now = Date.now();
  const activeLeads = leads.filter((lead) => !["archived", "move_in"].includes(clean(lead.status).toLowerCase()));
  const activeFollowUps = (followUpsRes.data || []).filter((item) => !["completed", "archived", "missed", "done"].includes(clean(item.status).toLowerCase()));
  const activeTours = (toursRes.data || []).filter((tour) => !["completed", "no_show", "cancelled"].includes(clean(tour.status).toLowerCase()));
  const activeTasks = (tasksRes.data || []).filter((task) => !["done", "archived", "completed"].includes(clean(task.status).toLowerCase()));
  const revenueRooms = rooms.filter((room) => roomCurrentStatusValue(room) !== "offline");
  const availableRooms = rooms.filter((room) => roomCurrentStatusValue(room) === "available");
  const reservedRooms = rooms.filter((room) => roomCurrentStatusValue(room) === "reserved");
  const occupiedRooms = rooms.filter((room) => roomCurrentStatusValue(room) === "occupied");
  const blockedRooms = rooms.filter((room) => ["maintenance", "offline"].includes(roomCurrentStatusValue(room)) || ["maintenance", "damaged", "needs_cleaning"].includes(clean(room.condition).toLowerCase()));
  const overdueFollowUps = activeFollowUps.filter((item) => safeDateMs(item.due_at) && safeDateMs(item.due_at) < now);
  const overdueTasks = activeTasks.filter((task) => safeDateMs(task.due_at) && safeDateMs(task.due_at) < now);
  const upcomingTours = activeTours.filter((tour) => {
    const scheduled = safeDateMs(tour.scheduled_at);
    return scheduled && scheduled >= now && scheduled <= now + 7 * 86400000;
  });
  const roomMatches = buildRoomMatches(rooms, activeLeads, { limit: 20 });
  const estimatedMonthlyRevenue = occupiedRooms.reduce((sum, room) => sum + roomRevenueValue(room), 0);
  const lostRevenue = availableRooms.reduce((sum, room) => sum + roomRevenueValue(room), 0);
  const nearTermRevenueOpportunity = roomMatches
    .filter((match) => match.score >= 65)
    .reduce((sum, match) => sum + roomRevenueValue(match.room), 0);
  const roomSignals = buildRoomSignals(rooms, activeLeads, roomMatches, {
    lostRevenue,
    occupiedRooms: occupiedRooms.length
  });

  const scored = activeLeads.map((lead) => {
    const leadFollowUps = activeFollowUps.filter((item) => item.lead_id === lead.id);
    const leadTours = activeTours.filter((tour) => tour.lead_id === lead.id);
    const overdue = leadFollowUps.some((item) => safeDateMs(item.due_at) && safeDateMs(item.due_at) < now);
    const nextTour = leadTours
      .filter((tour) => safeDateMs(tour.scheduled_at) && safeDateMs(tour.scheduled_at) >= now)
      .sort((a, b) => safeDateMs(a.scheduled_at) - safeDateMs(b.scheduled_at))[0] || null;
    const score = estimateLeadIntentScore(lead);
    const staleDays = daysSinceValue(lead.updated_at || lead.created_at, now);
    const probability = estimateMoveInProbabilityValue(lead, score, { overdue, nextTour, staleDays });
    const blocker = revenueLeadBlockerValue(lead, { overdue, nextTour, staleDays });
    return { lead, score, probability, blocker, nextTour, staleDays };
  }).sort((a, b) => b.probability - a.probability || b.score - a.score);

  const opportunities = scored.filter((item) => item.probability >= 40 || item.blocker).slice(0, 8);
  const hotLeadCount = scored.filter((item) => item.probability >= 55).length;
  const revenueAtRisk = opportunities.filter((item) => item.blocker).length * 6500;
  const weightedPipeline = scored.reduce((sum, item) => sum + (6500 * item.probability / 100), 0);
  const blockerCount = overdueFollowUps.length + overdueTasks.length + blockedRooms.length + scored.filter((item) => item.blocker === "Needs contact").length;
  const occupancyRate = revenueRooms.length ? Math.round((occupiedRooms.length / revenueRooms.length) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    source: "backend",
    scope: { locationId: requestedLocationId, locationIds },
    activeLeadCount: activeLeads.length,
    blockerCount,
    hotLeadCount,
    openRooms: availableRooms.length,
    roomCounts: {
      total: rooms.length,
      available: availableRooms.length,
      occupied: occupiedRooms.length,
      reserved: reservedRooms.length,
      blocked: blockedRooms.length,
      maintenance: rooms.filter((room) => roomCurrentStatusValue(room) === "maintenance").length,
      offline: rooms.filter((room) => roomCurrentStatusValue(room) === "offline").length
    },
    opportunities,
    occupancyRate,
    estimatedMonthlyRevenue,
    lostRevenue,
    nearTermRevenueOpportunity,
    revenueAtRisk,
    roomMatches: roomMatches.slice(0, 10),
    roomSignals: roomSignals.slice(0, 12),
    weightedPipeline,
    summary: activeLeads.length
      ? `${hotLeadCount} families look movable now; ${overdueFollowUps.length} follow-ups, ${upcomingTours.length} tours, and ${reservedRooms.length} reserved rooms need tight execution.`
      : "No active pipeline is loaded for the selected scope.",
    roomMessage: availableRooms.length
      ? `${formatCurrency(lostRevenue)} in monthly room revenue is open for conversion.`
      : "No available ready room is visible; check reserved rooms and turnover before committing move-in dates.",
    blockers: [
      { label: "Overdue follow-ups", count: overdueFollowUps.length, view: "followups" },
      { label: "Tours this week", count: upcomingTours.length, view: "tours" },
      { label: "Overdue tasks", count: overdueTasks.length, view: "tasks" },
      { label: "Blocked rooms", count: blockedRooms.length, view: "rooms" },
      { label: "Stale hot leads", count: scored.filter((item) => item.probability >= 55 && item.staleDays >= 7).length, view: "leads" }
    ]
  };
}

function buildRoomMatches(rooms = [], leads = [], options = {}) {
  const activeLeads = leads.filter((lead) => !["archived", "move_in"].includes(clean(lead.status).toLowerCase()));
  const limit = options.limit || 25;
  return rooms
    .filter((room) => roomCurrentStatusValue(room) === "available")
    .flatMap((room) => activeLeads.map((lead) => scoreRoomLeadMatch(room, lead)))
    .filter((match) => match.score >= 35)
    .sort((a, b) => b.score - a.score || roomRevenueValue(b.room) - roomRevenueValue(a.room))
    .slice(0, limit);
}

function scoreRoomLeadMatch(room, lead) {
  let score = 0;
  const reasons = [];
  const disqualifiers = [];
  if (room.location_id === lead.location_id) {
    score += 30;
    reasons.push("same location");
  } else {
    disqualifiers.push("different location");
  }
  const leadCare = normalizeMatchText(lead.care_type || "");
  const roomCare = normalizeMatchText(room.care_level_supported || room.care_level || "");
  if (!roomCare || !leadCare || roomCare.includes(leadCare) || leadCare.includes(roomCare)) {
    score += 25;
    reasons.push("care type fits");
  } else {
    disqualifiers.push("care mismatch");
  }
  const budget = inferLeadBudget(lead);
  const min = Number(room.budget_min || 0);
  const max = Number(room.budget_max || room.monthly_rate || 0);
  const rate = Number(room.monthly_rate || 0);
  if (!budget || (!min && !max && !rate) || (budget >= (min || 0) && budget <= (max || rate || budget))) {
    score += 20;
    reasons.push("budget range fits");
  } else {
    disqualifiers.push("budget outside room range");
  }
  const timeline = normalizeMatchText(lead.move_timeline || "");
  if (timeline.includes("asap") || timeline.includes("immediate") || timeline.includes("30")) {
    score += 15;
    reasons.push("near-term move-in");
  }
  if (estimateLeadIntentScore(lead) >= 55) {
    score += 10;
    reasons.push("high intent");
  }
  const finalScore = disqualifiers.includes("different location") ? Math.min(score, 45) : Math.min(100, score);
  return {
    score: finalScore,
    reasons,
    disqualifiers,
    explanation: `${lead.full_name || "This lead"} fits Room ${room.room_number || ""} because ${reasons.slice(0, 3).join(", ") || "the room is available"}.`,
    room: {
      id: room.id,
      location_id: room.location_id,
      room_number: room.room_number,
      room_type: room.room_type,
      care_level_supported: room.care_level_supported || room.care_level || "",
      monthly_rate: room.monthly_rate,
      current_status: roomCurrentStatusValue(room)
    },
    lead: {
      id: lead.id,
      location_id: lead.location_id,
      full_name: lead.full_name,
      status: lead.status,
      care_type: lead.care_type,
      move_timeline: lead.move_timeline,
      payment_type: lead.payment_type
    }
  };
}

function buildRoomSignals(rooms = [], leads = [], matches = [], metrics = {}) {
  const signals = [];
  const available = rooms.filter((room) => roomCurrentStatusValue(room) === "available");
  const reserved = rooms.filter((room) => roomCurrentStatusValue(room) === "reserved");
  const maintenance = rooms.filter((room) => ["maintenance", "offline"].includes(roomCurrentStatusValue(room)) || ["maintenance", "damaged"].includes(clean(room.condition).toLowerCase()));
  const highIntent = leads.filter((lead) => !["archived", "move_in"].includes(clean(lead.status).toLowerCase()) && estimateLeadIntentScore(lead) >= 55);
  available.forEach((room) => {
    if (!matches.some((match) => match.room.id === room.id)) {
      signals.push({
        type: "available_room_no_match",
        severity: "medium",
        title: `Room ${room.room_number} has no matching lead`,
        detail: "No active lead currently fits this available room by location, care, budget, and timing.",
        roomId: room.id,
        locationId: room.location_id
      });
    }
  });
  highIntent.forEach((lead) => {
    if (!matches.some((match) => match.lead.id === lead.id)) {
      signals.push({
        type: "high_intent_no_room",
        severity: "high",
        title: `${lead.full_name} has no compatible room`,
        detail: "Review care fit, budget, room readiness, or placement at another location.",
        leadId: lead.id,
        locationId: lead.location_id
      });
    }
  });
  if (metrics.lostRevenue > 0) {
    signals.push({
      type: "vacant_room_revenue_risk",
      severity: "high",
      title: "Vacant room revenue risk",
      detail: `${formatCurrency(metrics.lostRevenue)} estimated monthly room revenue is vacant.`
    });
  }
  reserved.forEach((room) => {
    signals.push({
      type: "reserved_room_pending_move_in",
      severity: "medium",
      title: `Room ${room.room_number} is reserved`,
      detail: "Confirm move-in date, paperwork, and blockers before the hold goes stale.",
      roomId: room.id,
      locationId: room.location_id
    });
  });
  maintenance.forEach((room) => {
    signals.push({
      type: "maintenance_room_blocks_occupancy",
      severity: "high",
      title: `Room ${room.room_number} blocks occupancy`,
      detail: "Maintenance or offline status is preventing this room from converting demand.",
      roomId: room.id,
      locationId: room.location_id
    });
  });
  const total = rooms.filter((room) => roomCurrentStatusValue(room) !== "offline").length;
  if (total && Math.round(((metrics.occupiedRooms || 0) / total) * 100) < 85) {
    signals.push({
      type: "location_occupancy_below_target",
      severity: "medium",
      title: "Occupancy below target",
      detail: "Prioritize high-fit leads against available rooms."
    });
  }
  return signals.slice(0, 12);
}

function roomCurrentStatusValue(room = {}) {
  return clean(room.current_status || room.status || "available").toLowerCase();
}

function roomRevenueValue(room = {}) {
  return Number(room.monthly_rate || room.budget_min || room.budget_max || 6500) || 6500;
}

function normalizeMatchText(value = "") {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferLeadBudget(lead = {}) {
  const text = `${lead.payment_type || ""} ${lead.notes_summary || ""} ${lead.current_situation || ""}`;
  const match = text.match(/\$?\s*(\d{4,5})/);
  return match ? Number(match[1]) : 0;
}

function daysSinceValue(value, now = Date.now()) {
  const time = safeDateMs(value);
  if (!time) return 0;
  return Math.max(0, (now - time) / 86400000);
}

function estimateMoveInProbabilityValue(lead = {}, score = 0, context = {}) {
  const statusBonus = { new: 6, contacted: 16, tour_scheduled: 32 }[clean(lead.status).toLowerCase()] || 10;
  const tourBonus = context.nextTour ? 18 : 0;
  const overduePenalty = context.overdue ? 10 : 0;
  const stalePenalty = context.staleDays >= 14 ? 14 : context.staleDays >= 7 ? 7 : 0;
  return Math.max(5, Math.min(92, Math.round((score * 0.52) + statusBonus + tourBonus - overduePenalty - stalePenalty)));
}

function revenueLeadBlockerValue(lead = {}, context = {}) {
  if (context.overdue) return "Overdue follow-up";
  if (!lead.phone && !lead.email) return "Needs contact";
  if (context.staleDays >= 14) return "Stale opportunity";
  if (clean(lead.status).toLowerCase() === "tour_scheduled" && !context.nextTour) return "Tour needs confirmation";
  return "";
}

function estimateLeadIntentScore(lead = {}) {
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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

async function createRoom(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const roomNumber = clean(body.roomNumber || body.room_number);
  if (!roomNumber) validationError("Room number is required.");
  const currentResidentId = clean(body.currentResidentId || body.current_resident_id);
  const reservedForLeadId = clean(body.reservedForLeadId || body.reserved_for_lead_id);
  if (currentResidentId) {
    const resident = await getEntityById(db, "residents_v2", currentResidentId);
    assertLocationAccess(user, resident.location_id);
    if (resident.location_id !== locationId) validationError("Resident must belong to the same location as the room.");
  }
  if (reservedForLeadId) {
    const lead = await getEntityById(db, "leads_v2", reservedForLeadId);
    assertLocationAccess(user, lead.location_id);
    if (lead.location_id !== locationId) validationError("Lead must belong to the same location as the room.");
  }
  const patch = roomPatchFromBody(body, { currentResidentId, reservedForLeadId });
  const { data, error } = await db.from("rooms_v2").insert({
    ...patch,
    location_id: locationId,
    room_number: roomNumber,
    created_by: user.id
  }).select("*").single();
  if (error) {
    if (isMissingTableError(error)) validationError("Rooms table is not installed yet. Run supabase/rooms-v2.sql.");
    throw error;
  }
  await logActivity(db, user, locationId, "room", data.id, "room_created", { roomNumber });
  return data;
}

async function updateRoom(db, user, id, body = {}) {
  const room = await getEntityById(db, "rooms_v2", id);
  assertLocationAccess(user, room.location_id);
  const currentResidentId = clean(body.currentResidentId || body.current_resident_id);
  const reservedForLeadId = clean(body.reservedForLeadId || body.reserved_for_lead_id);
  if (currentResidentId) {
    const resident = await getEntityById(db, "residents_v2", currentResidentId);
    assertLocationAccess(user, resident.location_id);
    if (resident.location_id !== room.location_id) validationError("Resident must belong to the same location as the room.");
  }
  if (reservedForLeadId) {
    const lead = await getEntityById(db, "leads_v2", reservedForLeadId);
    assertLocationAccess(user, lead.location_id);
    if (lead.location_id !== room.location_id) validationError("Lead must belong to the same location as the room.");
  }
  const patch = roomPatchFromBody(body, { currentResidentId, reservedForLeadId });
  if (body.roomNumber !== undefined || body.room_number !== undefined) {
    const roomNumber = clean(body.roomNumber || body.room_number);
    if (!roomNumber) validationError("Room number is required.");
    patch.room_number = roomNumber;
  }
  patch.updated_at = new Date().toISOString();
  const { data, error } = await db.from("rooms_v2").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, room.location_id, "room", id, "room_updated", { status: data.status, condition: data.condition });
  await ensureMoveInWorkflowForReservedRoom(db, user, data).catch((err) => {
    if (!isMissingTableError(err)) console.error("move-in workflow reservation failed:", err.message);
  });
  return data;
}

async function archiveRoom(db, user, id, body = {}) {
  const room = await getEntityById(db, "rooms_v2", id);
  assertLocationAccess(user, room.location_id);
  const note = clean(body.note || body.notes || "");
  const notes = [room.notes, note ? `[Offline] ${note}` : ""].filter(Boolean).join("\n");
  const { data, error } = await db.from("rooms_v2").update({
    status: "offline",
    current_status: "offline",
    notes,
    updated_at: new Date().toISOString()
  }).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, room.location_id, "room", id, "room_marked_offline", { note });
  return data;
}

async function hardDeleteRoom(db, user, id, body = {}) {
  const room = await getEntityById(db, "rooms_v2", id);
  assertSuperAdmin(user, "Only super admins can permanently delete rooms.");
  assertLocationAccess(user, room.location_id);
  const status = roomCurrentStatusValue(room);
  if (room.current_resident_id || room.reserved_for_lead_id || ["occupied", "reserved"].includes(status)) {
    validationError("Clear occupied/reserved room state before permanent delete.");
  }
  await writeHardDeleteAudit(db, user, room.location_id, "room", id, room, body);
  const { error } = await db.from("rooms_v2").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, room.location_id, "room", id, "room_hard_deleted", { reason: clean(body.reason || "") });
  return { ok: true, deletedId: id };
}

function roomPatchFromBody(body = {}, links = {}) {
  const status = clean(body.currentStatus || body.current_status || body.status || "available").toLowerCase();
  const condition = clean(body.condition || "ready").toLowerCase();
  if (!ROOM_STATUSES.has(status)) validationError("Invalid room status.");
  if (!ROOM_CONDITIONS.has(condition)) validationError("Invalid room condition.");
  const capacity = Number.parseInt(body.capacity || "1", 10);
  if (!Number.isFinite(capacity) || capacity < 1) validationError("Room capacity must be at least 1.");
  const monthlyRate = clean(body.monthlyRate || body.monthly_rate);
  const budgetMin = clean(body.budgetMin || body.budget_min);
  const budgetMax = clean(body.budgetMax || body.budget_max);
  const careLevel = clean(body.careLevelSupported || body.care_level_supported || body.careLevel || body.care_level);
  return {
    organization_id: clean(body.organizationId || body.organization_id || "comfort-care"),
    room_name: clean(body.roomName || body.room_name),
    room_type: clean(body.roomType || body.room_type || "private"),
    floor: clean(body.floor),
    capacity,
    status,
    current_status: status,
    condition,
    monthly_rate: monthlyRate ? Number(monthlyRate) : null,
    budget_min: budgetMin ? Number(budgetMin) : null,
    budget_max: budgetMax ? Number(budgetMax) : null,
    care_level: careLevel,
    care_level_supported: careLevel,
    current_resident_id: links.currentResidentId || null,
    reserved_for_lead_id: links.reservedForLeadId || null,
    target_move_in_date: clean(body.targetMoveInDate || body.target_move_in_date) || null,
    notes: clean(body.notes),
    last_cleaned_at: clean(body.lastCleanedAt || body.last_cleaned_at) || null,
    last_maintenance_at: clean(body.lastMaintenanceAt || body.last_maintenance_at) || null
  };
}

async function syncRoomForResident(db, resident = {}, state = {}) {
  const roomNumber = clean(resident.room_number || "");
  if (!roomNumber || !resident.location_id) return;
  const patch = {
    updated_at: new Date().toISOString()
  };
  if (state.status) patch.status = state.status;
  if (state.status) patch.current_status = state.status;
  if (state.condition) patch.condition = state.condition;
  if (Object.prototype.hasOwnProperty.call(state, "currentResidentId")) patch.current_resident_id = state.currentResidentId;
  if (state.notes) patch.notes = state.notes;
  try {
    const { error } = await db
      .from("rooms_v2")
      .update(patch)
      .eq("location_id", resident.location_id)
      .eq("room_number", roomNumber);
    if (error && !isMissingTableError(error)) throw error;
  } catch (err) {
    if (!isMissingTableError(err)) console.error("room sync failed:", err.message);
  }
}

async function ensureMoveInWorkflowForReservedRoom(db, user, room = {}) {
  const status = roomCurrentStatusValue(room);
  const leadId = clean(room.reserved_for_lead_id || "");
  if (status !== "reserved" || !leadId) return null;
  const lead = await getEntityById(db, "leads_v2", leadId);
  assertLocationAccess(user, lead.location_id);
  if (lead.location_id !== room.location_id) validationError("Lead and room must belong to the same location.");
  const existing = await db
    .from("workflow_instances")
    .select("id")
    .eq("workflow_type", "move_in")
    .eq("lead_id", lead.id)
    .eq("room_id", room.id)
    .in("status", ["active", "blocked"])
    .limit(1);
  if (existing.error) throw existing.error;
  if (existing.data?.length) return existing.data[0];
  const template = await db
    .from("workflow_templates")
    .select("id")
    .eq("organization_id", room.organization_id || "comfort-care")
    .eq("workflow_type", "move_in")
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (template.error) throw template.error;
  const dueAt = room.target_move_in_date
    ? new Date(`${room.target_move_in_date}T17:00:00`).toISOString()
    : new Date(Date.now() + 7 * 86400000).toISOString();
  const instance = await db.from("workflow_instances").insert({
    organization_id: room.organization_id || "comfort-care",
    location_id: room.location_id,
    template_id: template.data?.id || null,
    workflow_type: "move_in",
    title: `Move-in prep: ${lead.full_name || "Lead"} -> Room ${room.room_number || ""}`.trim(),
    status: "active",
    priority: estimateLeadIntentScore(lead) >= 55 ? "high" : "medium",
    owner_role: "location_admin",
    lead_id: lead.id,
    room_id: room.id,
    due_at: dueAt,
    metadata: { roomNumber: room.room_number || "", source: "room_reserved" },
    created_by: user.id
  }).select("*").single();
  if (instance.error) throw instance.error;
  const steps = [
    { key: "room_hold", title: "Room hold confirmed", department: "admissions", status: "completed", sequence: 10, dueHours: 0 },
    { key: "assessment", title: "Assessment complete or waived", department: "admissions", status: "todo", sequence: 20, dueHours: 24 },
    { key: "paperwork", title: "Paperwork and family decision ready", department: "admissions", status: "todo", sequence: 30, dueHours: 48 },
    { key: "room_ready", title: "Room ready for move-in", department: room.condition === "ready" ? "housekeeping" : "maintenance", status: room.condition === "ready" ? "completed" : "todo", sequence: 40, dueHours: 48 },
    { key: "move_in_scheduled", title: "Move-in date scheduled", department: "admissions", status: room.target_move_in_date ? "completed" : "todo", sequence: 50, dueHours: 72 }
  ];
  const stepRows = steps.map((step) => ({
    organization_id: room.organization_id || "comfort-care",
    location_id: room.location_id,
    workflow_instance_id: instance.data.id,
    step_key: step.key,
    title: step.title,
    department: step.department,
    status: step.status,
    sequence: step.sequence,
    owner_role: "location_admin",
    due_at: new Date(Date.now() + step.dueHours * 3600000).toISOString(),
    completed_at: step.status === "completed" ? new Date().toISOString() : null,
    metadata: { leadId: lead.id, roomId: room.id, roomNumber: room.room_number || "" },
    created_by: user.id
  }));
  const insertedSteps = await db.from("workflow_steps").insert(stepRows);
  if (insertedSteps.error) throw insertedSteps.error;
  await db.from("workflow_events").insert({
    organization_id: room.organization_id || "comfort-care",
    location_id: room.location_id,
    workflow_instance_id: instance.data.id,
    actor_id: user.id,
    event_type: "room_reserved",
    message: "Move-in workflow started from room hold.",
    metadata: { leadId: lead.id, roomId: room.id, roomNumber: room.room_number || "" },
    created_by: user.id
  });
  await logActivity(db, user, room.location_id, "workflow", instance.data.id, "move_in_workflow_started", {
    leadId: lead.id,
    roomId: room.id
  });
  return instance.data;
}

async function createResident(db, user, body = {}) {
  let locationId = clean(body.locationId || body.location_id);
  const leadId = clean(body.leadId || body.lead_id);
  const roomId = clean(body.roomId || body.room_id);
  if (!roomId) validationError("Choose an available room before adding a resident.");
  const room = await getEntityById(db, "rooms_v2", roomId);
  assertLocationAccess(user, room.location_id);
  locationId = room.location_id;
  if (leadId) {
    const lead = await getEntityById(db, "leads_v2", leadId);
    assertLocationAccess(user, lead.location_id);
    if (lead.location_id !== locationId) validationError("Lead and room must belong to the same location.");
  }
  assertLocationAccess(user, locationId);
  const roomStatus = clean(room.current_status || room.status || "available").toLowerCase();
  if (!["available", "reserved"].includes(roomStatus)) validationError("Choose a room that is available or reserved.");
  if (room.current_resident_id) validationError("This room is already linked to a resident.");
  if (roomStatus === "reserved" && room.reserved_for_lead_id && leadId && room.reserved_for_lead_id !== leadId) {
    validationError("This room is reserved for another lead.");
  }
  if (roomStatus === "reserved" && room.reserved_for_lead_id && !leadId) {
    validationError("This room is reserved for a lead. Select the linked lead before creating the resident.");
  }
  const fullName = clean(body.fullName || body.full_name || body.name);
  if (!fullName) {
    const error = new Error("Resident name is required.");
    error.statusCode = 422;
    throw error;
  }
  const { data, error } = await db.rpc("complete_move_in_v2", {
    p_actor_id: user.id,
    p_location_id: locationId,
    p_room_id: room.id,
    p_lead_id: leadId || null,
    p_full_name: fullName,
    p_care_level: clean(body.careLevel || body.care_level || room.care_level_supported || room.care_level || "Assisted Living"),
    p_move_in_date: clean(body.moveInDate || body.move_in_date) || null,
    p_emergency_contact_name: clean(body.emergencyContactName || body.emergency_contact_name),
    p_emergency_contact_phone: clean(body.emergencyContactPhone || body.emergency_contact_phone),
    p_notes: clean(body.notes)
  });
  if (error) {
    if (String(error.message || "").includes("complete_move_in_v2")) {
      validationError("Atomic move-in function is not installed yet. Run supabase/complete-move-in-v2.sql.");
    }
    throw error;
  }
  return data?.resident || data;
}

async function listWorkflows(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  const type = clean(params.type || params.workflowType || params.workflow_type || "");
  const status = clean(params.status || "");
  let query = db.from("workflow_instances").select("*").order("created_at", { ascending: false }).limit(200);
  query = selectByLocations(query, locationIds, "location_id");
  if (type) query = query.eq("workflow_type", type);
  if (status) query = query.eq("status", status);
  const instances = await query;
  if (instances.error) {
    if (isMissingTableError(instances.error)) {
      return { schemaInstalled: false, workflows: [], warning: "Run supabase/workflow-v2.sql to enable workflow orchestration." };
    }
    throw instances.error;
  }
  const rows = instances.data || [];
  if (!rows.length) return { schemaInstalled: true, workflows: [] };
  const ids = rows.map((row) => row.id);
  const [steps, events] = await Promise.all([
    db.from("workflow_steps").select("*").in("workflow_instance_id", ids).order("sequence", { ascending: true }),
    db.from("workflow_events").select("*").in("workflow_instance_id", ids).order("created_at", { ascending: false }).limit(500)
  ]);
  throwFirstError(steps, events);
  return {
    schemaInstalled: true,
    workflows: rows.map((row) => ({
      ...row,
      steps: (steps.data || []).filter((step) => step.workflow_instance_id === row.id),
      events: (events.data || []).filter((event) => event.workflow_instance_id === row.id)
    }))
  };
}

async function getEscalationSummary(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const now = Date.now();
  const result = {
    generatedAt: new Date().toISOString(),
    scope: { locationIds },
    summary: { total: 0, escalatedPlanItems: 0, overduePlanItems: 0, blockedWorkflows: 0, locationsAtRisk: 0 },
    locations: [],
    planItems: [],
    workflows: [],
    schemaInstalled: true
  };

  try {
    let planQuery = db
      .from("operating_plan_items")
      .select("*, locations:location_id(name, city, state)")
      .in("status", ["open", "assigned", "snoozed", "escalated"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200);
    planQuery = selectByLocations(planQuery, locationIds, "location_id");
    const { data: planRows, error: planError } = await planQuery;
    if (planError) throw planError;
    const planItems = (planRows || []).filter((item) => {
      const due = safeDateMs(item.snoozed_until && item.status === "snoozed" ? item.snoozed_until : item.due_at);
      return item.status === "escalated" || Number(item.ignored_count || 0) > 0 || (due && due < now);
    });

    let workflowQuery = db
      .from("workflow_instances")
      .select("*")
      .in("status", ["active", "blocked"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200);
    workflowQuery = selectByLocations(workflowQuery, locationIds, "location_id");
    const workflowsRes = await workflowQuery;
    if (workflowsRes.error) {
      if (!isMissingTableError(workflowsRes.error)) throw workflowsRes.error;
      result.schemaInstalled = false;
    }
    const workflows = result.schemaInstalled
      ? (workflowsRes.data || []).filter((workflow) => {
        const due = safeDateMs(workflow.due_at);
        return workflow.status === "blocked" || workflow.escalation_status !== "none" || (due && due < now);
      })
      : [];

    const byLocation = new Map(locationIds.map((id) => [id, {
      locationId: id,
      name: locationById.get(id)?.name || "Unknown location",
      escalatedPlanItems: 0,
      overduePlanItems: 0,
      ignoredPlanItems: 0,
      blockedWorkflows: 0,
      riskScore: 0
    }]));

    planItems.forEach((item) => {
      const row = byLocation.get(item.location_id);
      if (!row) return;
      const due = safeDateMs(item.snoozed_until && item.status === "snoozed" ? item.snoozed_until : item.due_at);
      const overdue = due && due < now;
      if (item.status === "escalated") row.escalatedPlanItems += 1;
      if (overdue) row.overduePlanItems += 1;
      if (Number(item.ignored_count || 0) > 0) row.ignoredPlanItems += Number(item.ignored_count || 0);
    });
    workflows.forEach((workflow) => {
      const row = byLocation.get(workflow.location_id);
      if (row) row.blockedWorkflows += 1;
    });
    byLocation.forEach((row) => {
      row.riskScore = (row.escalatedPlanItems * 5) + (row.blockedWorkflows * 4) + (row.overduePlanItems * 2) + row.ignoredPlanItems;
    });

    result.planItems = planItems.slice(0, 25);
    result.workflows = workflows.slice(0, 25);
    result.locations = [...byLocation.values()].filter((row) => row.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);
    result.summary = {
      total: result.planItems.length + result.workflows.length,
      escalatedPlanItems: planItems.filter((item) => item.status === "escalated").length,
      overduePlanItems: planItems.filter((item) => {
        const due = safeDateMs(item.snoozed_until && item.status === "snoozed" ? item.snoozed_until : item.due_at);
        return due && due < now;
      }).length,
      blockedWorkflows: workflows.length,
      locationsAtRisk: result.locations.length
    };
    return result;
  } catch (err) {
    if (isMissingTableError(err)) return { ...result, schemaInstalled: false, warning: "Run supabase/operating-plan-v2.sql and supabase/workflow-v2.sql to enable escalation summary." };
    throw err;
  }
}

async function getPlacementDesk(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const [leadsRes, roomsRaw] = await Promise.all([
    selectByLocations(db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(1000), locationIds, "location_id"),
    selectByLocations(db.from("rooms_v2").select("*").order("room_number", { ascending: true }).limit(1000), locationIds, "location_id")
  ]);
  const roomsRes = roomsRaw?.error && isMissingTableError(roomsRaw.error) ? { data: [] } : roomsRaw;
  throwFirstError(leadsRes, roomsRes);
  const leads = (leadsRes.data || []).filter((lead) => !["archived", "move_in"].includes(clean(lead.status).toLowerCase()));
  const rooms = roomsRes.data || [];
  const allMatches = buildRoomMatches(rooms, leads, { limit: 500 });
  const sameLocationMatches = allMatches.filter((match) => match.room.location_id === match.lead.location_id);
  const crossLocationMatches = allMatches.filter((match) => match.room.location_id !== match.lead.location_id && match.score >= 35);
  const leadIdsWithSameLocationRoom = new Set(sameLocationMatches.map((match) => match.lead.id));
  const placementOpportunities = crossLocationMatches
    .filter((match) => !leadIdsWithSameLocationRoom.has(match.lead.id))
    .map((match) => ({
      ...match,
      currentLocationName: locationById.get(match.lead.location_id)?.name || "Current location",
      suggestedLocationName: locationById.get(match.room.location_id)?.name || "Suggested location",
      transferReason: `${match.lead.full_name || "Lead"} has no strong same-location room fit, but Room ${match.room.room_number || ""} at ${locationById.get(match.room.location_id)?.name || "another location"} fits care, budget, and timing.`
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
  const noFitLeads = leads
    .filter((lead) => estimateLeadIntentScore(lead) >= 55 && !allMatches.some((match) => match.lead.id === lead.id))
    .slice(0, 25)
    .map((lead) => ({
      id: lead.id,
      full_name: lead.full_name,
      location_id: lead.location_id,
      locationName: locationById.get(lead.location_id)?.name || "Current location",
      care_type: lead.care_type,
      move_timeline: lead.move_timeline,
      score: estimateLeadIntentScore(lead)
    }));
  const availableRoomsByLocation = [...groupRoomsByLocation(rooms.filter((room) => roomCurrentStatusValue(room) === "available"), locationById).values()];
  return {
    generatedAt: new Date().toISOString(),
    scope: { locationIds },
    summary: {
      crossLocationOpportunities: placementOpportunities.length,
      highIntentNoFit: noFitLeads.length,
      availableRooms: rooms.filter((room) => roomCurrentStatusValue(room) === "available").length
    },
    opportunities: placementOpportunities,
    noFitLeads,
    availableRoomsByLocation
  };
}

function groupRoomsByLocation(rooms = [], locationById = new Map()) {
  const groups = new Map();
  rooms.forEach((room) => {
    const key = room.location_id || "";
    if (!groups.has(key)) groups.set(key, {
      locationId: key,
      name: locationById.get(key)?.name || "Unknown location",
      availableRooms: 0,
      monthlyRevenue: 0
    });
    const row = groups.get(key);
    row.availableRooms += 1;
    row.monthlyRevenue += roomRevenueValue(room);
  });
  return groups;
}

async function updateWorkflowStep(db, user, id, body = {}) {
  const step = await getEntityById(db, "workflow_steps", id);
  assertLocationAccess(user, step.location_id);
  const status = clean(body.status || body.action || "").toLowerCase();
  if (!["todo", "in_progress", "blocked", "completed", "skipped"].includes(status)) validationError("Invalid workflow step status.");
  const blockedReason = clean(body.blockedReason || body.blocked_reason || "");
  const patch = {
    status,
    blocked_reason: status === "blocked" ? blockedReason : "",
    completed_at: ["completed", "skipped"].includes(status) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
    metadata: { ...(step.metadata || {}), ...(body.metadata || {}) }
  };
  const { data, error } = await db.from("workflow_steps").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await db.from("workflow_events").insert({
    organization_id: data.organization_id || "comfort-care",
    location_id: data.location_id,
    workflow_instance_id: data.workflow_instance_id,
    workflow_step_id: data.id,
    actor_id: user.id,
    event_type: `step_${status}`,
    message: status === "blocked" ? blockedReason : `Step marked ${status}.`,
    metadata: { status, blockedReason },
    created_by: user.id
  });
  await logActivity(db, user, data.location_id, "workflow_step", data.id, "workflow_step_updated", {
    workflowId: data.workflow_instance_id,
    status,
    blockedReason
  });
  await syncWorkflowInstanceStatus(db, data.workflow_instance_id);
  return data;
}

async function syncWorkflowInstanceStatus(db, workflowId) {
  const { data: steps, error } = await db.from("workflow_steps").select("status").eq("workflow_instance_id", workflowId);
  if (error) throw error;
  const rows = steps || [];
  const allDone = rows.length && rows.every((step) => ["completed", "skipped"].includes(clean(step.status).toLowerCase()));
  const blocked = rows.some((step) => clean(step.status).toLowerCase() === "blocked");
  const active = rows.some((step) => ["todo", "in_progress"].includes(clean(step.status).toLowerCase()));
  const status = allDone ? "completed" : blocked ? "blocked" : active ? "active" : "active";
  const patch = {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const { error: updateError } = await db.from("workflow_instances").update(patch).eq("id", workflowId);
  if (updateError) throw updateError;
}

async function updateResidentStatus(db, user, id, body = {}) {
  const resident = await getEntityById(db, "residents_v2", id);
  assertLocationAccess(user, resident.location_id);
  const status = clean(body.status || "active").toLowerCase();
  if (!["active", "moved_out", "inactive"].includes(status)) validationError("Invalid resident status.");
  const roomCondition = clean(body.roomCondition || body.room_condition || "");
  const conditionNotes = clean(body.conditionNotes || body.condition_notes || body.notes || "");
  const leftAt = clean(body.leftAt || body.left_at) || new Date().toISOString();
  const noteLine = status === "moved_out"
    ? `[Room turnover ${new Date(leftAt).toISOString()}] Condition: ${roomCondition || "not captured"}. ${conditionNotes}`.trim()
    : "";
  const notes = noteLine ? [resident.notes, noteLine].filter(Boolean).join("\n") : resident.notes;
  const patch = {
    status,
    notes,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db.from("residents_v2").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  if (status === "moved_out") {
    await syncRoomForResident(db, resident, {
      status: roomCondition && roomCondition !== "ready" ? "maintenance" : "available",
      condition: roomCondition || "ready",
      currentResidentId: null,
      notes: conditionNotes
    });
  } else if (status === "active") {
    await syncRoomForResident(db, data, { status: "occupied", currentResidentId: data.id });
  }

  if (status === "moved_out") {
    try {
      await db.from("notes").insert({
        location_id: resident.location_id,
        entity_type: "resident",
        entity_id: resident.id,
        body: noteLine || "Resident moved out. Room condition was not captured.",
        visibility: "internal",
        created_by: user.id
      });
    } catch (err) {
      console.error("room turnover note failed:", err.message);
    }
    if (roomCondition && roomCondition !== "ready") {
      try {
        await db.from("staff_tasks").insert({
          location_id: resident.location_id,
          resident_id: resident.id,
          title: `Turnover room ${resident.room_number || "unassigned"} after ${resident.full_name}`,
          task_type: "room_turnover",
          status: "todo",
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notes: `Room condition: ${roomCondition}. ${conditionNotes}`.trim(),
          created_by: user.id
        });
      } catch (err) {
        console.error("room turnover task failed:", err.message);
      }
    }
  }

  await logActivity(db, user, resident.location_id, "resident", id, "resident_status_changed", {
    status,
    roomNumber: resident.room_number,
    roomCondition,
    conditionNotes
  });
  return data;
}

async function hardDeleteResident(db, user, id, body = {}) {
  const resident = await getEntityById(db, "residents_v2", id);
  assertSuperAdmin(user, "Only super admins can permanently delete residents.");
  assertLocationAccess(user, resident.location_id);
  await writeHardDeleteAudit(db, user, resident.location_id, "resident", id, resident, body);
  await db.from("rooms_v2").update({
    current_resident_id: null,
    current_status: "available",
    status: "available",
    updated_at: new Date().toISOString()
  }).eq("current_resident_id", id);
  const { error } = await db.from("residents_v2").delete().eq("id", id);
  if (error) throw error;
  await logActivity(db, user, resident.location_id, "resident", id, "resident_hard_deleted", { reason: clean(body.reason || "") });
  return { ok: true, deletedId: id };
}

async function createNote(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const note = clean(body.body || body.note);
  if (!note) {
    const error = new Error("Note is required.");
    error.statusCode = 422;
    throw error;
  }
  const { data, error } = await db.from("notes").insert({
    location_id: locationId,
    entity_type: clean(body.entityType || body.entity_type || "location"),
    entity_id: clean(body.entityId || body.entity_id) || locationId,
    body: note,
    visibility: clean(body.visibility || "internal"),
    mentioned_user_ids: Array.isArray(body.mentionedUserIds) ? body.mentionedUserIds : [],
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, data.entity_type, data.entity_id, "note_added", {});
  return data;
}

async function createDocumentRecord(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const fileName = clean(body.fileName || body.file_name);
  const storagePath = clean(body.storagePath || body.storage_path);
  if (!fileName || !storagePath) {
    const error = new Error("Document filename and storage path are required.");
    error.statusCode = 422;
    throw error;
  }
  const { data, error } = await db.from("documents").insert({
    location_id: locationId,
    entity_type: clean(body.entityType || body.entity_type || "location"),
    entity_id: clean(body.entityId || body.entity_id) || null,
    bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    file_name: fileName,
    file_type: clean(body.fileType || body.file_type),
    file_size: Number(body.fileSize || body.file_size || 0),
    document_type: clean(body.documentType || body.document_type || "Other"),
    notes: clean(body.notes),
    uploaded_by: user.id,
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, locationId, "document", data.id, "document_uploaded", { fileName });
  return data;
}

async function createSignedUpload(db, user, body = {}) {
  const locationId = clean(body.locationId || body.location_id);
  assertLocationAccess(user, locationId);
  const fileName = safeFileName(clean(body.fileName || body.file_name || "document"));
  const entityType = clean(body.entityType || body.entity_type || "location");
  const entityId = clean(body.entityId || body.entity_id || "general");
  const storagePath = `${locationId}/${entityType}/${entityId}/${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${fileName}`;
  const { data, error } = await db.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(storagePath);
  if (error) throw error;
  return { bucket: DOCUMENT_BUCKET, storagePath, ...data };
}

async function getSignedDocumentUrl(db, user, documentId) {
  const doc = await getEntityById(db, "documents", documentId);
  assertLocationAccess(user, doc.location_id);
  const { data, error } = await db.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 60 * 10);
  if (error) throw error;
  return { url: data.signedUrl };
}

async function listUsers(db, user) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can manage users.");
    error.statusCode = 403;
    throw error;
  }
  const { data, error } = await db
    .from("profiles")
    .select("*, user_location_access(location_id, access_level, locations(name, slug))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createUserWithAccess(db, user, body = {}) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can create users.");
    error.statusCode = 403;
    throw error;
  }
  const email = clean(body.email).toLowerCase();
  const password = String(body.password || "");
  const fullName = clean(body.fullName || body.full_name || body.name);
  const role = USER_ROLES.has(body.role) ? body.role : "staff";
  const requestedLocations = Array.isArray(body.locationIds)
    ? body.locationIds.map(clean).filter(Boolean)
    : [clean(body.locationId || body.location_id)].filter(Boolean);
  if (!fullName) validationError("Full name is required.");
  if (!isValidEmail(email)) validationError("Enter a valid email address.");
  if (password.length < 8) validationError("Password must be at least 8 characters.");

  const allLocations = await getLocations(db, user);
  const allowedLocationIds = new Set(allLocations.map((location) => location.id));
  const locationIds = role === "super_admin" && !requestedLocations.length
    ? allLocations.map((location) => location.id)
    : requestedLocations.filter((id) => allowedLocationIds.has(id));
  if (!locationIds.length) validationError("Choose at least one valid location.");

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (createError) throw createError;
  const newUserId = created.user.id;

  const { error: profileError } = await db.from("profiles").upsert({
    id: newUserId,
    full_name: fullName,
    email,
    role,
    active: true,
    created_by: user.id
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  const accessRows = locationIds.map((locationId) => ({
    user_id: newUserId,
    location_id: locationId,
    access_level: role,
    created_by: user.id
  }));
  const { error: accessError } = await db.from("user_location_access").upsert(accessRows, { onConflict: "user_id,location_id" });
  if (accessError) throw accessError;

  await logActivity(db, user, locationIds[0], "profile", newUserId, "user_created", { email, role, locationCount: locationIds.length });
  return { id: newUserId, full_name: fullName, email, role, active: true, locationIds };
}

async function setUserActive(db, user, profileId, active) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can manage users.");
    error.statusCode = 403;
    throw error;
  }
  if (profileId === user.id && active === false) validationError("You cannot deactivate your own account.");
  const { data, error } = await db
    .from("profiles")
    .update({ active: Boolean(active) })
    .eq("id", profileId)
    .select("*")
    .single();
  if (error) throw error;
  const firstLocation = appFirstLocationIdForUser(db, profileId).catch(() => null);
  const locationId = await firstLocation;
  if (locationId) await logActivity(db, user, locationId, "profile", profileId, active ? "user_reactivated" : "user_deactivated", {});
  return data;
}

async function appFirstLocationIdForUser(db, profileId) {
  const { data } = await db.from("user_location_access").select("location_id").eq("user_id", profileId).limit(1).maybeSingle();
  return data?.location_id || null;
}

async function listIntelligenceRules(db, user) {
  if (!user.isSuperAdmin && !["regional_manager", "location_admin"].includes(user.role)) {
    const error = new Error("Only admins can view intelligence rules.");
    error.statusCode = 403;
    throw error;
  }
  const { data, error } = await db.from("intelligence_rules").select("*").order("event_type", { ascending: true });
  if (error) {
    if (!isMissingTableError(error)) throw error;
    return {
      schemaInstalled: false,
      rules: INTELLIGENCE_RULE_DEFINITIONS.map((rule) => normalizeIntelligenceRule(rule)),
      message: "Run supabase/operational-intelligence.sql to persist intelligence rules."
    };
  }
  const rowsByType = new Map((data || []).map((row) => [row.event_type, row]));
  const rules = INTELLIGENCE_RULE_DEFINITIONS.map((definition) => {
    const row = rowsByType.get(definition.event_type) || {};
    return normalizeIntelligenceRule({
      ...definition,
      ...row,
      label: definition.label,
      description: definition.description,
      settings: { ...(definition.settings || {}), ...(row.settings || {}) }
    });
  });
  return { schemaInstalled: true, rules };
}

async function updateIntelligenceRule(db, user, eventType, body = {}) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can update intelligence rules.");
    error.statusCode = 403;
    throw error;
  }
  const definition = INTELLIGENCE_RULE_DEFINITIONS.find((rule) => rule.event_type === eventType);
  if (!definition) validationError("Unknown intelligence rule.");
  const enabled = body.enabled !== false && body.enabled !== "false";
  const severity = clean(body.severity || definition.severity).toLowerCase();
  if (!INTELLIGENCE_SEVERITIES.has(severity)) validationError("Invalid severity.");
  const thresholdHours = body.thresholdHours === "" || body.threshold_hours === "" || body.thresholdHours === null || body.threshold_hours === null
    ? null
    : parseNonNegativeNumber(body.thresholdHours ?? body.threshold_hours ?? definition.threshold_hours ?? 0, "Threshold hours must be zero or higher.");
  const cooldownHours = parseNonNegativeNumber(body.cooldownHours ?? body.cooldown_hours ?? definition.cooldown_hours, "Cooldown hours must be zero or higher.");
  const settings = sanitizeRuleSettings({ ...(definition.settings || {}), ...(body.settings || {}) });
  const patch = {
    event_type: definition.event_type,
    enabled,
    severity,
    threshold_hours: thresholdHours,
    cooldown_hours: cooldownHours,
    settings,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db
    .from("intelligence_rules")
    .upsert(patch, { onConflict: "event_type" })
    .select("*")
    .single();
  if (error) {
    if (isMissingTableError(error)) validationError("Intelligence rules table is not installed yet. Run supabase/operational-intelligence.sql.");
    throw error;
  }
  const locations = await getLocations(db, user).catch(() => []);
  const activityLocationId = locations[0]?.id || null;
  if (activityLocationId) await logActivity(db, user, activityLocationId, "intelligence_rule", data.id, "intelligence_rule_updated", {
    eventType: definition.event_type,
    enabled,
    severity
  });
  return normalizeIntelligenceRule({ ...definition, ...data, label: definition.label, description: definition.description });
}

async function migrateLegacyData(db, user) {
  if (!user.isSuperAdmin) {
    const error = new Error("Only super admins can sync legacy data.");
    error.statusCode = 403;
    throw error;
  }

  const locations = await getLocations(db, user);
  const locationMap = buildLocationMatcher(locations);
  const { data: oldLeads, error: oldLeadsError } = await db.from("leads").select("*").order("created_at", { ascending: true });
  if (oldLeadsError) throw oldLeadsError;

  const { data: existingV2, error: existingError } = await db
    .from("leads_v2")
    .select("id, normalized_phone, normalized_email, created_at, location_id");
  if (existingError) throw existingError;

  const existingKeys = new Set((existingV2 || []).map((lead) => legacyKey({
    phone: lead.normalized_phone,
    email: lead.normalized_email,
    created_at: lead.created_at,
    location_id: lead.location_id
  })));
  const legacyIdToV2 = new Map();
  const insertedLeadRows = [];
  let skippedNoLocation = 0;
  let skippedDuplicate = 0;

  for (const oldLead of oldLeads || []) {
    const locationName = clean(oldLead.location || oldLead.preferred_community || oldLead.preferredCommunity || "");
    const location = matchLocation(locationMap, locationName);
    if (!location) {
      skippedNoLocation += 1;
      continue;
    }

    const normalizedPhone = normalizeDigits(oldLead.phone);
    const normalizedEmail = clean(oldLead.email).toLowerCase() || null;
    const key = legacyKey({ phone: normalizedPhone, email: normalizedEmail, created_at: oldLead.created_at, location_id: location.id });
    const existing = (existingV2 || []).find((lead) => legacyKey({
      phone: lead.normalized_phone,
      email: lead.normalized_email,
      created_at: lead.created_at,
      location_id: lead.location_id
    }) === key);
    if (existing) {
      legacyIdToV2.set(oldLead.id, { id: existing.id, location_id: existing.location_id });
      skippedDuplicate += 1;
      continue;
    }
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }

    const payload = legacyLeadPayload(oldLead, location.id, user.id);
    const { data: inserted, error } = await db.from("leads_v2").insert(payload).select("id, location_id").single();
    if (error) throw error;
    legacyIdToV2.set(oldLead.id, inserted);
    insertedLeadRows.push({ legacyId: oldLead.id, id: inserted.id, locationId: inserted.location_id });
    existingKeys.add(key);
  }

  const tourCount = await migrateLegacyTours(db, oldLeads || [], legacyIdToV2, user.id);
  const followUpCount = await migrateLegacyFollowUps(db, oldLeads || [], legacyIdToV2, user.id);
  const activityCount = await migrateLegacyEvents(db, legacyIdToV2, user.id);
  const emailCount = await migrateLegacyEmails(db, legacyIdToV2, user.id);

  await logActivity(db, user, locations[0]?.id || insertedLeadRows[0]?.locationId, "system", null, "legacy_sync_completed", {
    insertedLeads: insertedLeadRows.length,
    skippedDuplicate,
    skippedNoLocation,
    tourCount,
    followUpCount,
    activityCount,
    emailCount
  });

  return {
    insertedLeads: insertedLeadRows.length,
    skippedDuplicate,
    skippedNoLocation,
    tourCount,
    followUpCount,
    activityCount,
    emailCount
  };
}

async function buildOperatingPlanCandidates(db, user, locations, locationIds) {
  const now = Date.now();
  const [leadsRes, toursRes, followUpsRes, tasksRes, roomsRaw] = await Promise.all([
    selectByLocations(db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("*").order("scheduled_at", { ascending: true }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*").order("due_at", { ascending: true }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("staff_tasks").select("*").order("due_at", { ascending: true }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("rooms_v2").select("*").order("room_number", { ascending: true }).limit(500), locationIds, "location_id")
  ]);
  const roomsRes = roomsRaw?.error && isMissingTableError(roomsRaw.error) ? { data: [] } : roomsRaw;
  throwFirstError(leadsRes, toursRes, followUpsRes, tasksRes, roomsRes);
  const leads = leadsRes.data || [];
  const tours = toursRes.data || [];
  const followUps = followUpsRes.data || [];
  const tasks = tasksRes.data || [];
  const rooms = roomsRes.data || [];
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const items = [];

  followUps.filter((item) => clean(item.status).toLowerCase() === "open" && safeDateMs(item.due_at) && safeDateMs(item.due_at) < now).slice(0, 30).forEach((followUp) => {
    const lead = leadById.get(followUp.lead_id);
    const overdueHours = Math.round((now - safeDateMs(followUp.due_at)) / 3600000);
    items.push(planCandidate({
      locationId: followUp.location_id,
      planKey: `follow_up:${followUp.id}`,
      department: "admissions",
      sourceType: "follow_up",
      sourceId: followUp.id,
      title: `Recover overdue follow-up${lead?.full_name ? `: ${lead.full_name}` : ""}`,
      reason: `This follow-up is ${overdueHours}h overdue and still open.`,
      impact: "Families lose momentum when response timing slips.",
      recommendedAction: "Complete follow-up or snooze with clear recovery time.",
      actionLabel: "Complete",
      priority: overdueHours >= 24 ? "critical" : "high",
      dueAt: followUp.due_at,
      metadata: { leadId: followUp.lead_id || "", followUpId: followUp.id, locationName: locationById.get(followUp.location_id)?.name || "" }
    }));
  });

  leads.filter((lead) => clean(lead.status).toLowerCase() === "new" && now - safeDateMs(lead.created_at || lead.updated_at) >= 4 * 3600000).slice(0, 25).forEach((lead) => {
    const ageHours = Math.round((now - safeDateMs(lead.created_at || lead.updated_at)) / 3600000);
    items.push(planCandidate({
      locationId: lead.location_id,
      planKey: `lead_contact:${lead.id}`,
      department: "admissions",
      sourceType: "lead",
      sourceId: lead.id,
      title: `Contact new lead: ${lead.full_name || "Unnamed lead"}`,
      reason: `Lead has been new for ${ageHours}h without contacted status.`,
      impact: "Fast first response is high-leverage admissions work.",
      recommendedAction: "Call or email family, then mark contacted.",
      actionLabel: "Open lead",
      priority: ageHours >= 24 ? "critical" : "high",
      dueAt: new Date(Math.min(now + 2 * 3600000, safeDateMs(lead.created_at) + 24 * 3600000)).toISOString(),
      metadata: { leadId: lead.id, phone: lead.phone || "", email: lead.email || "", locationName: locationById.get(lead.location_id)?.name || "" }
    }));
  });

  tours.filter((tour) => clean(tour.status).toLowerCase() === "scheduled").filter((tour) => {
    const scheduled = safeDateMs(tour.scheduled_at);
    return scheduled && scheduled >= now && scheduled <= now + 24 * 3600000;
  }).slice(0, 20).forEach((tour) => {
    const lead = leadById.get(tour.lead_id);
    const scheduled = safeDateMs(tour.scheduled_at);
    items.push(planCandidate({
      locationId: tour.location_id,
      planKey: `tour_confirm:${tour.id}`,
      department: "admissions",
      sourceType: "tour",
      sourceId: tour.id,
      title: `Confirm tour${lead?.full_name ? `: ${lead.full_name}` : ""}`,
      reason: "Tour scheduled within next 24h.",
      impact: "Confirmed tours reduce no-shows and improve staff prep.",
      recommendedAction: "Confirm attendance, decision-makers, directions, and care needs.",
      actionLabel: "Prep tour",
      priority: scheduled <= now + 4 * 3600000 ? "critical" : "high",
      dueAt: new Date(Math.max(now, scheduled - 2 * 3600000)).toISOString(),
      metadata: { leadId: tour.lead_id || "", tourId: tour.id, scheduledAt: tour.scheduled_at, locationName: locationById.get(tour.location_id)?.name || "" }
    }));
  });

  tasks.filter((task) => !["done", "archived", "completed"].includes(clean(task.status).toLowerCase()) && safeDateMs(task.due_at) && safeDateMs(task.due_at) < now).slice(0, 20).forEach((task) => {
    const overdueHours = Math.round((now - safeDateMs(task.due_at)) / 3600000);
    items.push(planCandidate({
      locationId: task.location_id,
      planKey: `staff_task:${task.id}`,
      department: inferTaskDepartment(task),
      sourceType: "staff_task",
      sourceId: task.id,
      title: `Clear overdue task: ${task.title}`,
      reason: `Task is ${overdueHours}h overdue.`,
      impact: "Uncleared tasks create hidden move-in/service risk.",
      recommendedAction: "Complete, reassign, or reset due time.",
      actionLabel: "Open task",
      priority: overdueHours >= 24 ? "high" : "medium",
      dueAt: task.due_at,
      metadata: { taskId: task.id, leadId: task.lead_id || "", residentId: task.resident_id || "", locationName: locationById.get(task.location_id)?.name || "" }
    }));
  });

  rooms.filter((room) => ["maintenance", "offline"].includes(roomCurrentStatusValue(room)) || ["maintenance", "damaged", "needs_cleaning"].includes(clean(room.condition).toLowerCase())).slice(0, 20).forEach((room) => {
    const housekeeping = clean(room.condition).toLowerCase() === "needs_cleaning";
    items.push(planCandidate({
      locationId: room.location_id,
      planKey: `room_blocker:${room.id}`,
      department: housekeeping ? "housekeeping" : "maintenance",
      sourceType: "room",
      sourceId: room.id,
      title: `Clear Room ${room.room_number || ""} readiness blocker`.trim(),
      reason: `Room status is ${roomCurrentStatusValue(room)}${room.condition ? ` and condition is ${room.condition}` : ""}.`,
      impact: "Blocked rooms reduce move-in capacity.",
      recommendedAction: housekeeping ? "Coordinate housekeeping turnover and update room condition." : "Coordinate maintenance, set target ready time, update room status.",
      actionLabel: "Assign task",
      priority: roomCurrentStatusValue(room) === "offline" ? "high" : "medium",
      dueAt: new Date(now + 4 * 3600000).toISOString(),
      metadata: { roomId: room.id, roomNumber: room.room_number || "", locationName: locationById.get(room.location_id)?.name || "" }
    }));
  });

  buildRoomMatches(rooms, leads, { limit: 20 }).filter((match) => match.score >= 65).slice(0, 10).forEach((match) => {
    items.push(planCandidate({
      locationId: match.room.location_id,
      planKey: `room_match:${match.room.id}:${match.lead.id}`,
      department: "admissions",
      sourceType: "room",
      sourceId: match.room.id,
      title: `Match ${match.lead.full_name || "lead"} to Room ${match.room.room_number || ""}`.trim(),
      reason: match.explanation,
      impact: "Available room plus compatible family = near-term revenue opportunity.",
      recommendedAction: "Open lead, confirm timing/budget, decide whether to hold room.",
      actionLabel: "Open lead",
      priority: match.score >= 85 ? "high" : "medium",
      dueAt: new Date(now + 24 * 3600000).toISOString(),
      metadata: { roomId: match.room.id, roomNumber: match.room.room_number || "", leadId: match.lead.id, matchScore: match.score, reasons: match.reasons }
    }));
  });

  groupActiveLeadsBySource(leads, now).slice(0, 6).forEach((group) => {
    items.push(planCandidate({
      locationId: group.locationId,
      planKey: `marketing_source:${group.locationId}:${slugifyPlanKey(group.source)}`,
      department: "marketing",
      sourceType: "marketing_source",
      sourceId: null,
      title: `Review ${group.source} lead quality`,
      reason: `${group.openCount} active leads from this source have not produced a scheduled tour recently.`,
      impact: "Marketing effort should move toward sources that create tour-ready families.",
      recommendedAction: "Review recent leads, follow up with referral source, or adjust outreach.",
      actionLabel: "Review source",
      priority: group.openCount >= 5 ? "high" : "medium",
      dueAt: new Date(now + 48 * 3600000).toISOString(),
      metadata: { source: group.source, leadCount: group.openCount, locationName: locationById.get(group.locationId)?.name || "" }
    }));
  });

  return dedupePlanCandidates(items).sort(compareOperatingPlanItems).slice(0, 80);
}

async function logActivity(db, user, locationId, entityType, entityId, action, metadata = {}) {
  await db.from("activity_logs").insert({
    location_id: locationId,
    actor_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    metadata,
    created_by: user.id
  });
}

async function syncOperatingPlanCandidates(db, user, candidates = []) {
  if (!candidates.length) return [];
  const { data: existingRows, error } = await db
    .from("operating_plan_items")
    .select("*")
    .in("plan_key", candidates.map((item) => item.plan_key));
  if (error) throw error;
  const existing = new Map((existingRows || []).map((row) => [`${row.location_id}:${row.plan_key}`, row]));
  const changed = [];
  for (const item of candidates) {
    const row = existing.get(`${item.location_id}:${item.plan_key}`);
    if (row && ["completed", "dismissed"].includes(row.status)) continue;
    if (row) {
      const patch = {
        department: item.department,
        owner_role: item.owner_role,
        source_type: item.source_type,
        source_id: item.source_id,
        title: item.title,
        reason: item.reason,
        impact: item.impact,
        recommended_action: item.recommended_action,
        action_label: item.action_label,
        priority: item.priority,
        due_at: item.due_at,
        metadata: { ...(row.metadata || {}), ...(item.metadata || {}) }
      };
      const { data, error: updateError } = await db.from("operating_plan_items").update(patch).eq("id", row.id).select("*").single();
      if (updateError) throw updateError;
      changed.push(data);
    } else {
      const { data, error: insertError } = await db.from("operating_plan_items").insert({ ...item, created_by: user.id }).select("*").single();
      if (insertError) throw insertError;
      changed.push(data);
      await logActivity(db, user, item.location_id, "operating_plan_item", data.id, "operating_plan_item_created", { planKey: item.plan_key, priority: item.priority });
    }
  }
  return changed;
}

async function retireStaleOperatingPlanItems(db, user, candidates = [], locationIds = []) {
  const activeKeys = new Set(candidates.map((item) => `${item.location_id}:${item.plan_key}`));
  const activeStatuses = ["open", "assigned", "snoozed", "escalated"];
  let query = db
    .from("operating_plan_items")
    .select("id,location_id,plan_key,source_type,source_id,title,status,metadata")
    .in("status", activeStatuses)
    .limit(500);
  query = selectByLocations(query, locationIds, "location_id");
  const { data, error } = await query;
  if (error) throw error;
  const stale = (data || []).filter((row) => {
    if (!row.plan_key || activeKeys.has(`${row.location_id}:${row.plan_key}`)) return false;
    return [
      "follow_up",
      "lead",
      "tour",
      "staff_task",
      "room",
      "room_match",
      "marketing_source",
      "system"
    ].includes(clean(row.source_type).toLowerCase());
  });
  if (!stale.length) return [];
  const now = new Date().toISOString();
  const { data: retired, error: updateError } = await db
    .from("operating_plan_items")
    .update({
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
      metadata: { stale_source_retired: true, retired_at: now }
    })
    .in("id", stale.map((row) => row.id))
    .select("id,location_id,title");
  if (updateError) throw updateError;
  await Promise.all((retired || []).slice(0, 10).map((row) =>
    logActivity(db, user, row.location_id, "operating_plan_item", row.id, "operating_plan_item_retired", {
      reason: "source condition no longer active",
      title: row.title
    }).catch(() => {})
  ));
  return retired || [];
}

async function applyOperatingPlanEscalations(db, user, locationIds = []) {
  const now = Date.now();
  let query = db.from("operating_plan_items").select("*").in("status", ["open", "assigned", "snoozed", "escalated"]).limit(300);
  query = selectByLocations(query, locationIds, "location_id");
  const { data, error } = await query;
  if (error) throw error;
  for (const item of data || []) {
    const due = safeDateMs(item.snoozed_until && item.status === "snoozed" ? item.snoozed_until : item.due_at);
    if (!due || due >= now) continue;
    if (!item.last_overdue_at) {
      await db.from("operating_plan_items").update({ last_overdue_at: new Date(now).toISOString(), ignored_count: (item.ignored_count || 0) + 1 }).eq("id", item.id);
      continue;
    }
    if (now - safeDateMs(item.last_overdue_at) >= 4 * 3600000 && item.status !== "escalated") {
      const { data: escalated, error: escalationError } = await db
        .from("operating_plan_items")
        .update({
          status: "escalated",
          escalated_at: new Date(now).toISOString(),
          escalation_count: (item.escalation_count || 0) + 1,
          ignored_count: (item.ignored_count || 0) + 1
        })
        .eq("id", item.id)
        .select("*")
        .single();
      if (escalationError) throw escalationError;
      await logActivity(db, user, item.location_id, "operating_plan_item", item.id, "operating_plan_escalated", {
        title: item.title,
        escalationCount: escalated.escalation_count
      });
    }
  }
}

function planCandidate(input = {}) {
  const priority = OPERATING_PLAN_PRIORITIES.has(input.priority) ? input.priority : "medium";
  return {
    organization_id: "comfort-care",
    location_id: input.locationId,
    plan_key: input.planKey,
    department: input.department || "admissions",
    owner_role: input.ownerRole || "location_admin",
    owner_user_id: input.ownerUserId || null,
    source_type: input.sourceType || "system",
    source_id: input.sourceId || null,
    title: clean(input.title),
    reason: clean(input.reason),
    impact: clean(input.impact),
    recommended_action: clean(input.recommendedAction),
    action_label: clean(input.actionLabel || "Review"),
    priority,
    status: "open",
    due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
    metadata: input.metadata || {}
  };
}

function dedupePlanCandidates(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.location_id}:${item.plan_key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(item.location_id && item.plan_key && item.title);
  });
}

function compareOperatingPlanItems(a = {}, b = {}) {
  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusRank = { escalated: 0, open: 1, assigned: 2, snoozed: 3 };
  return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9)
    || (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    || (safeDateMs(a.due_at) || Number.MAX_SAFE_INTEGER) - (safeDateMs(b.due_at) || Number.MAX_SAFE_INTEGER);
}

function summarizeOperatingPlan(items = []) {
  return {
    total: items.length,
    critical: items.filter((item) => item.priority === "critical").length,
    high: items.filter((item) => item.priority === "high").length,
    escalated: items.filter((item) => item.status === "escalated").length,
    overdue: items.filter((item) => {
      const due = safeDateMs(item.snoozed_until && item.status === "snoozed" ? item.snoozed_until : item.due_at);
      return due && due < Date.now();
    }).length,
    departments: ["admissions", "marketing", "housekeeping", "maintenance"].reduce((acc, department) => {
      acc[department] = items.filter((item) => item.department === department).length;
      return acc;
    }, {})
  };
}

function inferTaskDepartment(task = {}) {
  const text = `${task.task_type || ""} ${task.title || ""} ${task.notes || ""}`.toLowerCase();
  if (text.includes("maintenance") || text.includes("repair")) return "maintenance";
  if (text.includes("housekeeping") || text.includes("clean")) return "housekeeping";
  if (text.includes("marketing") || text.includes("referral")) return "marketing";
  return "admissions";
}

function groupActiveLeadsBySource(leads = [], now = Date.now()) {
  const groups = new Map();
  leads.forEach((lead) => {
    const status = clean(lead.status).toLowerCase();
    if (["archived", "move_in", "tour_scheduled"].includes(status)) return;
    const created = safeDateMs(lead.created_at);
    if (!created || now - created > 14 * 24 * 3600000) return;
    const source = clean(lead.source || "Unknown source") || "Unknown source";
    const key = `${lead.location_id}:${source}`;
    if (!groups.has(key)) groups.set(key, { locationId: lead.location_id, source, openCount: 0 });
    groups.get(key).openCount += 1;
  });
  return [...groups.values()].filter((group) => group.openCount >= 3).sort((a, b) => b.openCount - a.openCount);
}

function safeDateMs(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function slugifyPlanKey(value = "") {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function locationNameById(locations = [], id = "") {
  return locations.find((location) => location.id === id)?.name || "";
}

function buildLeadPayload(body, locationId, userId = null) {
  const fullName = clean(body.fullName || body.full_name || body.name);
  const phone = clean(body.phone);
  const email = clean(body.email).toLowerCase();
  if (!fullName) validationError("Full name is required.");
  if (!isValidPhone(phone)) validationError("Enter a valid 10-digit phone number.");
  if (email && !isValidEmail(email)) validationError("Enter a valid email address.");
  return {
    location_id: locationId,
    full_name: fullName,
    phone: normalizePhone(phone),
    email: email || null,
    normalized_phone: normalizeDigits(phone),
    normalized_email: email || null,
    care_type: clean(body.careType || body.care_type || "Not sure yet"),
    source: clean(body.source || "Admin"),
    status: LEAD_STATUSES.has(body.status) ? body.status : "new",
    relationship_to_resident: clean(body.relationshipToResident || body.relationship_to_resident),
    move_timeline: clean(body.moveTimeline || body.move_timeline),
    payment_type: clean(body.paymentType || body.payment_type),
    current_situation: clean(body.currentSituation || body.current_situation),
    preferred_contact_method: clean(body.preferredContactMethod || body.preferred_contact_method),
    best_contact_time: clean(body.bestContactTime || body.best_contact_time),
    priority_tags: Array.isArray(body.priorityTags) ? body.priorityTags.map(clean).filter(Boolean) : [],
    lead_score: Number(body.leadScore || body.lead_score || 0),
    lead_temperature: clean(body.leadTemperature || body.lead_temperature || "cold"),
    notes_summary: clean(body.notes || body.message),
    created_by: userId
  };
}

function legacyLeadPayload(oldLead, locationId, userId) {
  const fullName = clean(oldLead.name || oldLead.full_name || oldLead.fullName || "Unknown");
  const phone = clean(oldLead.phone);
  const email = clean(oldLead.email).toLowerCase();
  return {
    location_id: locationId,
    full_name: fullName,
    phone: normalizePhone(phone) || phone,
    email: email || null,
    normalized_phone: normalizeDigits(phone),
    normalized_email: email || null,
    care_type: clean(oldLead.care_type || oldLead.careType || "Not sure yet"),
    source: clean(oldLead.source || "Website"),
    status: legacyStatus(oldLead.status),
    relationship_to_resident: clean(oldLead.relationship_to_resident || oldLead.relationshipToResident),
    move_timeline: clean(oldLead.move_timeline || oldLead.moveTimeline),
    payment_type: clean(oldLead.payment_type || oldLead.paymentType),
    current_situation: clean(oldLead.current_situation || oldLead.currentSituation),
    preferred_contact_method: clean(oldLead.preferred_contact_method || oldLead.preferredContactMethod),
    best_contact_time: clean(oldLead.best_contact_time || oldLead.bestContactTime),
    priority_tags: clean(oldLead.priority_tags || oldLead.priorityTags).split(/[,|]/).map((tag) => clean(tag)).filter(Boolean),
    lead_score: Number(oldLead.activity_score || oldLead.lead_score || 0),
    lead_temperature: clean(oldLead.activity_label || oldLead.lead_temperature || "cold").toLowerCase(),
    notes_summary: clean(oldLead.notes || oldLead.message),
    archived_at: legacyStatus(oldLead.status) === "archived" ? (oldLead.updated_at || oldLead.created_at || new Date().toISOString()) : null,
    created_at: oldLead.created_at || new Date().toISOString(),
    updated_at: oldLead.updated_at || oldLead.created_at || new Date().toISOString(),
    created_by: userId
  };
}

async function migrateLegacyTours(db, oldLeads, legacyIdToV2, userId) {
  let count = 0;
  for (const oldLead of oldLeads) {
    if (!oldLead.tour_scheduled_at) continue;
    const mapped = legacyIdToV2.get(oldLead.id);
    if (!mapped) continue;
    const { data: existing, error: existingError } = await db
      .from("tours")
      .select("id")
      .eq("lead_id", mapped.id)
      .eq("scheduled_at", oldLead.tour_scheduled_at)
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) continue;
    const { error } = await db.from("tours").insert({
      location_id: mapped.location_id,
      lead_id: mapped.id,
      scheduled_at: oldLead.tour_scheduled_at,
      status: "scheduled",
      notes: "Migrated from legacy tour date.",
      created_at: oldLead.tour_scheduled_at,
      updated_at: oldLead.updated_at || oldLead.tour_scheduled_at,
      created_by: userId
    });
    if (error) throw error;
    count += 1;
  }
  return count;
}

async function migrateLegacyFollowUps(db, oldLeads, legacyIdToV2, userId) {
  let count = 0;
  for (const oldLead of oldLeads) {
    if (!oldLead.follow_up_at) continue;
    const mapped = legacyIdToV2.get(oldLead.id);
    if (!mapped) continue;
    const { data: existing, error: existingError } = await db
      .from("follow_ups")
      .select("id")
      .eq("lead_id", mapped.id)
      .eq("due_at", oldLead.follow_up_at)
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) continue;
    const { error } = await db.from("follow_ups").insert({
      location_id: mapped.location_id,
      lead_id: mapped.id,
      due_at: oldLead.follow_up_at,
      status: "open",
      note: clean(oldLead.follow_up_note || "Migrated legacy follow-up."),
      created_at: oldLead.follow_up_at,
      updated_at: oldLead.updated_at || oldLead.follow_up_at,
      created_by: userId
    });
    if (error) throw error;
    count += 1;
  }
  return count;
}

async function migrateLegacyEvents(db, legacyIdToV2, userId) {
  const { data: rows, error } = await db.from("lead_events").select("*").order("created_at", { ascending: true }).limit(5000);
  if (error) return 0;
  const { data: existing, error: existingError } = await db
    .from("activity_logs")
    .select("entity_id, action, created_at")
    .limit(5000);
  if (existingError) throw existingError;
  const existingKeys = new Set((existing || []).map((row) => `${row.entity_id}:${row.action}:${row.created_at}`));
  const payload = [];
  for (const row of rows || []) {
    const mapped = legacyIdToV2.get(row.lead_id);
    if (!mapped) continue;
    const action = clean(row.event_type || "legacy_activity");
    const createdAt = row.created_at || new Date().toISOString();
    const key = `${mapped.id}:${action}:${createdAt}`;
    if (existingKeys.has(key)) continue;
    payload.push({
      location_id: mapped.location_id,
      actor_id: null,
      entity_type: "lead",
      entity_id: mapped.id,
      action,
      metadata: { detail: row.detail || "", legacyLeadId: row.lead_id, migrated: true },
      created_at: createdAt,
      updated_at: createdAt,
      created_by: userId
    });
    existingKeys.add(key);
  }
  if (!payload.length) return 0;
  const { error: insertError } = await db.from("activity_logs").insert(payload);
  if (insertError) throw insertError;
  return payload.length;
}

async function migrateLegacyEmails(db, legacyIdToV2, userId) {
  const { data: rows, error } = await db.from("email_outreach").select("*").order("created_at", { ascending: true }).limit(5000);
  if (error) return 0;
  const { data: existing, error: existingError } = await db
    .from("email_history")
    .select("lead_id, subject, created_at")
    .limit(5000);
  if (existingError) throw existingError;
  const existingKeys = new Set((existing || []).map((row) => `${row.lead_id}:${row.subject}:${row.created_at}`));
  const payload = [];
  for (const row of rows || []) {
    const mapped = legacyIdToV2.get(row.lead_id);
    if (!mapped) continue;
    const createdAt = row.created_at || new Date().toISOString();
    const key = `${mapped.id}:${row.subject}:${createdAt}`;
    if (existingKeys.has(key)) continue;
    payload.push({
      location_id: mapped.location_id,
      lead_id: mapped.id,
      recipient_email: clean(row.recipient_email || row.to || ""),
      subject: clean(row.subject || "Legacy email"),
      body: clean(row.body || row.message || ""),
      status: clean(row.status || "sent").toLowerCase(),
      provider: "legacy",
      sent_at: createdAt,
      created_at: createdAt,
      updated_at: row.updated_at || createdAt,
      created_by: userId
    });
    existingKeys.add(key);
  }
  if (!payload.length) return 0;
  const { error: insertError } = await db.from("email_history").insert(payload);
  if (insertError) throw insertError;
  return payload.length;
}

function legacyStatus(status) {
  const value = clean(status).toLowerCase();
  if (value === "tour scheduled") return "tour_scheduled";
  if (value === "moved in") return "move_in";
  if (value === "closed") return "archived";
  if (value === "contacted" || value === "tour completed" || value === "decision pending") return "contacted";
  return "new";
}

function buildLocationMatcher(locations) {
  const exact = new Map();
  for (const location of locations) {
    exact.set(normalizeLocationName(location.name), location);
    exact.set(normalizeLocationName(location.slug), location);
    if (location.city) exact.set(normalizeLocationName(location.city), location);
  }
  return { locations, exact };
}

function matchLocation(map, value) {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;
  if (map.exact.has(normalized)) return map.exact.get(normalized);
  return map.locations.find((location) => {
    const name = normalizeLocationName(location.name);
    const city = normalizeLocationName(location.city);
    return name.includes(normalized) || normalized.includes(name) || (city && normalized.includes(city));
  }) || null;
}

function normalizeLocationName(value) {
  return clean(value).toLowerCase().replace(/comfort care|senior living|community|fields/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function legacyKey({ phone, email, created_at, location_id }) {
  return [normalizeDigits(phone), clean(email).toLowerCase(), created_at ? new Date(created_at).toISOString() : "", location_id || ""].join("|");
}

async function findDuplicateLead(db, payload) {
  let query = db.from("leads_v2").select("id, full_name, phone, email, created_at").eq("location_id", payload.location_id).limit(1);
  if (payload.normalized_email) {
    query = query.or(`normalized_phone.eq.${payload.normalized_phone},normalized_email.eq.${payload.normalized_email}`);
  } else {
    query = query.eq("normalized_phone", payload.normalized_phone);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

async function getEntityById(db, table, id) {
  const { data, error } = await db.from(table).select("*").eq("id", id).single();
  if (error || !data) {
    const notFound = new Error("Record not found.");
    notFound.statusCode = 404;
    throw notFound;
  }
  return data;
}

async function getLocationById(db, id) {
  const { data, error } = await db.from("locations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function resolveLocationIds(user, locations, requestedLocationId = "") {
  if (requestedLocationId) {
    assertLocationAccess(user, requestedLocationId);
    return [requestedLocationId];
  }
  return locations.map((location) => location.id);
}

function scopeQuery(query, locationIds, column) {
  if (locationIds.length === 1) return query.eq(column, locationIds[0]);
  return query.in(column, locationIds);
}

function selectByLocations(query, locationIds, column) {
  return scopeQuery(query, locationIds, column);
}

function throwFirstError(...responses) {
  const failed = responses.find((response) => response?.error);
  if (failed) throw failed.error;
}

function parseRequiredDate(value, message) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) validationError(message);
  return date;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  throw error;
}

function assertSuperAdmin(user, message = "Only super admins can permanently delete records.") {
  if (user?.isSuperAdmin) return;
  const error = new Error(message);
  error.statusCode = 403;
  throw error;
}

async function writeHardDeleteAudit(db, user, locationId, entityType, entityId, beforeState, body = {}) {
  try {
    await db.from("operational_audit_events").insert({
      organization_id: beforeState?.organization_id || "comfort-care",
      location_id: locationId,
      actor_id: user.id,
      actor_role: user.role || user.profile?.role || "",
      entity_type: entityType,
      entity_id: entityId,
      action: "hard_delete",
      before_state: beforeState,
      after_state: null,
      reason: clean(body.reason || "Super Admin permanent delete"),
      source_route: clean(body.sourceRoute || "admin-v2"),
      metadata: { permanent: true },
      created_by: user.id
    });
  } catch (err) {
    if (!isMissingTableError(err)) console.error("hard delete audit failed:", err.message);
  }
}

function parseNonNegativeNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) validationError(message);
  return number;
}

function sanitizeRuleSettings(settings = {}) {
  return Object.entries(settings || {}).reduce((cleaned, [key, value]) => {
    const safeKey = clean(key);
    if (!safeKey) return cleaned;
    if (value === "" || value === null || value === undefined) return cleaned;
    const number = Number(value);
    cleaned[safeKey] = Number.isFinite(number) && String(value).trim() !== "" ? number : clean(value);
    return cleaned;
  }, {});
}

function normalizeIntelligenceRule(rule = {}) {
  return {
    id: rule.id || "",
    eventType: rule.event_type,
    label: rule.label || titleFromSnake(rule.event_type || ""),
    description: rule.description || rule.settings?.description || "",
    enabled: rule.enabled !== false,
    severity: rule.severity || "medium",
    thresholdHours: rule.threshold_hours ?? null,
    cooldownHours: rule.cooldown_hours ?? 24,
    settings: rule.settings || {},
    updatedAt: rule.updated_at || ""
  };
}

function titleFromSnake(value = "") {
  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isMissingTableError(error) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.code || ""}`.toLowerCase();
  return text.includes("does not exist") || text.includes("42p01") || text.includes("schema cache");
}

function normalizeDigits(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function safeFileName(value) {
  return String(value || "document")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "document";
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function resolveOutreachTargets(db, user, filters = {}) {
  const locations = await getLocations(db, user);
  const requestedLocationId = clean(filters.locationId || filters.location_id || "");
  const locationIds = resolveLocationIds(user, locations, requestedLocationId);
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  if (Array.isArray(filters.ids) && !filters.ids.map(clean).filter(Boolean).length) {
    return { leads: [], validLeads: [], invalidEmailCount: 0, locationIds, locationNames, cap: 75 };
  }
  let query = db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(500);
  query = scopeQuery(query, locationIds, "location_id");

  const ids = Array.isArray(filters.ids) ? filters.ids.map(clean).filter(Boolean) : [];
  if (ids.length) query = query.in("id", ids);
  const status = clean(filters.status || "");
  if (status && LEAD_STATUSES.has(status)) query = query.eq("status", status);
  const source = clean(filters.source || "");
  if (source) query = query.eq("source", source);
  const careType = clean(filters.careType || filters.care_type || "");
  if (careType) query = query.eq("care_type", careType);
  const search = cleanSearchFilter(filters.search || "");
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  const leads = (data || []).filter((lead) => clean(lead.status) !== "archived");
  const validLeads = leads.filter((lead) => isValidEmail(lead.email || ""));
  return {
    leads,
    validLeads,
    invalidEmailCount: leads.length - validLeads.length,
    locationIds,
    locationNames,
    cap: 75
  };
}

function leadTemplateData(lead, locationNames, overrideEmail = "") {
  const community = locationNames.get(lead.location_id) || lead.location || lead.preferred_community || "Comfort Care";
  return {
    ...lead,
    fullName: lead.full_name || lead.name || "there",
    name: lead.full_name || lead.name || "there",
    email: overrideEmail || lead.email || "",
    location: community,
    preferredCommunity: community,
    preferred_community: community,
    careType: lead.care_type || lead.careType || "senior living",
    care_type: lead.care_type || lead.careType || "senior living",
    message: lead.notes_summary || lead.current_situation || "",
    notes: lead.notes_summary || lead.current_situation || "",
    lead_message: lead.notes_summary || lead.current_situation || ""
  };
}

function fallbackOutreachLead(locationNames) {
  const firstLocation = [...locationNames.entries()][0] || ["", "Comfort Care"];
  return {
    id: null,
    location_id: firstLocation[0],
    full_name: "Test Recipient",
    email: "",
    care_type: "senior living",
    notes_summary: ""
  };
}

async function insertOutreachEmail(db, user, lead, email) {
  const { data, error } = await db.from("email_history").insert({
    location_id: email.locationId,
    lead_id: lead?.id || null,
    recipient_email: clean(email.recipientEmail).toLowerCase(),
    subject: clean(email.subject),
    body: String(email.body || "").trim(),
    status: clean(email.status || "sent").toLowerCase(),
    provider: clean(email.provider || "mass_outreach"),
    sent_by: user.id,
    sent_at: new Date().toISOString(),
    created_by: user.id
  }).select("*").single();
  if (error) throw error;
  await logActivity(db, user, email.locationId, "lead", lead?.id || null, "mass_outreach_email", {
    campaignId: email.campaignId || "",
    campaignName: email.campaignName || "",
    subject: email.subject,
    recipientEmail: email.recipientEmail,
    status: email.status
  });
  return data;
}

async function insertOutreachCampaignMarker(db, user, campaign) {
  const body = JSON.stringify(campaign);
  const { error } = await db.from("email_history").insert({
    location_id: campaign.locationId,
    lead_id: null,
    recipient_email: `campaign:${campaign.campaignId}`,
    subject: campaign.campaignName,
    body,
    status: campaign.mode === "Demo" ? "campaign_demo" : "campaign_live",
    provider: "mass_outreach_marker",
    sent_by: user.id,
    sent_at: new Date().toISOString(),
    created_by: user.id
  });
  if (error) throw error;
  await logActivity(db, user, campaign.locationId, "campaign", null, "mass_outreach_campaign_created", {
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    mode: campaign.mode,
    recipientCount: campaign.recipientCount
  });
}

function parseJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function cleanSearchFilter(value) {
  return clean(value).replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim();
}

function buildLeadTimeline({ lead = {}, activity = [], notes = [], emails = [], tours = [], followUps = [] }) {
  const rows = [
    {
      type: "lead",
      label: "Lead created",
      title: lead.full_name || "Lead",
      detail: [lead.source, lead.care_type, lead.move_timeline].filter(Boolean).join(" / "),
      at: lead.created_at,
      actor: ""
    },
    ...activity.map((row) => ({
      type: "activity",
      label: titleFromAction(row.action || row.event_type || "activity"),
      title: titleFromAction(row.action || row.event_type || "activity"),
      detail: timelineMetadata(row.metadata),
      at: row.created_at,
      actor: row.profiles?.full_name || row.profiles?.email || ""
    })),
    ...notes.map((row) => ({
      type: "note",
      label: "Note",
      title: "Internal note",
      detail: row.body || "",
      at: row.created_at,
      actor: ""
    })),
    ...emails.map((row) => ({
      type: "email",
      label: clean(row.status || "email"),
      title: row.subject || "Email",
      detail: row.recipient_email || "",
      at: row.sent_at || row.created_at,
      actor: ""
    })),
    ...tours.map((row) => ({
      type: "tour",
      label: titleFromAction(row.status || "tour"),
      title: "Tour",
      detail: row.notes || "",
      at: row.scheduled_at || row.created_at,
      actor: ""
    })),
    ...followUps.map((row) => ({
      type: "follow_up",
      label: titleFromAction(row.status || "follow up"),
      title: "Follow-up",
      detail: row.note || row.outcome || "",
      at: row.due_at || row.created_at,
      actor: ""
    }))
  ];
  return rows
    .filter((row) => row.at)
    .sort((a, b) => safeDateMs(b.at) - safeDateMs(a.at))
    .slice(0, 80);
}

function titleFromAction(value = "") {
  return clean(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timelineMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return "";
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${titleFromAction(key)}: ${String(value).slice(0, 80)}`)
    .join(" / ");
}

async function getScopeControlCenter(db, user, params = {}) {
  const locations = await getLocations(db, user);
  const locationIds = resolveLocationIds(user, locations, clean(params.locationId || params.location_id || ""));
  const now = Date.now();
  const [
    tasksRes,
    followUpsRes,
    emailsRes,
    eventsRes,
    planRes,
    notificationsRaw,
    messagesRaw,
    auditRaw,
    usersRaw,
    integrationsRaw,
    leadsRes,
    toursRes,
    roomsRaw,
    roi
  ] = await Promise.all([
    selectByLocations(db.from("staff_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("follow_ups").select("*").order("due_at", { ascending: true, nullsFirst: false }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("email_history").select("*").order("created_at", { ascending: false }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("operational_events").select("*").order("detected_at", { ascending: false }).limit(300), locationIds, "location_id"),
    selectByLocations(db.from("operating_plan_items").select("*").order("due_at", { ascending: true, nullsFirst: false }).limit(300), locationIds, "location_id"),
    safeTableQuery(selectByLocations(db.from("operational_notifications").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id")),
    safeTableQuery(selectByLocations(db.from("communication_messages").select("*").order("created_at", { ascending: false }).limit(200), locationIds, "location_id")),
    safeTableQuery(selectByLocations(db.from("operational_audit_events").select("*, profiles:actor_id(full_name,email)").order("created_at", { ascending: false }).limit(200), locationIds, "location_id")),
    safeTableQuery(db.from("profiles").select("id,full_name,email,role,active,user_location_access(location_id,access_level)").order("full_name", { ascending: true }).limit(300)),
    safeTableQuery(db.from("external_integrations").select("provider,status,user_id,calendar_name,updated_at,last_error").eq("user_id", user.id).limit(20)),
    selectByLocations(db.from("leads_v2").select("*").order("created_at", { ascending: false }).limit(1000), locationIds, "location_id"),
    selectByLocations(db.from("tours").select("*").order("scheduled_at", { ascending: false }).limit(500), locationIds, "location_id"),
    selectByLocations(db.from("rooms_v2").select("*").order("room_number", { ascending: true }).limit(500), locationIds, "location_id"),
    getReferralRoi(db, user, locationIds.length === 1 ? locationIds[0] : "")
  ]);
  const roomsRes = roomsRaw?.error && isMissingTableError(roomsRaw.error) ? { data: [] } : roomsRaw;
  throwFirstError(tasksRes, followUpsRes, emailsRes, eventsRes, planRes, leadsRes, toursRes, roomsRes);
  const tasks = tasksRes.data || [];
  const followUps = followUpsRes.data || [];
  const emails = emailsRes.data || [];
  const leads = leadsRes.data || [];
  const tours = toursRes.data || [];
  const rooms = roomsRes.data || [];
  const events = (eventsRes.data || []).filter((event) => !["resolved", "dismissed"].includes(clean(event.status).toLowerCase()));
  const planItems = (planRes.data || []).filter((item) => !["completed", "dismissed"].includes(clean(item.status).toLowerCase()));
  const persistedNotifications = notificationsRaw.schemaInstalled ? notificationsRaw.data || [] : [];
  const derivedNotifications = buildDerivedNotifications({ tasks, followUps, events, planItems, now });
  if (notificationsRaw.schemaInstalled) {
    await syncDerivedOperationalNotifications(db, user, derivedNotifications).catch(() => {});
  }
  const users = (usersRaw.data || []).filter((profile) => profile.active !== false && userCanWorkLocations(profile, locationIds));
  const openWork = [
    ...tasks.filter((item) => !["done", "archived"].includes(clean(item.status).toLowerCase())).map((item) => ({ type: "task", ...item })),
    ...followUps.filter((item) => !["completed", "archived", "missed", "done"].includes(clean(item.status).toLowerCase())).map((item) => ({ type: "follow_up", ...item })),
    ...planItems.map((item) => ({ type: "operating_plan", ...item, assigned_to: item.owner_user_id || null }))
  ];
  const ownerRows = summarizeOwnership(users, openWork);
  const myWork = summarizeMyWorkToday(openWork, user.id, now);
  const communications = buildCommunicationScope({ emails, messages: messagesRaw.data || [], integrations: integrationsRaw.data || [], user });
  return {
    schemaInstalled: {
      notifications: notificationsRaw.schemaInstalled,
      communications: messagesRaw.schemaInstalled,
      audit: auditRaw.schemaInstalled
    },
    communications,
    notifications: {
      active: [...persistedNotifications, ...derivedNotifications].slice(0, 40),
      needsAttention: derivedNotifications.filter((item) => ["critical", "high"].includes(item.severity)).length,
      lifecycle: "open -> acknowledged -> assigned -> escalated -> resolved"
    },
    ownership: {
      users: ownerRows,
      unassigned: openWork.filter((item) => !item.assigned_to).length,
      overdue: openWork.filter((item) => safeDateMs(item.due_at) && safeDateMs(item.due_at) < now).length,
      myWork
    },
    valueLayer: buildAdmissionsValueLayer({ leads, tours, followUps, emails, rooms, now }),
    marketing: buildMarketingRecommendations(roi),
    ownerReport: buildOwnerReportSummary({ locations, locationIds, tasks, followUps, emails, events, planItems, roi }),
    permissions: buildPermissionMatrix(user),
    audit: {
      rows: auditRaw.schemaInstalled ? auditRaw.data || [] : [],
      schemaInstalled: auditRaw.schemaInstalled,
      message: auditRaw.schemaInstalled ? "" : "Run supabase/scope-a-v2.sql to enable audit UI persistence."
    }
  };
}

async function assignScopeWorkItem(db, user, body = {}) {
  const type = clean(body.type || body.itemType || "");
  const id = clean(body.id || body.itemId || "");
  const assigneeId = clean(body.assignedTo || body.assigneeId || "");
  if (!id || !assigneeId) validationError("Choose an item and assignee.");
  const profile = await getEntityById(db, "profiles", assigneeId);
  if (!profile.active) validationError("Cannot assign work to an inactive user.");
  let table = "";
  let patch = { assigned_to: assigneeId };
  let entityType = type;
  if (type === "task") table = "staff_tasks";
  else if (type === "follow_up") table = "follow_ups";
  else if (type === "operating_plan") {
    table = "operating_plan_items";
    patch = { owner_user_id: assigneeId, status: "assigned", assigned_at: new Date().toISOString(), assigned_by: user.id };
    entityType = "operating_plan_item";
  } else validationError("Invalid work item type.");
  const item = await getEntityById(db, table, id);
  assertLocationAccess(user, item.location_id);
  const { data, error } = await db.from(table).update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await writeOperationalAudit(db, user, item.location_id, entityType, id, "assigned", item, data, { assigneeId });
  await logActivity(db, user, item.location_id, entityType, id, "assigned", { assigneeId });
  return { item: data };
}

async function updateOperationalNotification(db, user, id, body = {}) {
  const notification = await getEntityById(db, "operational_notifications", id);
  assertLocationAccess(user, notification.location_id);
  const action = clean(body.action || body.status || "").toLowerCase();
  const now = new Date().toISOString();
  const patch = { updated_at: now };
  if (action === "acknowledge" || action === "acknowledged") {
    patch.status = "acknowledged";
    patch.acknowledged_by = user.id;
    patch.acknowledged_at = now;
  } else if (action === "resolve" || action === "resolved") {
    patch.status = "resolved";
    patch.resolved_at = now;
  } else if (action === "dismiss" || action === "dismissed") {
    patch.status = "dismissed";
  } else {
    validationError("Choose acknowledge, resolve, or dismiss.");
  }
  const { data, error } = await db.from("operational_notifications").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await logActivity(db, user, notification.location_id, "operational_notification", id, `notification_${patch.status}`, { sourceType: notification.source_type });
  return data;
}

async function listOwnerReportCsv(db, user, params = {}) {
  const scope = await getScopeControlCenter(db, user, params);
  const rows = [
    ["Section", "Metric", "Value"],
    ["Owner", "Unassigned work", scope.ownership.unassigned],
    ["Owner", "Overdue work", scope.ownership.overdue],
    ["Notifications", "Needs attention", scope.notifications.needsAttention],
    ["Communications", "Sent emails", scope.communications.sentCount],
    ["Communications", "Inbox messages", scope.communications.inboxCount],
    ["Marketing", "Top source", scope.marketing[0]?.source || ""],
    ["Marketing", "Top recommendation", scope.marketing[0]?.recommendation || ""],
    ...scope.ownership.users.map((row) => ["Owner workload", row.name, `${row.open} open / ${row.overdue} overdue`]),
    ...scope.marketing.map((row) => ["Marketing source", row.source, `${row.qualityScore} quality / ${row.recommendation}`])
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

async function safeTableQuery(query) {
  const result = await query;
  if (result?.error && isMissingTableError(result.error)) return { schemaInstalled: false, data: [] };
  if (result?.error) throw result.error;
  return { schemaInstalled: true, data: result.data || [] };
}

function buildDerivedNotifications({ tasks = [], followUps = [], events = [], planItems = [], now = Date.now() }) {
  const rows = [];
  followUps.forEach((item) => {
    if (["completed", "archived", "missed", "done"].includes(clean(item.status).toLowerCase())) return;
    const due = safeDateMs(item.due_at);
    if (due && due < now) rows.push(scopeNotification("follow_up", item.id, item.location_id, "high", "Follow-up overdue", item.note || "Follow-up needs action.", item.assigned_to, due));
  });
  tasks.forEach((item) => {
    if (["done", "archived"].includes(clean(item.status).toLowerCase())) return;
    const due = safeDateMs(item.due_at);
    if (due && due < now) rows.push(scopeNotification("task", item.id, item.location_id, "high", "Task overdue", item.title, item.assigned_to, due));
  });
  planItems.forEach((item) => {
    const due = safeDateMs(item.due_at);
    if (item.status === "escalated" || (due && due < now && Number(item.ignored_count || 0) > 0)) {
      rows.push(scopeNotification("operating_plan", item.id, item.location_id, item.priority === "critical" ? "critical" : "high", item.title, item.impact || item.reason, item.owner_user_id, due));
    }
  });
  events.slice(0, 12).forEach((event) => rows.push(scopeNotification("operational_event", event.id, event.location_id, clean(event.severity) || "medium", event.title, event.description || event.reason, null, safeDateMs(event.detected_at))));
  return rows.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || safeDateMs(b.created_at) - safeDateMs(a.created_at)).slice(0, 30);
}

function scopeNotification(type, id, locationId, severity, title, detail, assignedTo, dueMs) {
  const overdueHours = dueMs ? Math.max(0, Math.floor((Date.now() - dueMs) / 3600000)) : 0;
  const escalated = overdueHours >= 4 || severity === "critical";
  return {
    id: `${type}:${id}`,
    source_type: type,
    source_id: id,
    location_id: locationId,
    severity,
    status: escalated ? "escalated" : assignedTo ? "assigned" : "open",
    title: title || "Operational attention needed",
    detail: detail || "",
    assigned_to: assignedTo || null,
    escalated_at: escalated ? new Date().toISOString() : null,
    due_at: dueMs ? new Date(dueMs).toISOString() : null,
    created_at: new Date().toISOString()
  };
}

async function syncDerivedOperationalNotifications(db, user, notifications = []) {
  const rows = notifications
    .filter((item) => item.location_id && item.source_type && item.source_id)
    .slice(0, 60)
    .map((item) => ({
      organization_id: "comfort-care",
      location_id: item.location_id,
      source_type: item.source_type,
      source_id: item.source_id,
      severity: item.severity || "medium",
      status: item.status || "open",
      title: item.title || "Operational attention needed",
      detail: item.detail || "",
      assigned_to: item.assigned_to || null,
      escalated_at: item.escalated_at || null,
      due_at: item.due_at || null,
      metadata: { derived: true },
      created_by: user.id
    }));
  if (!rows.length) return;
  const { error } = await db
    .from("operational_notifications")
    .upsert(rows, { onConflict: "location_id,source_type,source_id" });
  if (error && !isMissingTableError(error)) throw error;
}

function summarizeOwnership(users = [], work = []) {
  const byUser = new Map(users.map((profile) => [profile.id, {
    id: profile.id,
    name: profile.full_name || profile.email || "Staff",
    email: profile.email || "",
    role: profile.role || "staff",
    open: 0,
    overdue: 0
  }]));
  const now = Date.now();
  work.forEach((item) => {
    const owner = item.assigned_to || "";
    if (!owner || !byUser.has(owner)) return;
    const row = byUser.get(owner);
    row.open += 1;
    const due = safeDateMs(item.due_at);
    if (due && due < now) row.overdue += 1;
  });
  return [...byUser.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));
}

function summarizeMyWorkToday(work = [], userId = "", now = Date.now()) {
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const rows = work
    .filter((item) => item.assigned_to === userId || item.owner_user_id === userId)
    .map((item) => {
      const due = safeDateMs(item.due_at);
      const status = due && due < now ? "overdue" : due && due <= dayEnd.getTime() ? "today" : "upcoming";
      return {
        id: item.id,
        type: item.type || "work",
        title: item.title || item.note || item.recommended_action || "Assigned work",
        status,
        due_at: item.due_at || null,
        lead_id: item.lead_id || (item.source_type === "lead" ? item.source_id : ""),
        source_type: item.source_type || "",
        source_id: item.source_id || "",
        location_id: item.location_id || ""
      };
    })
    .filter((item) => item.status !== "upcoming")
    .sort((a, b) => (a.status === "overdue" ? -1 : 1) - (b.status === "overdue" ? -1 : 1) || safeDateMs(a.due_at) - safeDateMs(b.due_at));
  return {
    dueToday: rows.filter((item) => item.status === "today").length,
    overdue: rows.filter((item) => item.status === "overdue").length,
    items: rows.slice(0, 12)
  };
}

function userCanWorkLocations(profile = {}, locationIds = []) {
  if (profile.role === "super_admin") return true;
  const access = profile.user_location_access || [];
  return access.some((row) => locationIds.includes(row.location_id));
}

function buildCommunicationScope({ emails = [], messages = [], integrations = [], user = {} }) {
  const gmail = integrations.find((item) => item.provider === "google_gmail" && item.status === "connected");
  const sent = emails.filter((row) => clean(row.status).includes("sent") || clean(row.status).includes("campaign"));
  const failed = emails.filter((row) => clean(row.status).includes("fail"));
  return {
    gmail: {
      status: gmail ? "Connected" : "Not linked",
      account: gmail?.calendar_name || user.email || "",
      lastSync: gmail?.updated_at || "",
      lastError: gmail?.last_error || "",
      needsSetup: !gmail
    },
    sentCount: sent.length,
    failedCount: failed.length,
    inboxCount: messages.filter((row) => clean(row.direction) === "inbound").length,
    recentSent: sent.slice(0, 8),
    inbox: messages.filter((row) => clean(row.direction) === "inbound").slice(0, 8)
  };
}

function buildAdmissionsValueLayer({ leads = [], tours = [], followUps = [], emails = [], rooms = [], now = Date.now() }) {
  return {
    lostLeadRecovery: buildLostLeadRecovery(leads, tours, followUps, emails, rooms, now),
    speedToLead: buildSpeedToLeadScore(leads, tours, followUps, emails, now),
    tourConversionCoach: buildTourConversionCoach(tours, followUps, leads, now),
    roomReadinessSla: buildRoomReadinessSla(rooms, now)
  };
}

function buildLostLeadRecovery(leads = [], tours = [], followUps = [], emails = [], rooms = [], now = Date.now()) {
  const activeFollowLeadIds = new Set(followUps
    .filter((item) => !["completed", "archived", "missed", "done"].includes(clean(item.status).toLowerCase()))
    .map((item) => item.lead_id)
    .filter(Boolean));
  const futureTourLeadIds = new Set(tours
    .filter((tour) => !["completed", "cancelled", "no_show"].includes(clean(tour.status).toLowerCase()) && safeDateMs(tour.scheduled_at) >= now)
    .map((tour) => tour.lead_id)
    .filter(Boolean));
  const emailedLeadIds = new Set(emails.map((email) => email.lead_id).filter(Boolean));
  const matches = buildRoomMatches(rooms, leads, { limit: 1000 });
  const matchLeadIds = new Set(matches.map((match) => match.lead.id));
  const candidates = leads
    .filter((lead) => clean(lead.status).toLowerCase() !== "move_in")
    .map((lead) => {
      const ageDays = daysSinceValue(lead.updated_at || lead.created_at, now);
      const status = clean(lead.status).toLowerCase();
      const noActiveNextStep = !activeFollowLeadIds.has(lead.id) && !futureTourLeadIds.has(lead.id);
      if (status !== "archived" && (ageDays < 14 || !noActiveNextStep)) return null;
      const bucket = detectLostLeadBucket(lead, {
        hasRoomFit: matchLeadIds.has(lead.id),
        hasEmail: emailedLeadIds.has(lead.id),
        status
      });
      return {
        leadId: lead.id,
        leadName: lead.full_name || "Unnamed lead",
        locationId: lead.location_id,
        status: lead.status || "new",
        ageDays: Math.round(ageDays),
        bucket,
        reason: lostLeadReason(bucket),
        script: lostLeadRecoveryScript(bucket, lead),
        nextAction: lostLeadNextAction(bucket),
        score: estimateLeadIntentScore(lead)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.ageDays - a.ageDays)
    .slice(0, 12);
  const buckets = ["price_objection", "timing", "no_room_fit", "no_response"].map((bucket) => ({
    bucket,
    label: titleFromAction(bucket),
    count: candidates.filter((item) => item.bucket === bucket).length,
    script: lostLeadRecoveryScript(bucket)
  }));
  return { total: candidates.length, buckets, candidates };
}

function detectLostLeadBucket(lead = {}, context = {}) {
  const text = normalizeMatchText(`${lead.notes_summary || ""} ${lead.current_situation || ""} ${lead.payment_type || ""} ${lead.move_timeline || ""}`);
  if (/price|cost|expensive|afford|budget|medicaid|insurance|pay/.test(text)) return "price_objection";
  if (/later|future|not ready|wait|month|year|timing|timeline/.test(text)) return "timing";
  if (!context.hasRoomFit) return "no_room_fit";
  return "no_response";
}

function lostLeadReason(bucket = "") {
  return {
    price_objection: "Family likely paused on cost or payment concern.",
    timing: "Family may still be future demand, not closed demand.",
    no_room_fit: "No compatible available room is visible right now.",
    no_response: "Lead went quiet without a clear next commitment."
  }[bucket] || "Needs recovery review.";
}

function lostLeadNextAction(bucket = "") {
  return {
    price_objection: "Send affordability/options follow-up.",
    timing: "Set future check-in with specific date.",
    no_room_fit: "Offer waitlist or alternate community fit.",
    no_response: "Call once, then send short re-open email."
  }[bucket] || "Open lead and set next step.";
}

function lostLeadRecoveryScript(bucket = "", lead = {}) {
  const first = clean(lead.full_name || "").split(/\s+/)[0] || "{{first_name}}";
  return {
    price_objection: `Hi ${first}, checking in. If cost was the main concern, we can walk through care options and what is included so your family can compare clearly.`,
    timing: `Hi ${first}, I know timing may not have been right before. Would it help if I checked back around your target move window and kept you posted on availability?`,
    no_room_fit: `Hi ${first}, a better-fit room may open soon. Would you like us to keep you on the priority list and call when there is a match?`,
    no_response: `Hi ${first}, just reopening the loop. Are you still exploring senior living options, or should I close this out for now?`
  }[bucket] || `Hi ${first}, checking in to see if your family still needs help with next steps.`;
}

function buildSpeedToLeadScore(leads = [], tours = [], followUps = [], emails = [], now = Date.now()) {
  const leadTouches = new Map();
  const addTouch = (leadId, at) => {
    if (!leadId) return;
    const time = safeDateMs(at);
    if (!time) return;
    const current = leadTouches.get(leadId);
    if (!current || time < current) leadTouches.set(leadId, time);
  };
  emails.forEach((row) => addTouch(row.lead_id, row.sent_at || row.created_at));
  followUps.forEach((row) => addTouch(row.lead_id, row.created_at || row.updated_at || row.due_at));
  tours.forEach((row) => addTouch(row.lead_id, row.created_at || row.updated_at || row.scheduled_at));
  const recent = leads.filter((lead) => {
    const created = safeDateMs(lead.created_at);
    return created && now - created <= 30 * 86400000;
  });
  const rows = recent.map((lead) => {
    const created = safeDateMs(lead.created_at);
    const firstTouch = leadTouches.get(lead.id) || 0;
    const minutes = firstTouch && firstTouch >= created ? Math.round((firstTouch - created) / 60000) : null;
    return {
      leadId: lead.id,
      leadName: lead.full_name || "Unnamed lead",
      locationId: lead.location_id,
      createdAt: lead.created_at,
      firstTouchAt: minutes === null ? "" : new Date(firstTouch).toISOString(),
      minutes,
      status: minutes === null ? (now - created > 3600000 ? "missed" : "waiting") : minutes <= 15 ? "fast" : minutes <= 60 ? "ok" : "slow"
    };
  });
  const touched = rows.filter((row) => row.minutes !== null);
  const avgMinutes = touched.length ? Math.round(touched.reduce((sum, row) => sum + row.minutes, 0) / touched.length) : null;
  const missed = rows.filter((row) => row.status === "missed").length;
  const fast = rows.filter((row) => row.status === "fast").length;
  const base = avgMinutes === null ? 60 : avgMinutes <= 5 ? 100 : avgMinutes <= 15 ? 90 : avgMinutes <= 60 ? 72 : avgMinutes <= 240 ? 45 : 25;
  const score = Math.max(0, Math.min(100, base - missed * 8));
  return {
    score,
    avgMinutes,
    fast,
    missed,
    totalRecent: rows.length,
    targetMinutes: 15,
    label: score >= 85 ? "Fast" : score >= 65 ? "Needs attention" : "Slow",
    slowLeads: rows.filter((row) => ["slow", "missed"].includes(row.status)).slice(0, 8)
  };
}

function buildTourConversionCoach(tours = [], followUps = [], leads = [], now = Date.now()) {
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const activeFollowUps = followUps.filter((item) => !["completed", "archived", "missed", "done"].includes(clean(item.status).toLowerCase()));
  const cards = tours
    .map((tour) => {
      const status = clean(tour.status).toLowerCase();
      const scheduled = safeDateMs(tour.scheduled_at);
      const hasNextCommitment = activeFollowUps.some((item) => item.lead_id === tour.lead_id && safeDateMs(item.due_at) >= Math.max(now, scheduled));
      const lead = leadById.get(tour.lead_id) || {};
      let stage = "Prepare";
      let nextAction = "Confirm decision-makers, care needs, budget range, and directions.";
      if (status === "completed" && !hasNextCommitment) {
        stage = "Close";
        nextAction = "Log tour outcome, objection, and next commitment today.";
      } else if (["no_show", "cancelled"].includes(status)) {
        stage = "Recover";
        nextAction = "Call once, offer a simpler time, then send short reschedule note.";
      } else if (scheduled && scheduled < now && status === "scheduled") {
        stage = "Closeout";
        nextAction = "Mark completed/no-show and create follow-up.";
      } else if (scheduled && scheduled <= now + 48 * 3600000 && status === "scheduled") {
        stage = "Confirm";
        nextAction = "Confirm attendance and send prep note.";
      }
      const include = ["completed", "no_show", "cancelled"].includes(status)
        ? !hasNextCommitment || now - scheduled <= 14 * 86400000
        : scheduled && scheduled <= now + 7 * 86400000;
      if (!include) return null;
      return {
        tourId: tour.id,
        leadId: tour.lead_id,
        leadName: lead.full_name || "Family tour",
        locationId: tour.location_id,
        scheduledAt: tour.scheduled_at,
        status: tour.status || "scheduled",
        stage,
        nextAction,
        hasNextCommitment,
        checklist: [
          "Confirm decision-maker attending",
          "Confirm care need and urgency",
          "Prepare room fit and pricing answer",
          "End with a dated next commitment"
        ],
        followUpScript: "Thank you for visiting. Based on what you shared, the next best step is to confirm care fit, room timing, and any remaining questions."
      };
    })
    .filter(Boolean)
    .sort((a, b) => safeDateMs(a.scheduledAt) - safeDateMs(b.scheduledAt))
    .slice(0, 10);
  const completed = tours.filter((tour) => clean(tour.status).toLowerCase() === "completed").length;
  const converted = tours.filter((tour) => clean(leadById.get(tour.lead_id)?.status).toLowerCase() === "move_in").length;
  return { cards, completed, converted, conversionRate: completed ? Math.round((converted / completed) * 100) : 0 };
}

function buildRoomReadinessSla(rooms = [], now = Date.now()) {
  const blocked = rooms
    .filter((room) => ["maintenance", "offline"].includes(roomCurrentStatusValue(room)) || ["needs_cleaning", "maintenance", "damaged", "offline"].includes(clean(room.condition).toLowerCase()))
    .map((room) => {
      const since = safeDateMs(room.updated_at || room.created_at);
      const hoursBlocked = since ? Math.max(0, Math.round((now - since) / 3600000)) : 0;
      return {
        roomId: room.id,
        roomNumber: room.room_number || "",
        locationId: room.location_id,
        status: roomCurrentStatusValue(room),
        condition: room.condition || "",
        hoursBlocked,
        monthlyRate: roomRevenueValue(room),
        risk: hoursBlocked >= 72 ? "critical" : hoursBlocked >= 24 ? "high" : "medium"
      };
    })
    .sort((a, b) => b.hoursBlocked - a.hoursBlocked);
  const avgHours = blocked.length ? Math.round(blocked.reduce((sum, room) => sum + room.hoursBlocked, 0) / blocked.length) : 0;
  return {
    blockedCount: blocked.length,
    avgHours,
    targetHours: 24,
    monthlyRevenueBlocked: blocked.reduce((sum, room) => sum + Number(room.monthlyRate || 0), 0),
    worstRooms: blocked.slice(0, 8),
    readyRooms: rooms.filter((room) => roomCurrentStatusValue(room) === "available" && !["needs_cleaning", "maintenance", "damaged", "offline"].includes(clean(room.condition).toLowerCase())).length
  };
}

function buildMarketingRecommendations(roi = []) {
  return (roi || []).slice(0, 12).map((row) => {
    const recommendation = row.qualityScore >= 70
      ? "Increase outreach and ask for repeat referrals."
      : row.roomFitRate >= 50
        ? "Good fit but needs tour conversion push."
        : row.leads >= 5
          ? "Audit source quality before spending more."
          : "Keep tracking until more volume is available.";
    return { ...row, recommendation };
  });
}

function buildOwnerReportSummary({ locations = [], locationIds = [], tasks = [], followUps = [], emails = [], events = [], planItems = [], roi = [] }) {
  const locationNames = locations.filter((location) => locationIds.includes(location.id)).map((location) => location.name);
  return {
    generatedAt: new Date().toISOString(),
    scope: locationNames.join(", ") || "Assigned locations",
    openTasks: tasks.filter((item) => !["done", "archived"].includes(clean(item.status))).length,
    openFollowUps: followUps.filter((item) => !["completed", "archived", "missed"].includes(clean(item.status))).length,
    activeEvents: events.length,
    planItems: planItems.length,
    emailsSent: emails.length,
    topMarketingSource: roi[0]?.source || ""
  };
}

function buildPermissionMatrix(user = {}) {
  const role = user.role || user.profile?.role || "staff";
  const isSuper = Boolean(user.isSuperAdmin);
  const isManager = isSuper || ["regional_manager", "location_admin"].includes(role);
  return [
    { area: "Leads", access: "read/write", allowed: true },
    { area: "Tours/follow-ups/tasks", access: "read/write assigned locations", allowed: true },
    { area: "Rooms/residents", access: isManager ? "manage" : "read/update workflow", allowed: true },
    { area: "Marketing campaigns", access: isManager ? "send/export" : "draft/review", allowed: true },
    { area: "Users and access", access: isSuper ? "manage all" : "no access", allowed: isSuper },
    { area: "Hard delete/audit", access: isSuper ? "delete + audit" : "read only if exposed", allowed: isSuper },
    { area: "Owner exports", access: isManager ? "allowed" : "restricted", allowed: isManager }
  ];
}

async function writeOperationalAudit(db, user, locationId, entityType, entityId, action, beforeState, afterState, metadata = {}) {
  try {
    await db.from("operational_audit_events").insert({
      organization_id: beforeState?.organization_id || afterState?.organization_id || "comfort-care",
      location_id: locationId,
      actor_id: user.id,
      actor_role: user.role || user.profile?.role || "",
      entity_type: entityType,
      entity_id: entityId,
      action,
      before_state: beforeState || null,
      after_state: afterState || null,
      reason: clean(metadata.reason || ""),
      source_route: "admin-v2",
      metadata,
      created_by: user.id
    });
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
}

function severityWeight(value = "") {
  return { critical: 4, high: 3, medium: 2, low: 1 }[clean(value).toLowerCase()] || 0;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

module.exports = {
  DOCUMENT_BUCKET,
  getLocations,
  getDashboard,
  listLeads,
  getLeadDetail,
  createLead,
  updateLeadNotes,
  generateLeadEmailDraft,
  sendLeadEmail,
  draftMassOutreach,
  sendMassOutreach,
  listMassOutreachCampaigns,
  setMassOutreachCampaignArchived,
  exportLeadsCsv,
  updateLeadStatus,
  hardDeleteLead,
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
};
