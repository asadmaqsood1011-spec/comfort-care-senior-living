const form = document.querySelector("[data-tablet-form]");
const status = document.querySelector("[data-tablet-status]");
const submitLabel = document.querySelector("[data-submit-label]");
const locationInput = document.querySelector("[data-location-input]");
const locationLabel = document.querySelector("[data-location-label]");

const LOCATION_LABELS = {
  "august-haus": "August Haus Comfort Care",
  "bay-city": "Bay City Comfort Care",
  "bavarian": "Bavarian Comfort Care",
  "bridgeport": "Bavarian Comfort Care",
  "big-rapids": "Big Rapids Fields Comfort Care",
  "brighton": "Brighton Comfort Care",
  "chesaning": "Chesaning Comfort Care",
  "livonia": "Livonia Comfort Care",
  "marshall": "Marshall Comfort Care",
  "mount-pleasant": "Mount Pleasant Comfort Care",
  "reed-city": "Reed City Fields Comfort Care",
  "saginaw": "Shields/Saginaw Comfort Care",
  "shields": "Shields/Saginaw Comfort Care",
  "shelby": "Shelby Comfort Care",
  "vassar": "Vassar Comfort Care"
};

window.lucide?.createIcons();

const params = new URLSearchParams(window.location.search);
const locationSlug = slugify(params.get("location") || "");
const locationName = LOCATION_LABELS[locationSlug] || titleFromSlug(locationSlug) || "Unassigned location";
if (locationSlug && [...locationInput.options].some((option) => option.value === locationName)) {
  locationInput.value = locationName;
}
locationLabel.textContent = locationInput.value ? `Location: ${locationInput.value}` : "Choose a Comfort Care location";

locationInput.addEventListener("change", () => {
  locationLabel.textContent = locationInput.value ? `Location: ${locationInput.value}` : "Choose a Comfort Care location";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  status.textContent = "";
  status.classList.remove("is-error");
  button.disabled = true;
  button.classList.add("is-loading");
  submitLabel.textContent = "Saving...";

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const validationError = validateLeadContact(payload);
    if (validationError) throw new Error(validationError);
    payload.source = "Tablet";
    payload.location = locationInput.value;

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.errors?.[0] || data.error || "Unable to save lead.");

    status.textContent = data.duplicate
      ? "This lead was already saved recently."
      : "Lead saved. Thank you.";
    const selectedLocation = locationInput.value;
    form.reset();
    locationInput.value = selectedLocation;
    locationLabel.textContent = selectedLocation ? `Location: ${selectedLocation}` : "Choose a Comfort Care location";
    form.querySelector("[name='careType']").value = "Not sure yet";
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("is-error");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    submitLabel.textContent = "Save Lead";
  }
});

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleFromSlug(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
