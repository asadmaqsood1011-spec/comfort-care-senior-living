const checkInForm = document.querySelector("[data-checkin-form]");
const checkInStatus = document.querySelector("[data-checkin-status]");
const checkInSubmitLabel = document.querySelector("[data-checkin-submit-label]");
const checkInLocation = document.querySelector("[data-checkin-location]");
const checkInLocationLabel = document.querySelector("[data-checkin-location-label]");

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
const locationName = LOCATION_LABELS[locationSlug] || titleFromSlug(locationSlug);
if (locationSlug && [...checkInLocation.options].some((option) => option.value === locationName)) {
  checkInLocation.value = locationName;
}
setLocationLabel();
checkInLocation.addEventListener("change", setLocationLabel);

checkInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = checkInForm.querySelector("button[type='submit']");
  checkInStatus.textContent = "";
  checkInStatus.classList.remove("is-error");
  button.disabled = true;
  button.classList.add("is-loading");
  checkInSubmitLabel.textContent = "Saving...";

  try {
    const payload = Object.fromEntries(new FormData(checkInForm).entries());
    const validationError = validateCheckIn(payload);
    if (validationError) throw new Error(validationError);

    const response = await fetch("/api/check-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.errors?.[0] || data.error || "Unable to save check-in.");

    checkInStatus.textContent = "Checked in. Thank you.";
    const selectedLocation = checkInLocation.value;
    checkInForm.reset();
    checkInLocation.value = selectedLocation;
    setLocationLabel();
  } catch (error) {
    checkInStatus.textContent = error.message;
    checkInStatus.classList.add("is-error");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    checkInSubmitLabel.textContent = "Check In";
  }
});

function validateCheckIn(payload) {
  if (!String(payload.community || "").trim()) return "Choose a location.";
  if (!String(payload.visitorName || "").trim()) return "Visitor name is required.";
  if (!isValidPhone(payload.phone)) return "Enter a valid 10-digit phone number.";
  if (!String(payload.visitingResident || "").trim()) return "Resident or visit reason is required.";
  const email = String(payload.email || "").trim();
  if (email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) return "Enter a valid email or leave it blank.";
  return "";
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function setLocationLabel() {
  checkInLocationLabel.textContent = checkInLocation.value
    ? `Location: ${checkInLocation.value}`
    : "Choose a Comfort Care location";
}

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
