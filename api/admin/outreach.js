const { getClient } = require("../_lib/db");
const { isAuthenticated } = require("../_lib/auth");
const { clean, sendEmail, buildBrandedEmail, personalizeEmail, mostCommon, VALID_STATUSES, VALID_SOURCES, normalizeLeadRow } = require("../_lib/helpers");

async function getLeadsByFilters(db, filters = {}) {
  const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const leads = (data || []).map(normalizeLeadRow);
  const community = clean(filters.community || filters.location || "");
  const communities = Array.isArray(filters.communities)
    ? filters.communities.map(clean).filter(Boolean)
    : [];
  const source = clean(filters.source || "");
  const status = clean(filters.status || "");
  const priority = clean(filters.priority || "");
  const score = clean(filters.score || "");
  return leads.filter((lead) => {
    const location = lead.location || lead.preferredCommunity || "";
    return (!community || location === community)
      && (!communities.length || communities.includes(location))
      && (!source || (VALID_SOURCES.has(source) && lead.source === source))
      && (!status || (VALID_STATUSES.has(status) && lead.status === status))
      && (!priority || (lead.priorityTags || []).includes(priority))
      && (!score || lead.activityLabel === score);
  });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (!isAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

  const db = getClient();
  const body = req.body || {};
  // Support both ?action=X and /outreach/X path styles
  const urlPath = req.url || "";
  const action = req.query?.action
    || (urlPath.includes("/archive") ? "archive" : urlPath.includes("/history") ? "history" : urlPath.includes("/draft") ? "draft" : urlPath.includes("/send") ? "send" : "");
  console.log("outreach method:", req.method, "url:", urlPath, "action:", action);

  try {
    if (req.method === "GET" && action === "history") {
      const history = await getCampaignHistory(db, req.query?.archived === "true");
      return res.status(200).json({ campaigns: history });
    }

    if (req.method === "POST" && action === "archive") {
      const campaignId = clean(body.campaignId || "");
      if (!campaignId) return res.status(422).json({ error: "Campaign id is required." });
      const archived = body.archived !== false;
      await setCampaignArchived(db, campaignId, archived);
      return res.status(200).json({ ok: true, archived });
    }

    // Draft
    if (action === "draft") {
      const filters = body.filters || {};
      const leads = await getLeadsByFilters(db, filters);
      const community = clean(filters.community || "");
      const careType = mostCommon(leads.map((l) => l.careType)) || "senior living";
      const targetCommunity = community || mostCommon(leads.map((l) => l.location)) || "Comfort Care";

      const subjectHint = clean(body.subjectHint || "");
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
      if (OPENAI_API_KEY) {
        try {
          const prompt = `You write reusable campaign email templates for Comfort Care Senior Living.

Create ONE reusable email template for a bulk lead campaign. It will be personalized separately for each recipient at send time.

Campaign context:
- Matching leads: ${leads.length}
- Community filter: ${community || "All communities"}
- Common care interest: ${careType}
- Default community context if needed: ${targetCommunity}
${subjectHint ? `- Campaign theme or subject hint: "${subjectHint}"` : ""}

Instructions:
- This must NOT be written to one real person.
- Do NOT include any actual lead name, phone, email, or one person's notes.
- Start the body with exactly: Hi {{first_name}},
- Use placeholders where personalization belongs: {{first_name}}, {{community}}, {{care_type}}, {{lead_message}}
- Subject may use {{community}} only if useful.
- If the campaign is for all communities, do not hardcode ${targetCommunity}; use {{community}}.
- Keep it under 150 words, warm and human, not salesy
- Sign off as "The Comfort Care Team"
- Return JSON with keys: subject (string) and body (string)`;
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 500 })
          });
          const aiData = await aiRes.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          if (parsed.subject && parsed.body) {
            return res.status(200).json({ subject: parsed.subject, body: parsed.body, recipients: leads.length, ai: true });
          }
        } catch (err) { console.error("OpenAI draft error:", err.message); }
      }

      const subject = community ? "A personal note from {{community}}" : "A personal note from Comfort Care Senior Living";
      const bodyText = `Hi {{first_name}},\n\nI wanted to personally follow up from Comfort Care Senior Living. Based on your interest in {{care_type}} at {{community}}, our team can help answer questions about care options, transparent pricing, and scheduling a private tour.\n\nIf there is anything specific you shared with us, our team will review it carefully: {{lead_message}}\n\nWould you like to schedule a call or tour?\n\nWarmly,\nThe Comfort Care Team`;
      return res.status(200).json({ subject, body: bodyText, recipients: leads.length, ai: false });
    }

    // Send
    if (action === "send") {
      const subject = clean(body.subject || "");
      const emailBody = clean(body.body || "");
      if (!subject || !emailBody) return res.status(422).json({ error: "Subject and body are required." });

      const leads = await getLeadsByFilters(db, body.filters || {});
      const validLeads = leads.filter((l) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email));
      const campaignId = `cmp_${Date.now().toString(36)}`;
      const campaignName = clean(body.campaignName || subject).slice(0, 120) || "Mass outreach campaign";

      const testRecipient = clean(body.testRecipient || "").toLowerCase();
      if (testRecipient) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) return res.status(422).json({ error: "Enter a valid test email." });
        const sampleLead = validLeads[0] || { fullName: "Test Recipient", location: "Comfort Care", careType: "Senior Living" };
        const personalizedSubject = personalizeEmail(subject, sampleLead);
        const personalizedBody = personalizeEmail(emailBody, { ...sampleLead, email: testRecipient });
        const result = await sendEmail({ to: testRecipient, subject: `[TEST] ${personalizedSubject}`, body: personalizedBody, html: buildBrandedEmail(personalizedBody) });
        await db.from("email_outreach").insert({ lead_id: sampleLead.id || 0, recipient_email: testRecipient, subject: `[TEST] ${personalizedSubject}`, body: personalizedBody, status: result.status });
        return res.status(200).json({ ok: true, sent: 1, mode: result.mode, message: result.message });
      }

      const targets = validLeads.slice(0, 50);
      let sent = 0, failed = 0;
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
      const demoOnly = body.demoOnly === true;

      await insertCampaignMarker(db, {
        campaignId,
        campaignName,
        subject,
        body: emailBody,
        filters: body.filters || {},
        recipientCount: targets.length,
        mode: demoOnly ? "Demo" : "Live"
      });

      for (const lead of targets) {
        const firstName = clean(lead.fullName || "").split(" ")[0] || "there";
        const community = lead.location || "Comfort Care";
        const careType = lead.careType || "senior living";
        const leadMsg = lead.notes || "";
        const personalContext = [careType, leadMsg].filter(Boolean).join(" | ");

        let finalSubject = personalizeEmail(subject, lead);
        let finalBody = personalizeEmail(emailBody, lead);

        // Bulk outreach personalizes every recipient. The single-lead drawer AI is handled separately.
        if (OPENAI_API_KEY) {
          try {
            const perLeadPrompt = `Write a short, warm, personalized outreach email for Comfort Care Senior Living.

Recipient details:
- Name: ${firstName}
- Community interested in: ${community}
- Their notes/context: "${personalContext}"

Campaign template subject:
"${subject}"

Campaign template body:
"${emailBody}"

STRICT rules:
1. Start with "Hi ${firstName},"
2. Use the campaign template as the theme, but personalize it to this one recipient.
3. Their notes say: "${personalContext}" - extract any useful personal detail such as family member, urgency, or concern and reference it naturally.
4. Mention ${community} naturally.
5. Under 150 words, human and warm, never generic.
6. Sign off as "The Comfort Care Team".
7. Return JSON with keys: subject (string) and body (string)`;
            const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: perLeadPrompt }], response_format: { type: "json_object" }, max_tokens: 400 })
            });
            const aiData = await aiRes.json();
            const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
            if (parsed.subject) finalSubject = clean(parsed.subject);
            if (parsed.body) finalBody = parsed.body;
          } catch (err) { console.error(`AI per-lead error for ${lead.email}:`, err.message); }
        }

        const result = demoOnly
          ? { mode: "demo", status: "Demo Sent", message: "Demo outreach logged." }
          : await sendEmail({ to: lead.email, subject: finalSubject, body: finalBody, html: buildBrandedEmail(finalBody) });
        await db.from("email_outreach").insert({ lead_id: lead.id, recipient_email: lead.email, subject: finalSubject, body: finalBody, status: result.status });
        await logCampaignEvent(db, lead, {
          campaignId,
          campaignName,
          subject: finalSubject,
          status: result.status,
          mode: result.mode || (demoOnly ? "demo" : "live"),
          recipientEmail: lead.email
        });
        if (!demoOnly) {
          const statusUpdate = await db.from("leads").update({ status: "Contacted", updated_at: new Date().toISOString() }).eq("id", lead.id);
          if (statusUpdate.error) {
            await db.from("leads").update({ status: "Contacted" }).eq("id", lead.id);
          }
        }
        if (result.status === "Sent") sent++; else failed++;
      }
      return res.status(200).json({
        ok: true,
        sent,
        failed,
        campaignId,
        message: demoOnly
          ? `Demo campaign logged for ${targets.length} lead${targets.length !== 1 ? "s" : ""}.`
          : `Sent ${sent} email${sent !== 1 ? "s" : ""}.`
      });
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

async function insertCampaignMarker(db, campaign) {
  const payload = {
    lead_id: 0,
    recipient_email: `campaign:${campaign.campaignId}`,
    subject: campaign.campaignName,
    body: JSON.stringify(campaign),
    status: campaign.mode === "Demo" ? "Campaign Demo" : "Campaign Live"
  };
  const { error } = await db.from("email_outreach").insert(payload);
  if (error) console.error("Campaign marker error:", error.message || error);
}

async function logCampaignEvent(db, lead, campaign) {
  const detail = JSON.stringify(campaign);
  const { error } = await db.from("lead_events").insert({
    lead_id: Number(lead.id),
    event_type: "mass_email_sent",
    detail
  });
  if (error) console.error("Campaign event error:", error.message || error);
}

async function getCampaignHistory(db, includeArchived = false) {
  const [markersResult, eventsResult, leadsResult] = await Promise.all([
    db.from("email_outreach").select("*").order("created_at", { ascending: false }).limit(400),
    db.from("lead_events").select("*").eq("event_type", "mass_email_sent").order("created_at", { ascending: false }).limit(1000),
    db.from("leads").select("*").order("created_at", { ascending: false }).limit(1000)
  ]);

  const leadsById = new Map((leadsResult.data || []).map((row) => {
    const lead = normalizeLeadRow(row);
    return [String(lead.id), lead];
  }));
  const campaigns = new Map();

  (markersResult.data || [])
    .filter((row) => String(row.recipient_email || "").startsWith("campaign:"))
    .forEach((row) => {
      const parsed = parseJson(row.body);
      const campaignId = parsed.campaignId || String(row.recipient_email).replace(/^campaign:/, "");
      campaigns.set(campaignId, {
        id: campaignId,
        name: parsed.campaignName || row.subject || "Mass outreach campaign",
        subject: parsed.subject || row.subject || "",
        body: parsed.body || "",
        filters: parsed.filters || {},
        mode: parsed.mode || (String(row.status || "").includes("Demo") ? "Demo" : "Live"),
        archived: parsed.archived === true,
        expectedRecipients: Number(parsed.recipientCount || 0),
        createdAt: row.created_at || row.sent_at || "",
        recipients: []
      });
    });

  (eventsResult.data || []).forEach((event) => {
    const parsed = parseJson(event.detail);
    if (!parsed.campaignId) return;
    if (!campaigns.has(parsed.campaignId)) {
      campaigns.set(parsed.campaignId, {
        id: parsed.campaignId,
        name: parsed.campaignName || "Mass outreach campaign",
        subject: parsed.subject || "",
        body: "",
        filters: {},
        mode: parsed.mode === "demo" ? "Demo" : "Live",
        archived: false,
        expectedRecipients: 0,
        createdAt: event.created_at,
        recipients: []
      });
    }
    const campaign = campaigns.get(parsed.campaignId);
    const lead = leadsById.get(String(event.lead_id));
    campaign.recipients.push({
      leadId: event.lead_id,
      name: lead?.fullName || "Unknown lead",
      email: parsed.recipientEmail || lead?.email || "",
      community: lead?.location || lead?.preferredCommunity || "",
      status: parsed.status || "Sent",
      subject: parsed.subject || campaign.subject,
      createdAt: event.created_at
    });
    if (!campaign.createdAt || new Date(event.created_at) < new Date(campaign.createdAt)) campaign.createdAt = event.created_at;
  });

  return [...campaigns.values()]
    .filter((campaign) => includeArchived || !campaign.archived)
    .map((campaign) => {
      const sent = campaign.recipients.filter((item) => /sent/i.test(item.status)).length;
      const failed = campaign.recipients.filter((item) => /failed/i.test(item.status)).length;
      return {
        ...campaign,
        sent,
        failed,
        recipientCount: campaign.recipients.length || campaign.expectedRecipients,
        recipients: campaign.recipients.slice(0, 100)
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20);
}

async function setCampaignArchived(db, campaignId, archived) {
  const recipientEmail = `campaign:${campaignId}`;
  const { data } = await db
    .from("email_outreach")
    .select("*")
    .eq("recipient_email", recipientEmail)
    .limit(1);
  const existing = data?.[0];
  const parsed = parseJson(existing?.body);
  const nextBody = JSON.stringify({
    ...parsed,
    campaignId,
    campaignName: parsed.campaignName || existing?.subject || "Mass outreach campaign",
    archived,
    archivedAt: archived ? new Date().toISOString() : ""
  });

  if (existing?.id) {
    const { error } = await db
      .from("email_outreach")
      .update({ body: nextBody, status: archived ? "Campaign Archived" : (parsed.mode === "Demo" ? "Campaign Demo" : "Campaign Live") })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await db.from("email_outreach").insert({
    lead_id: 0,
    recipient_email: recipientEmail,
    subject: parsed.campaignName || "Mass outreach campaign",
    body: nextBody,
    status: archived ? "Campaign Archived" : "Campaign Live"
  });
  if (error) throw error;
}

function parseJson(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}
