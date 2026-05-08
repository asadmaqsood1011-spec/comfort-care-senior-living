const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const {
  toLeadCsv,
  parseDateFilter,
  clean,
  VALID_STATUSES,
  sendEmail,
  buildBrandedEmail,
  buildWelcomeEmailContent,
  personalizeEmail,
  leadInsertPayload,
  normalizeLeadRow,
  validateLead
} = require("../_lib/helpers");
const { getAutoEmailSetting, createCalendarTourEvent, deleteCalendarTourEvent } = require("./settings");

async function getLeads(db, params = {}) {
  const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return filterNormalizedLeads((data || []).map(normalizeLeadRow), params);
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getClient();
  const params = req.query || {};
  const urlPath = req.url || "";

  try {
    // Export CSV
    if (req.method === "GET" && (params.export === "csv" || urlPath.includes("/export"))) {
      const leads = await getLeads(db, params);
      const csv = toLeadCsv(leads);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="comfort-care-leads.csv"');
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(csv);
    }

    if (req.method === "GET" && params.action === "checkins") {
      const checkIns = await getFacilityCheckIns(db, params);
      return res.status(200).json({ checkIns });
    }

    // POST /api/admin/leads/import — bulk import CSV
    if (req.method === "POST" && urlPath.includes("/import")) {
      const csv = req.body?.csv || "";
      if (!csv) return res.status(422).json({ error: "No CSV provided." });
      const lines = csv.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
      const idx = (name) => headers.findIndex(h => h.includes(name));
      const nameIdx = idx("name"); const phoneIdx = idx("phone"); const emailIdx = idx("email");
      const communityIdx = idx("community") >= 0 ? idx("community") : idx("location");
      const careIdx = idx("care");
      const messageIdx = idx("message") >= 0 ? idx("message") : idx("notes");
      const inserted = []; const skipped = [];
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const phone = cols[phoneIdx] || "";
        if (!phone || !cols[nameIdx]) { skipped.push(line); continue; }
        const uploadLead = {
          fullName: cols[nameIdx] || "Unknown",
          phone,
          email: cols[emailIdx] || "",
          location: cols[communityIdx] || "Unknown",
          careType: cols[careIdx] || "Not sure yet",
          notes: cols[messageIdx] || "",
          source: "Upload"
        };
        const rowErrors = validateLead(uploadLead);
        if (rowErrors.length) { skipped.push(`${cols[nameIdx] || phone}: ${rowErrors.join(" ")}`); continue; }
        const { error } = await db.from("leads").insert({
          ...leadInsertPayload(uploadLead, {}, { includeOptional: false }),
          status: "New"
        });
        if (error) skipped.push(phone); else inserted.push(phone);
      }
      return res.status(200).json({ ok: true, message: `Imported ${inserted.length} lead${inserted.length !== 1 ? "s" : ""}.`, skipped });
    }

    // POST /api/admin/leads/manual — manually add one lead from admin
    if (req.method === "POST" && (params.action === "manual" || urlPath.includes("/manual"))) {
      const body = req.body || {};
      const fullName = clean(body.fullName || body.name || "");
      const phone = clean(body.phone || "");
      const email = clean(body.email || "").toLowerCase();

      const leadBody = {
        ...body,
        fullName,
        phone,
        email,
        location: clean(body.location || body.preferredCommunity || ""),
        careType: clean(body.careType || "Not sure yet"),
        notes: clean(body.notes || body.message || "Manually added by admin"),
        source: "Admin",
        status: "New"
      };
      const errors = validateLead(leadBody);
      if (errors.length) return res.status(422).json({ error: errors[0], errors });
      const insertResult = await insertLeadCompat(db, leadBody);
      if (insertResult.error) throw insertResult.error;
      if (insertResult.id) {
        await ensureLeadSource(db, insertResult.id, "Admin");
        await logLeadEvent(db, insertResult.id, "lead_created", "Manually added by admin");
      }
      await autoSendWelcomeEmail(db, leadBody, insertResult.id || null);
      return res.status(201).json({ ok: true, id: insertResult.id, message: "Lead added." });
    }

    // POST /api/admin/leads/:id/email-draft — generate editable AI email draft
    if (req.method === "POST" && params.id && urlPath.includes("/email-draft")) {
      const { data: row, error: fetchErr } = await db.from("leads").select("*").eq("id", params.id).single();
      if (fetchErr || !row) return res.status(404).json({ error: "Lead not found." });
      const draft = await generateLeadEmailDraft(normalizeLeadRow(row));
      await logLeadEvent(db, params.id, "email_generated", "AI email draft generated");
      return res.status(200).json({ ok: true, ...draft });
    }

    // POST /api/admin/leads/:id/email — send AI email to one lead
    if (req.method === "POST" && params.id && urlPath.includes("/email")) {
      const { data: row, error: fetchErr } = await db.from("leads").select("*").eq("id", params.id).single();
      if (fetchErr || !row) return res.status(404).json({ error: "Lead not found." });
      const lead = normalizeLeadRow(row);
      if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
        return res.status(422).json({ error: "This lead does not have a valid email address." });
      }

      let subject = clean(req.body?.subject || "");
      let body = clean(req.body?.body || "");
      if (!subject || !body) {
        const draft = await generateLeadEmailDraft(lead);
        subject = draft.subject;
        body = draft.body;
      }

      const personalizedBody = personalizeEmail(body, lead);
      const html = buildBrandedEmail(personalizedBody);
      const result = await sendEmail({ to: lead.email, subject, body: personalizedBody, html });
      await db.from("email_outreach").insert({ lead_id: lead.id, recipient_email: lead.email, subject, body: personalizedBody, status: result.status });
      const statusUpdate = await db.from("leads").update({ status: "Contacted", updated_at: new Date().toISOString() }).eq("id", lead.id);
      if (statusUpdate.error && isSchemaMismatch(statusUpdate.error)) {
        await db.from("leads").update({ status: "Contacted" }).eq("id", lead.id);
      }
      await logLeadEvent(db, lead.id, "email_sent", `${result.status}: ${subject}`);
      await logLeadEvent(db, lead.id, "status_changed", "Status changed to Contacted");
      return res.status(200).json({ ok: true, message: `Email sent to ${lead.email}`, subject });
    }

    // GET /api/admin/leads/:id/timeline — CRM-style lead activity
    if (req.method === "GET" && params.id && urlPath.includes("/timeline")) {
      const timeline = await getLeadTimeline(db, params.id);
      return res.status(200).json({ timeline });
    }

      if (req.method === "POST" && params.id && urlPath.includes("/tour")) {
      if (clean(req.body?.action || "") === "clear") {
        const { data: row } = await db.from("leads").select("*").eq("id", params.id).single();
        const current = normalizeLeadRow(row || {});
        const nextStatus = current.status === "Tour Scheduled" ? "Contacted" : current.status;
        const error = await clearLeadTour(db, params.id, current, nextStatus);
        if (error) throw error;
        try {
          const calendarDelete = await deleteCalendarTourEvent(db, params.id);
          if (calendarDelete?.deleted) await logLeadEvent(db, params.id, "calendar_event_deleted", "Calendar event removed");
        } catch (calendarError) {
          console.error("Calendar delete error:", calendarError.message);
          await logLeadEvent(db, params.id, "calendar_event_error", `Calendar delete failed: ${calendarError.message}`);
        }
        await logLeadEvent(db, params.id, "tour_cleared", "Tour cleared");
        if (nextStatus !== current.status) await logLeadEvent(db, params.id, "status_changed", `Status changed to ${nextStatus}`);
        return res.status(200).json({ ok: true, tourScheduledAt: "", status: nextStatus });
      }

      const tourScheduledAt = parseTourDate(req.body?.tourScheduledAt || "");
      if (!tourScheduledAt) return res.status(422).json({ error: "Choose a valid tour date and time." });

      const { data: row } = await db.from("leads").select("*").eq("id", params.id).single();
      let { error } = await db
        .from("leads")
        .update({ tour_scheduled_at: tourScheduledAt.toISOString(), status: "Tour Scheduled", updated_at: new Date().toISOString() })
        .eq("id", params.id);

      if (error && isSchemaMismatch(error)) {
        const retry = await db
          .from("leads")
          .update({ tour_scheduled_at: tourScheduledAt.toISOString(), status: "Tour Scheduled" })
          .eq("id", params.id);
        error = retry.error;
      }

      if (error && isSchemaMismatch(error)) {
        const current = normalizeLeadRow(row || {});
        const tourLine = `[Tour scheduled: ${tourScheduledAt.toISOString()}]`;
        const existingNotes = current.notes || "";
        const nextNotes = existingNotes.includes("[Tour scheduled:")
          ? existingNotes.replace(/\[Tour scheduled:[^\]]+\]/i, tourLine)
          : [existingNotes, tourLine].filter(Boolean).join("\n\n");
        let fallback = await db.from("leads").update({ status: "Tour Scheduled", notes: nextNotes }).eq("id", params.id);
        error = fallback.error;
        if (error && isSchemaMismatch(error)) {
          fallback = await db.from("leads").update({ status: "Tour Scheduled", message: nextNotes }).eq("id", params.id);
          error = fallback.error;
        }
      }

      if (error) throw error;
      let calendar = { skipped: true };
      try {
        calendar = await createCalendarTourEvent(db, normalizeLeadRow({ ...(row || {}), id: params.id }), tourScheduledAt);
        if (calendar?.ok) {
          await logLeadEvent(db, params.id, "calendar_event_created", `${calendar.updated ? "Updated" : "Created"} Google Calendar event`);
        }
      } catch (calendarError) {
        console.error("Calendar event error:", calendarError.message);
        calendar = { error: calendarError.message };
        await logLeadEvent(db, params.id, "calendar_event_error", `Calendar event failed: ${calendarError.message}`);
      }
      await logLeadEvent(db, params.id, "tour_scheduled", `Tour scheduled for ${tourScheduledAt.toLocaleString("en-US")}`);
      await logLeadEvent(db, params.id, "status_changed", "Status changed to Tour Scheduled");
      return res.status(200).json({ ok: true, tourScheduledAt: tourScheduledAt.toISOString(), status: "Tour Scheduled", calendar });
    }

    // POST /api/admin/leads/:id/reminder — set, complete, or clear a follow-up reminder
    if (req.method === "POST" && params.id && urlPath.includes("/reminder")) {
      const reminderAction = clean(req.body?.action || "");
      if (reminderAction === "complete" || reminderAction === "clear") {
        const { data: row } = await db.from("leads").select("*").eq("id", params.id).single();
        const current = normalizeLeadRow(row || {});
        const nextStatus = reminderAction === "complete" && current.status === "New" ? "Contacted" : current.status;
        const detail = reminderAction === "complete" ? "Follow-up marked done" : "Follow-up reminder cleared";
        const error = await clearLeadReminder(db, params.id, current, nextStatus);
        if (error) throw error;
        await logLeadEvent(db, params.id, reminderAction === "complete" ? "reminder_completed" : "reminder_cleared", detail);
        if (nextStatus !== current.status) await logLeadEvent(db, params.id, "status_changed", `Status changed to ${nextStatus}`);
        return res.status(200).json({ ok: true, followUpAt: "", followUpNote: "", status: nextStatus });
      }

      const followUpAt = parseReminderDate(req.body?.followUpAt || req.body?.preset || "");
      if (!followUpAt) return res.status(422).json({ error: "Choose a valid follow-up date." });
      const followUpNote = clean(req.body?.note || "Follow up with this lead").slice(0, 240);

      const { data: row } = await db.from("leads").select("*").eq("id", params.id).single();
      let { error } = await db
        .from("leads")
        .update({ follow_up_at: followUpAt.toISOString(), follow_up_note: followUpNote, updated_at: new Date().toISOString() })
        .eq("id", params.id);

      if (error && isSchemaMismatch(error)) {
        const retry = await db
          .from("leads")
          .update({ follow_up_at: followUpAt.toISOString(), follow_up_note: followUpNote })
          .eq("id", params.id);
        error = retry.error;
      }

      if (error && isSchemaMismatch(error)) {
        const current = normalizeLeadRow(row || {});
        const reminderLine = `[Follow-up due: ${followUpAt.toISOString()}] ${followUpNote}`;
        const existingNotes = current.notes || "";
        const nextNotes = existingNotes.includes("[Follow-up due:")
          ? existingNotes.replace(/\[Follow-up due:[^\]]+\]\s*[^\n]*/i, reminderLine)
          : [existingNotes, reminderLine].filter(Boolean).join("\n\n");
        let fallback = await db.from("leads").update({ notes: nextNotes, updated_at: new Date().toISOString() }).eq("id", params.id);
        error = fallback.error;
        if (error && isSchemaMismatch(error)) {
          fallback = await db.from("leads").update({ notes: nextNotes }).eq("id", params.id);
          error = fallback.error;
        }
        if (error && isSchemaMismatch(error)) {
          const messageFallback = await db.from("leads").update({ message: nextNotes }).eq("id", params.id);
          error = messageFallback.error;
        }
      }

      if (error) throw error;
      await logLeadEvent(db, params.id, "reminder_set", `Follow-up set for ${followUpAt.toLocaleDateString("en-US")}: ${followUpNote}`);
      return res.status(200).json({ ok: true, followUpAt: followUpAt.toISOString(), followUpNote });
    }

    // GET /api/admin/leads/:id/emails — email history for a lead
    if (req.method === "GET" && params.id && urlPath.includes("/emails")) {
      const { data, error } = await db.from("email_outreach").select("*").eq("lead_id", params.id).order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ emails: data || [] });
    }

    // POST /api/admin/leads/:id/notes — save notes for a lead
    if (req.method === "POST" && params.id && (params.action === "notes" || urlPath.includes("/notes"))) {
      const notes = clean(req.body?.notes || "").slice(0, 2000);
      let { error } = await db.from("leads").update({ notes, updated_at: new Date().toISOString() }).eq("id", params.id);
      if (error && isSchemaMismatch(error)) {
        const fallback = await db.from("leads").update({ notes }).eq("id", params.id);
        error = fallback.error;
      }
      if (error && isSchemaMismatch(error)) {
        const fallback = await db.from("leads").update({ message: notes }).eq("id", params.id);
        error = fallback.error;
      }
      if (error) throw error;
      await logLeadEvent(db, params.id, "notes_saved", "Notes saved");
      return res.status(200).json({ ok: true });
    }

    // PATCH status — /api/admin/leads/:id/status
    if (req.method === "PATCH" && params.id) {
      const status = clean(req.body?.status || "");
      if (!VALID_STATUSES.has(status)) return res.status(422).json({ error: "Invalid status." });
      const { data: row } = await db.from("leads").select("*").eq("id", params.id).single();
      let error = null;
      if (status === "Tour Scheduled") {
        const current = normalizeLeadRow(row || {});
        if (!current.tourScheduledAt) return res.status(422).json({ error: "Choose a tour date and time before marking Tour Scheduled." });
        const result = await db.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", params.id);
        error = result.error;
        if (error && isSchemaMismatch(error)) {
          const fallback = await db.from("leads").update({ status }).eq("id", params.id);
          error = fallback.error;
        }
      } else {
        error = await clearLeadTour(db, params.id, normalizeLeadRow(row || {}), status);
      }
      if (error) throw error;
      await logLeadEvent(db, params.id, "status_changed", `Status changed to ${status}`);
      return res.status(200).json({ ok: true });
    }

    // DELETE — /api/admin/leads?id=123
    if (req.method === "DELETE" && params.id) {
      await db.from("lead_events").delete().eq("lead_id", params.id);
      await db.from("email_outreach").delete().eq("lead_id", params.id);
      const { error } = await db.from("leads").delete().eq("id", params.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // GET list
    if (req.method === "GET") {
      const leads = await getLeads(db, params);
      return res.status(200).json({ leads });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

function filterNormalizedLeads(leads, params = {}) {
  const community = clean(params.community || params.location || "");
  const source = clean(params.source || "");
  const status = clean(params.status || "");
  const priority = clean(params.priority || "");
  const score = clean(params.score || "");
  const dateFrom = parseDateFilter(params.dateFrom, false);
  const dateTo = parseDateFilter(params.dateTo, true);
  return leads.filter((lead) => {
    const submitted = new Date(lead.submittedAt);
    const location = lead.location || lead.preferredCommunity || "";
    return (!community || location === community)
      && (!source || lead.source === source)
      && (!status || (VALID_STATUSES.has(status) && lead.status === status))
      && (!priority || (lead.priorityTags || []).includes(priority))
      && (!score || lead.activityLabel === score)
      && (!dateFrom || submitted >= dateFrom)
      && (!dateTo || submitted <= dateTo);
  });
}

async function insertLeadCompat(db, body) {
  const lead = leadInsertPayload(body, { source: "Admin" });
  let response = await db.from("leads").insert(lead).select("id").single();
  let error = response.error;
  let id = response.data?.id;

  if (error && isSchemaMismatch(error)) {
    const baseLead = leadInsertPayload(body, { source: "Admin" }, { includeOptional: false });
    response = await db.from("leads").insert(baseLead).select("id").single();
    error = response.error;
    id = response.data?.id;
  }

  if (error && isSchemaMismatch(error)) {
    const legacyLead = {
      full_name: lead.name,
      phone: lead.phone,
      email: lead.email || "",
      preferred_community: lead.location || "Unknown",
      care_type: lead.care_type || "Not sure yet",
      message: [`Source: ${lead.source || "Admin"}`, lead.notes].filter(Boolean).join(" | "),
      status: "New",
      relationship_to_resident: lead.relationship_to_resident || null,
      move_timeline: lead.move_timeline || null,
      payment_type: lead.payment_type || null,
      current_situation: lead.current_situation || null,
      preferred_contact_method: lead.preferred_contact_method || null,
      best_contact_time: lead.best_contact_time || null,
      priority_tags: lead.priority_tags || ""
    };
    response = await db.from("leads").insert(legacyLead).select("id").single();
    error = response.error;
    id = response.data?.id;
    if (error && isSchemaMismatch(error)) {
      response = await db.from("leads").insert({
        full_name: legacyLead.full_name,
        phone: legacyLead.phone,
        email: legacyLead.email,
        preferred_community: legacyLead.preferred_community,
        care_type: legacyLead.care_type,
        message: legacyLead.message,
        status: legacyLead.status
      }).select("id").single();
      error = response.error;
      id = response.data?.id;
    }
  }

  return { error, id };
}

async function ensureLeadSource(db, leadId, source) {
  const { error } = await db.from("leads").update({ source }).eq("id", leadId);
  if (error && !isSchemaMismatch(error)) {
    console.error("Lead source update error:", error.message || error);
  }
}

async function getFacilityCheckIns(db, params = {}) {
  let query = db.from("facility_checkins").select("*").order("created_at", { ascending: false }).limit(500);
  if (params.community) query = query.eq("community", clean(params.community));
  if (params.dateFrom) query = query.gte("created_at", new Date(`${params.dateFrom}T00:00:00`).toISOString());
  if (params.dateTo) query = query.lte("created_at", new Date(`${params.dateTo}T23:59:59`).toISOString());
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    visitorName: row.visitor_name || "",
    phone: row.phone || "",
    email: row.email || "",
    community: row.community || "",
    visitingResident: row.visiting_resident || "",
    visitPurpose: row.visit_purpose || "",
    notes: row.notes || "",
    checkInSource: row.check_in_source || "Facility Check-In",
    createdAt: row.created_at || ""
  }));
}

async function generateLeadEmailDraft(lead) {
  const firstName = clean(lead.fullName || "").split(" ")[0] || "there";
  let subject = `Following up from Comfort Care Senior Living`;
  let body = `Hi ${firstName},\n\nThank you for your interest in ${lead.location || "Comfort Care"}. Based on your interest in ${lead.careType || "senior living"}, our team would be happy to answer questions about care options, transparent pricing, and scheduling a private tour.\n\nWould you like to set up a quick call?\n\nWarmly,\nThe Comfort Care Team`;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  if (!OPENAI_API_KEY) return { subject, body, ai: false };

  try {
    const prompt = `Write a short, warm, personalized follow-up email for Comfort Care Senior Living.

Lead details:
- Name: ${lead.fullName}
- Care type: ${lead.careType || "Not sure yet"}
- Location/community: ${lead.location || "Comfort Care"}
- Notes: "${lead.notes || "No notes provided"}"

Rules:
- Start with "Hi ${firstName},"
- Mention the location/community naturally if provided
- Reference the care type and notes empathetically
- Under 140 words
- Warm, human, not salesy
- Sign off as "The Comfort Care Team"
- Return JSON with keys: subject and body`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 420
      })
    });
    const aiData = await aiRes.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
    if (parsed.subject && parsed.body) {
      subject = clean(parsed.subject);
      body = clean(parsed.body);
      return { subject, body, ai: true };
    }
  } catch (e) {
    console.error("AI draft error:", e.message);
  }

  return { subject, body, ai: false };
}

async function getLeadTimeline(db, id) {
  const timeline = [];
  const { data: row } = await db.from("leads").select("*").eq("id", id).single();
  const lead = normalizeLeadRow(row || {});

  if (lead.submittedAt) {
    timeline.push({
      type: "lead_created",
      label: "Lead created",
      detail: `${lead.source || "Website"} lead for ${lead.location || "Unknown location"}`,
      createdAt: lead.submittedAt
    });
  }

  const eventResult = await db
    .from("lead_events")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });
  if (!eventResult.error && eventResult.data?.length) {
    eventResult.data.forEach((event) => {
      timeline.push({
        type: event.event_type || "activity",
        label: labelEventType(event.event_type),
        detail: formatEventDetail(event.event_type, event.detail),
        createdAt: event.created_at
      });
    });
  }

  const { data: emails } = await db
    .from("email_outreach")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });
  (emails || []).forEach((email) => {
    timeline.push({
      type: "email_sent",
      label: "Email sent",
      detail: `${email.status || "Sent"}: ${email.subject || "Email"}`,
      createdAt: email.sent_at || email.created_at
    });
  });

  if (lead.followUpAt) {
    timeline.push({
      type: "reminder_set",
      label: "Follow-up reminder",
      detail: lead.followUpNote || "Follow up with this lead",
      createdAt: lead.followUpAt
    });
  }

  if (lead.status === "Tour Scheduled" && lead.tourScheduledAt) {
    timeline.push({
      type: "tour_scheduled",
      label: "Tour scheduled",
      detail: `Tour scheduled for ${new Date(lead.tourScheduledAt).toLocaleString("en-US")}`,
      createdAt: lead.tourScheduledAt
    });
  }

  if (lead.status) {
    timeline.push({
      type: "status_current",
      label: "Current status",
      detail: lead.status,
      createdAt: lead.updatedAt || lead.submittedAt
    });
  }

  return timeline
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function logLeadEvent(db, leadId, eventType, detail = "") {
  const { error } = await db.from("lead_events").insert({
    lead_id: Number(leadId),
    event_type: eventType,
    detail: clean(detail).slice(0, 500)
  });
  if (error && !isSchemaMismatch(error)) {
    console.error("Lead event error:", error.message || error);
  }
}

function labelEventType(type) {
  return {
    lead_created: "Lead created",
    notes_saved: "Notes saved",
    email_generated: "Email generated",
    email_sent: "Email sent",
    status_changed: "Status changed",
    reminder_set: "Follow-up reminder",
    reminder_completed: "Follow-up completed",
    reminder_cleared: "Follow-up cleared",
    mass_email_sent: "Mass email outreach",
    auto_email_sent: "Auto welcome email sent",
    tour_scheduled: "Tour scheduled",
    tour_cleared: "Tour cleared"
  }[type] || "Activity";
}

function formatEventDetail(type, detail) {
  if (type === "auto_email_sent") {
    try {
      const parsed = JSON.parse(detail || "{}");
      return `To: ${parsed.to || ""} — ${parsed.subject || ""} (${parsed.status || "Sent"})`;
    } catch { return detail || ""; }
  }
  if (type !== "mass_email_sent") return detail || "";
  try {
    const parsed = JSON.parse(detail || "{}");
    return `${parsed.campaignName || "Mass outreach campaign"}: ${parsed.status || "Sent"}`;
  } catch {
    return detail || "";
  }
}

async function clearLeadReminder(db, leadId, lead, nextStatus) {
  const nextNotes = removeReminderFromNotes(lead.notes || "");
  const statusPatch = nextStatus ? { status: nextStatus } : {};
  const attempts = [
    { follow_up_at: null, follow_up_note: "", notes: nextNotes, updated_at: new Date().toISOString(), ...statusPatch },
    { follow_up_at: null, follow_up_note: "", notes: nextNotes, ...statusPatch },
    { follow_up_at: null, follow_up_note: "", updated_at: new Date().toISOString(), ...statusPatch },
    { follow_up_at: null, follow_up_note: "", ...statusPatch },
    { notes: nextNotes, updated_at: new Date().toISOString(), ...statusPatch },
    { notes: nextNotes, ...statusPatch },
    { message: nextNotes, ...statusPatch },
    { ...statusPatch }
  ];

  let lastError = null;
  for (const patch of attempts) {
    if (!Object.keys(patch).length) continue;
    const { error } = await db.from("leads").update(patch).eq("id", leadId);
    if (!error) return null;
    lastError = error;
    if (!isSchemaMismatch(error)) return error;
  }
  return lastError;
}

async function clearLeadTour(db, leadId, lead, nextStatus) {
  const nextNotes = removeTourFromNotes(lead.notes || "");
  const statusPatch = nextStatus ? { status: nextStatus } : {};
  const attempts = [
    { tour_scheduled_at: null, notes: nextNotes, updated_at: new Date().toISOString(), ...statusPatch },
    { tour_scheduled_at: null, notes: nextNotes, ...statusPatch },
    { tour_scheduled_at: null, updated_at: new Date().toISOString(), ...statusPatch },
    { tour_scheduled_at: null, ...statusPatch },
    { notes: nextNotes, updated_at: new Date().toISOString(), ...statusPatch },
    { notes: nextNotes, ...statusPatch },
    { message: nextNotes, ...statusPatch },
    { ...statusPatch }
  ];

  let lastError = null;
  for (const patch of attempts) {
    if (!Object.keys(patch).length) continue;
    const { error } = await db.from("leads").update(patch).eq("id", leadId);
    if (!error) return null;
    lastError = error;
    if (!isSchemaMismatch(error)) return error;
  }
  return lastError;
}

function removeReminderFromNotes(notes) {
  return clean(String(notes || "")
    .replace(/\[Follow-up due:[^\]]+\]\s*[^\n]*(\n{0,2})/gi, "")
    .replace(/\n{3,}/g, "\n\n"));
}

function removeTourFromNotes(notes) {
  return clean(String(notes || "")
    .replace(/\[Tour scheduled:[^\]]+\](\n{0,2})/gi, "")
    .replace(/\n{3,}/g, "\n\n"));
}

function parseReminderDate(value) {
  const cleaned = clean(value || "");
  const now = new Date();
  if (cleaned === "tomorrow") return addDays(now, 1);
  if (cleaned === "3-days") return addDays(now, 3);
  if (cleaned === "1-week") return addDays(now, 7);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return new Date(`${cleaned}T09:00:00.000`);
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTourDate(value) {
  const cleaned = clean(value || "");
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(9, 0, 0, 0);
  return next;
}

function isSchemaMismatch(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return message.includes("column")
    || message.includes("schema cache")
    || message.includes("relation")
    || message.includes("does not exist");
}

async function autoSendWelcomeEmail(db, leadBody, leadId) {
  try {
    console.log("autoSendWelcomeEmail called, email:", leadBody.email || "(none)");
    const enabled = await getAutoEmailSetting(db);
    console.log("auto_email_leads enabled:", enabled);
    if (!enabled) return;

    const email = clean(leadBody.email || "");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const firstName = clean(leadBody.fullName || leadBody.name || "").split(" ")[0] || "there";
    const community = clean(leadBody.location || leadBody.preferredCommunity || "Comfort Care Senior Living");
    const careType = clean(leadBody.careType || leadBody.care_type || "senior living");
    const notes = clean(leadBody.notes || leadBody.message || "");

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    let subject = `Thank you for reaching out, ${firstName}`;
    let bodyText = `Hi ${firstName},\n\nThank you for reaching out to Comfort Care Senior Living. We've received your inquiry about ${careType} at ${community} and one of our advisors will be in touch with you shortly.\n\nWe look forward to helping your family find the right care.\n\nWarmly,\nThe Comfort Care Team`;

    if (OPENAI_API_KEY) {
      try {
        const prompt = `Write a short, warm welcome email for a family who just submitted a lead for Comfort Care Senior Living.

Lead details:
- Name: ${firstName}
- Community interested in: ${community}
- Care type: ${careType}
- Their message: "${notes}"

Instructions:
- Start with "Hi ${firstName},"
- If their message mentions a specific person (e.g. "his dad", "my mom"), reference that person by name/relationship in the email
- If their message mentions urgency, acknowledge it directly — do not ignore it
- If their message has any personal detail at all, use it — never write a generic email when personal context exists
- Keep it under 120 words, warm and human
- End with: "One of our advisors will be in touch with you shortly."
- Sign off as "The Comfort Care Team"
- Return JSON with keys: subject (string) and body (string)`;

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 350 })
        });
        const aiData = await aiRes.json();
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
        if (parsed.subject && parsed.body) { subject = parsed.subject; bodyText = parsed.body; }
      } catch (aiErr) { console.error("Auto-email AI error:", aiErr.message); }
    }

    const html = buildBrandedEmail(bodyText);
    const result = await sendEmail({ to: email, subject, body: bodyText, html });
    console.log(`Auto-email sent to ${email}: ${result.status}`);

    if (leadId) {
      await db.from("lead_events").insert({
        lead_id: Number(leadId),
        event_type: "auto_email_sent",
        detail: JSON.stringify({ to: email, subject, status: result.status, mode: result.mode || "live" })
      });
    }
  } catch (err) {
    console.error("autoSendWelcomeEmail (admin) failed:", err.message);
  }
}
