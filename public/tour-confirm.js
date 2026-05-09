(function () {
  const params = new URLSearchParams(location.search);
  const path = location.pathname.match(/^\/tour\/([^/]+)/);
  const tourId = path ? path[1] : "";
  const token = params.get("t") || "";
  const greet = document.querySelector("[data-greeting]");
  const meta = document.querySelector("[data-meta]");
  const actions = document.querySelector("[data-actions]");
  const status = document.querySelector("[data-status]");
  const fmt = (iso) => {
    if (!iso) return "TBD";
    try { return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)); }
    catch (_) { return iso; }
  };

  if (!tourId || !token) {
    greet.textContent = "This link is missing details. Please contact your community.";
    return;
  }

  fetch(`/api/v2/public/tours/${encodeURIComponent(tourId)}?t=${encodeURIComponent(token)}`)
    .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      if (!ok) { greet.textContent = j.error || "Unable to load tour."; return; }
      const name = j.lead?.full_name ? `Hi ${j.lead.full_name.split(" ")[0]} —` : "Hi there —";
      greet.textContent = `${name} here are the details for your upcoming visit.`;
      meta.innerHTML = `
        <div><span>When</span><strong>${fmt(j.tour.scheduled_at)}</strong></div>
        <div><span>Where</span><strong>${j.location?.name || "Comfort Care Senior Living"}</strong>${j.location?.address ? `<br><small>${j.location.address}</small>` : ""}</div>
        ${j.location?.phone ? `<div><span>Community phone</span><strong>${j.location.phone}</strong></div>` : ""}
        ${j.tour.notes ? `<div><span>Notes from your contact</span><strong>${j.tour.notes}</strong></div>` : ""}
      `;
      meta.hidden = false;
      if (j.tour.status === "cancelled") {
        status.textContent = "This tour has been cancelled. Please call the community to reschedule.";
      } else {
        actions.hidden = false;
      }
    })
    .catch((err) => { greet.textContent = "Network error. Please try again."; console.error(err); });

  document.querySelector("[data-confirm]").addEventListener("click", () => respond("confirmed"));
  document.querySelector("[data-cancel]").addEventListener("click", () => {
    if (!confirm("Cancel this tour? Your community will reach out to reschedule.")) return;
    respond("cancelled");
  });

  function respond(action) {
    status.textContent = "Saving…";
    status.classList.remove("error");
    fetch(`/api/v2/public/tours/${encodeURIComponent(tourId)}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token })
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          status.classList.add("error");
          status.textContent = j.error || "Unable to update.";
          return;
        }
        actions.hidden = true;
        status.textContent = action === "confirmed"
          ? "Confirmed! We're looking forward to seeing you."
          : "Got it. Your community will reach out to reschedule.";
      })
      .catch(() => { status.classList.add("error"); status.textContent = "Network error."; });
  }
})();
