const { getClient } = require("./_lib/db");
const { validateLead, leadInsertPayload, clean, sendEmail, buildBrandedEmail, buildWelcomeEmailContent, normalizeLeadRow } = require("./_lib/helpers");
const { getAutoEmailSetting } = require("./admin/settings");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (req.query?.action === "checkin" || String(req.url || "").includes("/check-ins")) {
      return handleFacilityCheckIn(req, res);
    }

    const body = req.body || {};
    const errors = validateLead(body);
    if (errors.length) return res.status(422).json({ errors });

    const lead = leadInsertPayload(body, { source: body.source || "Website" });
    const db = getClient();

    const recentWindow = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: duplicate, error: dupError } = await db
      .from("leads")
      .select("id")
      .eq("phone", clean(lead.phone))
      .gte("created_at", recentWindow)
      .limit(1);
    if (dupError) throw dupError;
    if (duplicate?.length) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        message: "This lead was already saved recently. Thank you."
      });
    }

    let insertedId = null;
    let { data: insertData, error } = await db.from("leads").insert(lead).select("id");
    if (!error && insertData?.[0]?.id) insertedId = insertData[0].id;

    if (error && isSchemaMismatch(error)) {
      const baseLead = leadInsertPayload(body, { source: body.source || "Website" }, { includeOptional: false });
      const modernFallback = await db.from("leads").insert(baseLead).select("id");
      error = modernFallback.error;
      if (!error && modernFallback.data?.[0]?.id) insertedId = modernFallback.data[0].id;
    }

    if (error && isSchemaMismatch(error)) {
      const legacyLead = {
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email || "",
        preferred_community: lead.location || "Unknown",
        care_type: lead.care_type || "Not sure yet",
        message: [`Source: ${lead.source || "Website"}`, lead.notes].filter(Boolean).join(" | "),
        status: "New",
        relationship_to_resident: lead.relationship_to_resident || null,
        move_timeline: lead.move_timeline || null,
        payment_type: lead.payment_type || null,
        current_situation: lead.current_situation || null,
        preferred_contact_method: lead.preferred_contact_method || null,
        best_contact_time: lead.best_contact_time || null,
        priority_tags: lead.priority_tags || "",
        follow_up_at: lead.follow_up_at || null,
        follow_up_note: lead.follow_up_note || ""
      };
      const fallback = await db.from("leads").insert(legacyLead).select("id");
      error = fallback.error;
      if (!error && fallback.data?.[0]?.id) insertedId = fallback.data[0].id;
      if (error && isSchemaMismatch(error)) {
        const plainLegacyLead = {
          full_name: legacyLead.full_name,
          phone: legacyLead.phone,
          email: legacyLead.email,
          preferred_community: legacyLead.preferred_community,
          care_type: legacyLead.care_type,
          message: legacyLead.message,
          status: legacyLead.status
        };
        const plainFallback = await db.from("leads").insert(plainLegacyLead).select("id");
        error = plainFallback.error;
        if (!error && plainFallback.data?.[0]?.id) insertedId = plainFallback.data[0].id;
      }
    }

    if (error) throw error;

    await dualWriteV2Lead(db, lead);
    await autoSendWelcomeEmail(db, lead, body, insertedId);

    res.status(201).json({
      ok: true,
      message: "Thank you. Your information is securely stored. We never share your data."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

async function handleFacilityCheckIn(req, res) {
  const body = req.body || {};
  const visitorName = clean(body.visitorName || body.name);
  const community = clean(body.community || body.location);
  const visitingResident = clean(body.visitingResident || body.resident);
  const phone = normalizeCheckInPhone(body.phone);

  const errors = [];
  if (!visitorName) errors.push("Visitor name is required.");
  if (!community) errors.push("Community is required.");
  if (!visitingResident) errors.push("Resident or visit reason is required.");
  if (!phone) errors.push("Phone number is required.");
  if (errors.length) return res.status(422).json({ errors });

  const payload = {
    visitor_name: visitorName,
    phone,
    email: clean(body.email).toLowerCase() || null,
    community,
    visiting_resident: visitingResident,
    visit_purpose: clean(body.visitPurpose || body.purpose || "Family visit"),
    notes: clean(body.notes),
    check_in_source: "Facility Check-In"
  };

  const { error } = await getClient().from("facility_checkins").insert(payload);
  if (error) throw error;

  return res.status(201).json({
    ok: true,
    message: "Thank you. Your check-in has been securely recorded."
  });
}

async function dualWriteV2Lead(db, lead) {
  try {
    const locationName = clean(lead.location || lead.preferred_community || "");
    if (!locationName) return;
    const { data: locations, error: locationError } = await db
      .from("locations")
      .select("id")
      .ilike("name", locationName)
      .limit(1);
    if (locationError || !locations?.[0]?.id) return;

    const normalizedPhone = clean(lead.phone).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    const normalizedEmail = clean(lead.email).toLowerCase() || null;
    const recentWindow = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    let duplicateQuery = db
      .from("leads_v2")
      .select("id")
      .eq("location_id", locations[0].id)
      .eq("normalized_phone", normalizedPhone)
      .gte("created_at", recentWindow)
      .limit(1);
    const { data: duplicate, error: duplicateError } = await duplicateQuery;
    if (duplicateError || duplicate?.length) return;

    const { data: inserted, error } = await db.from("leads_v2").insert({
      location_id: locations[0].id,
      full_name: clean(lead.name || lead.full_name),
      phone: clean(lead.phone),
      email: normalizedEmail,
      normalized_phone: normalizedPhone,
      normalized_email: normalizedEmail,
      care_type: clean(lead.care_type || "Not sure yet"),
      source: ["Website", "Tablet"].includes(clean(lead.source)) ? clean(lead.source) : "Website",
      status: "new",
      relationship_to_resident: clean(lead.relationship_to_resident),
      move_timeline: clean(lead.move_timeline),
      payment_type: clean(lead.payment_type),
      current_situation: clean(lead.current_situation),
      preferred_contact_method: clean(lead.preferred_contact_method),
      best_contact_time: clean(lead.best_contact_time),
      priority_tags: clean(lead.priority_tags).split(",").map((tag) => clean(tag)).filter(Boolean),
      notes_summary: clean(lead.notes || lead.message)
    }).select("id").single();
    if (error || !inserted?.id) return;
    await db.from("intake_submissions").insert({
      location_id: locations[0].id,
      lead_id: inserted.id,
      source: clean(lead.source || "Website"),
      payload: lead
    });
  } catch (err) {
    console.error("dualWriteV2Lead skipped:", err.message);
  }
}

function normalizeCheckInPhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return clean(value);
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

async function autoSendWelcomeEmail(db, leadPayload, rawBody, leadId) {
  try {
    // Check if auto-email is enabled
    const enabled = await getAutoEmailSetting(db);
    if (!enabled) return;

    // Need an email to send to
    const email = clean(leadPayload.email || rawBody.email || "");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const firstName = clean(leadPayload.name || rawBody.name || rawBody.fullName || "").split(" ")[0] || "there";
    const community = clean(leadPayload.location || rawBody.location || rawBody.preferredCommunity || "Comfort Care Senior Living");
    const careType = clean(leadPayload.care_type || rawBody.careType || rawBody.care_type || "senior living");
    const notes = clean(leadPayload.notes || rawBody.notes || rawBody.message || "");

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    let subject = `Thank you for reaching out, ${firstName}`;
    let body = `Hi ${firstName},\n\nThank you for reaching out to Comfort Care Senior Living. We've received your inquiry about ${careType} at ${community} and one of our advisors will be in touch with you shortly.\n\nWe look forward to helping your family find the right care.\n\nWarmly,\nThe Comfort Care Team`;

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
        if (parsed.subject && parsed.body) { subject = parsed.subject; body = parsed.body; }
      } catch (aiErr) { console.error("Auto-email AI error:", aiErr.message); }
    }

    const html = buildBrandedEmail(body);
    const result = await sendEmail({ to: email, subject, body, html });
    console.log(`Auto-email sent to ${email}: ${result.status}`);

    // Log to lead timeline
    if (leadId) {
      await db.from("lead_events").insert({
        lead_id: Number(leadId),
        event_type: "auto_email_sent",
        detail: JSON.stringify({
          to: email,
          subject,
          status: result.status,
          mode: result.mode || "live"
        })
      });
    }
  } catch (err) {
    console.error("autoSendWelcomeEmail failed:", err.message);
  }
}

function isSchemaMismatch(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return message.includes("column") || message.includes("schema cache");
}
