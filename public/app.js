document.documentElement.classList.add("js");

const communities = [
  {
    name: "August Haus Comfort Care",
    city: "Gaylord",
    address: "1201 Village Pkwy, Gaylord, MI 49735, United States",
    phone: "(989) 448-7094",
    image: "/assets/communities/august-haus.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A caring Gaylord community where quality of life is treated as seriously as quality of care, with a safe, enjoyable setting for worry-free senior living.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Bavarian Comfort Care",
    city: "Bridgeport",
    address: "5366 W Rolling Hills Dr, Bridgeport Charter Township, MI 48722",
    phone: "(989) 777-7776",
    image: "/assets/communities/bavarian.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "The original Bavarian Comfort Care community set the tone for Comfort Care's blend of luxury, comfort, manicured grounds, and peaceful courtyards.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Bay City Comfort Care",
    city: "Bay City",
    address: "4130 Shrestha Dr, Bay City, MI 48706, United States",
    phone: "(989) 545-6000",
    image: "/assets/communities/bay-city.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A state-of-the-art Bay City community designed to feel like a luxury resort, with private rooms and a floor plan that encourages connection.",
    highlights: ["68 private rooms", "Spa & salon", "Cinema", "Shopping trips", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Big Rapids Fields Comfort Care",
    city: "Big Rapids",
    address: "18900 16 Mile Rd, Big Rapids, MI 49307, United States",
    phone: "(231) 598-9230",
    image: "/assets/communities/big-rapids.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A compassionate Big Rapids community focused on personal needs, dignity, genuine care, value, and quality.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Brighton Comfort Care",
    city: "Brighton",
    address: "Brighton, MI",
    phone: "(810) 247-8442",
    image: "/assets/communities/brighton-apfm.png",
    careOptions: ["Assisted Living", "Memory Care", "Enhanced Living", "Independent Living"],
    description: "A Brighton senior living community designed for community interaction, comfortable private suites, outdoor enjoyment, and everyday independence.",
    highlights: ["Private suites", "Large walkways", "Walk-in showers", "Common lounge", "Spa & salon", "Outdoor spaces"]
  },
  {
    name: "Chesaning Comfort Care",
    city: "Chesaning",
    address: "1800 W Brady Rd, Chesaning, MI 48616, United States",
    phone: "(989) 607-0011",
    image: "/assets/communities/chesaning-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A peaceful country-side community where long-term care, comfort, and a strong sense of community come together.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Livonia Comfort Care",
    city: "Livonia",
    address: "34020 Plymouth Rd, Livonia, MI 48150, United States",
    phone: "(734) 743-2300",
    image: "/assets/communities/livonia-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Continuum of Care", "Independent Living"],
    description: "A resident-favorite Livonia community with well-maintained gardens, clean spaces, continuum of care, and warm comfort through every season.",
    highlights: ["Continuum of care", "Coffee", "Spa & salon", "Cinema", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Marshall Comfort Care",
    city: "Marshall",
    address: "200 Westbrook Ct, Marshall, MI 49068, United States",
    phone: "(269) 781-4997",
    image: "/assets/communities/marshall-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A safe haven for seniors built around remarkable care, familiar comfort, and Comfort Care's expanding standard for world-class senior living.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Mount Pleasant Comfort Care",
    city: "Mount Pleasant",
    address: "1945 Churchill Blvd, Mt Pleasant, MI 48858, US",
    phone: "(989) 773-7001",
    image: "/assets/communities/mount-pleasant-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A Mount Pleasant community shaped by Comfort Care's mission to deliver remarkable care while weaving comfort and luxury throughout daily life.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Reed City Fields Comfort Care",
    city: "Reed City",
    address: "22109 Professional Dr, Reed City, MI 49677, US",
    phone: "(231) 465-4371",
    image: "/assets/communities/reed-city-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A Northern Michigan community with loving staff, long-term care, comfort, and medication management near the crossroads of US-10 and 131.",
    highlights: ["Medication management", "Spa & salon", "Cinema", "Shopping trips", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Shields Comfort Care",
    city: "Saginaw",
    address: "9140 Gratiot Rd, Saginaw, MI 48609, United States",
    phone: "(989) 607-0003",
    image: "/assets/communities/shields-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A Saginaw area community near local services, hospitals, recreation, and peaceful outdoor destinations, with 24/7 care support.",
    highlights: ["24/7 care", "Spa & salon", "Cinema", "Shopping trips", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Shelby Comfort Care",
    city: "Shelby Township",
    address: "51831 Van Dyke Ave, Shelby Township, MI 48315, US",
    phone: "(586) 933-5594",
    image: "/assets/communities/shelby-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A country club-style Shelby community with no costly entrance fees, home-like warmth, transparent pricing, and specialized senior services.",
    highlights: ["No costly entrance fees", "Spa & salon", "Cinema", "Shopping trips", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Vassar Comfort Care",
    city: "Vassar",
    address: "5830 Frankenmuth Rd, Vassar, MI 48768, United States",
    phone: "(989) 882-9495",
    image: "/assets/communities/vassar-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A quaint country-side Vassar community where care, love, comfort, and camaraderie are woven into a peaceful daily rhythm.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  }
];

const communityEnhancements = {
  "Brighton Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/hampton-manor-of-brighton-1415300",
    apfmScore: "8.5",
    apfmReviewCount: "37 reviews",
    gallery: [
      "/assets/communities/brighton-apfm.png",
      "https://www.aplaceformom.com/image/apfm-web-api/1333355/hampton-manor-of-brighton--brighton.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1298835/hampton-manor-of-brighton--brighton.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1298843/hampton-manor-of-brighton--brighton.jpg?t=default"
    ]
  },
  "Chesaning Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/chesaning-comfort-care-1436558",
    apfmScore: "8.2",
    apfmReviewCount: "11 reviews",
    gallery: [
      "/assets/communities/chesaning-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1205398/chesaning-comfort-care-indoor-common-area-chesaning.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1205402/chesaning-comfort-care-dining-room-chesaning.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1205410/chesaning-comfort-care-tv-lounge-chesaning.jpg?t=default"
    ]
  },
  "Livonia Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/livonia-comfort-1436562",
    apfmScore: "7.4",
    apfmReviewCount: "16 reviews",
    gallery: [
      "/assets/communities/livonia-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1210430/livonia-comfort-indoor-common-area-livonia.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1210434/livonia-comfort-studio-livonia.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1210442/livonia-comfort-bathroom-livonia.jpg?t=default"
    ]
  },
  "Marshall Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/marshall-comfort-care-66901",
    apfmScore: "8.8",
    apfmReviewCount: "23 reviews",
    gallery: [
      "/assets/communities/marshall-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1189159/marshall-comfort-care--marshall.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189161/marshall-comfort-care--marshall.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189164/marshall-comfort-care--marshall.jpg?t=default"
    ]
  },
  "Mount Pleasant Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/mt-pleasant-comfort-care-155882",
    apfmScore: "9.5",
    apfmReviewCount: "10 reviews",
    gallery: [
      "/assets/communities/mount-pleasant-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1196682/mt-pleasant-comfort-care-indoor-common-area-mount-pleasant.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1247572/mt-pleasant-comfort-care--mount-pleasant.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1247576/mt-pleasant-comfort-care--mount-pleasant.jpg?t=default"
    ]
  },
  "Reed City Fields Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/reed-city-fields-1415163",
    apfmScore: "8.9",
    apfmReviewCount: "21 reviews",
    gallery: [
      "/assets/communities/reed-city-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1032258/reed-city-fields-community-exterior-reed-city.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1185486/reed-city-fields-community-exterior-reed-city.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1247396/reed-city-fields--reed-city.jpg?t=default"
    ]
  },
  "Shields Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/shields-comfort-care-1436557",
    apfmScore: "",
    apfmReviewCount: "10 reviews",
    gallery: [
      "/assets/communities/shields-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1205864/shields-comfort-care.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1205852/shields-comfort-care-bedroom-saginaw.jpg?t=default"
    ]
  },
  "Shelby Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/shelby-comfort-care-1414581",
    apfmScore: "8.0",
    apfmReviewCount: "25 reviews",
    gallery: [
      "/assets/communities/shelby-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1080282/shelby-comfort-care-bedroom-shelby-township.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1080284/shelby-comfort-care-salon-shelby-township.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1080291/shelby-comfort-care-dining-room-shelby-township.jpg?t=default"
    ]
  },
  "Vassar Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/vassar-comfort-care-1415155",
    apfmScore: "9.2",
    apfmReviewCount: "9 reviews",
    gallery: [
      "/assets/communities/vassar-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1189352/vassar-comfort-care-in-unit-kitchen-vassar.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189358/vassar-comfort-care-dining-room-vassar.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189362/vassar-comfort-care-salon-vassar.jpg?t=default"
    ]
  }
};

communities.forEach((community) => {
  const enhancement = communityEnhancements[community.name] || {};
  Object.assign(community, {
    slug: slugify(community.name),
    apfmUrl: enhancement.apfmUrl || "",
    apfmScore: enhancement.apfmScore || "",
    apfmReviewCount: enhancement.apfmReviewCount || "",
    gallery: enhancement.gallery || [community.image]
  });
});

const regionMatches = {
  "metro-detroit": ["Shelby Comfort Care", "Livonia Comfort Care", "Brighton Comfort Care"],
  "mid-michigan": ["Bay City Comfort Care", "Bavarian Comfort Care", "Chesaning Comfort Care", "Shields Comfort Care", "Vassar Comfort Care", "Mount Pleasant Comfort Care"],
  northern: ["August Haus Comfort Care", "Big Rapids Fields Comfort Care", "Reed City Fields Comfort Care", "Marshall Comfort Care"]
};

const careTypes = [
  "Assisted Living",
  "Memory Care",
  "Independent Living",
  "Continuum of Care",
  "Not sure yet"
];

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const loader = document.querySelector("[data-loader]");
const communityGrid = document.querySelector("[data-community-grid]");
const mapChips = document.querySelector("[data-map-chips]");
const routePage = document.querySelector("[data-route-page]");
const footerCommunities = document.querySelector("[data-footer-communities]");
const quizForm = document.querySelector("[data-community-quiz]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const modal = document.querySelector("[data-community-modal]");
const modalTitle = document.querySelector("[data-modal-title]");

document.addEventListener("DOMContentLoaded", hideLoader);
window.addEventListener("load", () => {
  hideLoader();
  window.lucide?.createIcons();
});
window.addEventListener("popstate", renderRoute);
setTimeout(hideLoader, 1200);

function hideLoader() {
  loader?.classList.add("is-hidden");
}

window.addEventListener("scroll", () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 20);
  updateActiveNav();
  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const offset = Math.round((rect.top - window.innerHeight / 2) * -0.035);
    el.style.setProperty("--parallax", `${offset}px`);
  });
});

navToggle?.addEventListener("click", () => nav?.classList.toggle("is-open"));
nav?.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  nav.classList.remove("is-open");
  if (location.pathname !== "/" && link.getAttribute("href")?.startsWith("#")) {
    event.preventDefault();
    location.href = `/${link.getAttribute("href")}`;
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: 0.16 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

renderCommunities();
renderMapChips();
renderCommunitySpotlight(communities[0]);
renderFooterCommunities();
populateSelects();
bindLeadForms();
bindModal();
bindCommunityMapEvents();
bindQuiz();
renderRoute();
window.lucide?.createIcons();

function renderCommunities() {
  communityGrid.innerHTML = communities.map((community, index) => `
    <article class="community-card reveal" style="--delay: ${Math.min(index * 35, 260)}ms">
      <img src="${community.image}" alt="${community.name}">
      <div class="community-body">
        <span class="community-city">${community.city}</span>
        <h3>${community.name}</h3>
        <p>${community.description}</p>
        <div class="care-tags">
          ${community.careOptions.slice(0, 3).map((care) => `<span>${care}</span>`).join("")}
        </div>
        <div class="community-meta">
          <span><i data-lucide="map-pin"></i>${community.address}</span>
          <span><i data-lucide="phone"></i>${community.phone}</span>
        </div>
        <div class="community-actions">
          <a class="btn btn-primary" href="/communities/${community.slug}" data-community-detail="${community.name}">
            <i data-lucide="sparkles"></i>View Details
          </a>
          <a class="icon-btn" href="tel:${phoneHref(community.phone)}" aria-label="Call ${community.name}">
            <i data-lucide="phone"></i>
          </a>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".community-card.reveal").forEach((el) => observer.observe(el));
  window.lucide?.createIcons();
}

function renderMapChips() {
  if (!mapChips) return;
  mapChips.innerHTML = communities.map((community) => `
    <button type="button" data-map-chip="${community.name}">${community.city}</button>
  `).join("");
}

function renderFooterCommunities() {
  if (!footerCommunities) return;
  footerCommunities.innerHTML = `
    <h3>Communities</h3>
    <div>
      ${communities.map((community) => `
        <a href="/communities/${community.slug}" data-route-link="${community.slug}">
          <span>${community.name}</span>
          <small>${community.phone}</small>
        </a>
      `).join("")}
    </div>
  `;
}

function renderCommunitySpotlight(community) {
  const spotlight = document.querySelector("[data-community-spotlight]");
  if (!spotlight || !community) return;
  const reviewPanel = community.apfmScore || community.apfmReviewCount
    ? `<div class="profile-score">
        ${community.apfmScore ? `<strong>${community.apfmScore}</strong>` : `<strong>APFM</strong>`}
        <span>${community.apfmReviewCount || "A Place for Mom"}</span>
      </div>`
    : `<div class="profile-score">
        <strong>CCSL</strong>
        <span>Official community profile</span>
      </div>`;
  spotlight.innerHTML = `
    <div class="spotlight-image">
      <img src="${community.image}" alt="${community.name}">
    </div>
    <div class="spotlight-copy">
      <p class="eyebrow">${community.city} Community</p>
      <h3>${community.name}</h3>
      <p>${community.description}</p>
      <div class="profile-meta">
        ${reviewPanel}
        <div class="profile-score">
          <strong>${community.careOptions.length}</strong>
          <span>Care options</span>
        </div>
      </div>
      <div class="profile-gallery">
        ${community.gallery.slice(0, 4).map((src, index) => `
          <button type="button" data-gallery-image="${src}" aria-label="View ${community.name} photo ${index + 1}">
            <img src="${src}" alt="${community.name} photo ${index + 1}" loading="lazy">
          </button>
        `).join("")}
      </div>
      <div class="care-tags">
        ${community.careOptions.map((care) => `<span>${care}</span>`).join("")}
      </div>
      <div class="amenity-strip">
        ${community.highlights.map((item) => `<span>${item}</span>`).join("")}
      </div>
      <div class="spotlight-actions">
        <button class="btn btn-primary" type="button" data-community-inquiry="${community.name}">
          <i data-lucide="calendar-check"></i>Schedule ${community.city} Tour
        </button>
        <a class="btn btn-ghost" href="${directionsUrl(community.address)}" target="_blank" rel="noreferrer">
          <i data-lucide="navigation"></i>Get Directions
        </a>
        ${community.apfmUrl ? `<a class="btn btn-ghost" href="${community.apfmUrl}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>APFM Profile</a>` : ""}
      </div>
      <p class="spotlight-contact"><strong>${community.phone}</strong> ${community.address}</p>
    </div>
  `;
  window.lucide?.createIcons();
}

function renderRoute() {
  const path = location.pathname.replace(/\/$/, "") || "/";
  const communityMatch = path.match(/^\/communities\/([a-z0-9-]+)$/);
  if (communityMatch) {
    const community = communities.find((item) => item.slug === communityMatch[1]);
    if (community) {
      showRoutePage(renderCommunityPage(community));
      return;
    }
  }
  if (path === "/privacy") {
    showRoutePage(renderLegalPage("Privacy Policy", [
      "Comfort Care Senior Living uses website forms to collect contact details, care needs, preferred community, messages, and tour preferences so our team can respond to families and prospective residents.",
      "Lead information is stored securely in the site database and is visible only to authenticated administrators. We do not sell or share submitted lead information.",
      "For production launch, this page should be reviewed by the business owner or attorney and updated with final legal language, analytics disclosures, and email/SMS consent details."
    ]));
    return;
  }
  if (path === "/terms") {
    showRoutePage(renderLegalPage("Terms of Use", [
      "This website provides general information about Comfort Care Senior Living communities, services, amenities, and ways to contact the team.",
      "Information on this demo site should be verified before making care or placement decisions. Community availability, care options, pricing, and services may change.",
      "For production launch, this page should be reviewed by the business owner or attorney and updated with final business terms."
    ]));
    return;
  }
  showHomePage();
}

function showRoutePage(html) {
  if (!routePage) return;
  [...document.querySelector("main").children].forEach((section) => {
    section.hidden = section !== routePage;
  });
  routePage.innerHTML = html;
  routePage.hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });
  document.title = routePage.querySelector("h1")?.textContent
    ? `${routePage.querySelector("h1").textContent} | Comfort Care Senior Living`
    : "Comfort Care Senior Living";
  window.lucide?.createIcons();
}

function showHomePage() {
  if (!routePage) return;
  [...document.querySelector("main").children].forEach((section) => {
    section.hidden = section === routePage;
  });
  routePage.innerHTML = "";
  document.title = "Comfort Care Senior Living | The New Standard of Senior Living";
  updateActiveNav();
}

function renderCommunityPage(community) {
  const score = community.apfmScore
    ? `<strong>${community.apfmScore}</strong><span>${community.apfmReviewCount || "APFM reviews"}</span>`
    : `<strong>CCSL</strong><span>Official profile</span>`;
  return `
    <div class="community-route">
      <a class="route-back" href="/" data-home-route><i data-lucide="arrow-left"></i>Back to Home</a>
      <div class="route-hero">
        <div>
          <p class="eyebrow">${community.city} Community</p>
          <h1>${community.name}</h1>
          <p>${community.description}</p>
          <div class="route-actions">
            <button class="btn btn-primary" type="button" data-community-inquiry="${community.name}">
              <i data-lucide="calendar-check"></i>Schedule a Tour
            </button>
            <a class="btn btn-ghost" href="tel:${phoneHref(community.phone)}"><i data-lucide="phone"></i>${community.phone}</a>
          </div>
        </div>
        <img src="${community.image}" alt="${community.name}">
      </div>
      <div class="route-stat-grid">
        <article>${score}</article>
        <article><strong>${community.careOptions.length}</strong><span>Care options</span></article>
        <article><strong>24/7</strong><span>Care team availability</span></article>
      </div>
      <div class="route-content-grid">
        <section>
          <h2>Care and Lifestyle</h2>
          <p>${community.description}</p>
          <div class="care-tags">${community.careOptions.map((item) => `<span>${item}</span>`).join("")}</div>
        </section>
        <section>
          <h2>What Families Can Expect</h2>
          <div class="amenity-strip">${community.highlights.map((item) => `<span>${item}</span>`).join("")}</div>
        </section>
      </div>
      <section class="route-gallery">
        <div class="section-heading">
          <p class="eyebrow">Gallery</p>
          <h2>Explore ${community.name}</h2>
        </div>
        <div>
          ${community.gallery.map((src, index) => `
            <button type="button" data-lightbox-src="${src}" aria-label="Open ${community.name} photo ${index + 1}">
              <img src="${src}" alt="${community.name} photo ${index + 1}" loading="lazy">
            </button>
          `).join("")}
        </div>
      </section>
      <div class="route-location">
        <div>
          <p class="eyebrow">Location</p>
          <h2>${community.city}</h2>
          <p>${community.address}</p>
        </div>
        <a class="btn btn-primary" href="${directionsUrl(community.address)}" target="_blank" rel="noreferrer">
          <i data-lucide="navigation"></i>Get Directions
        </a>
        ${community.apfmUrl ? `<a class="btn btn-ghost" href="${community.apfmUrl}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>A Place for Mom</a>` : ""}
      </div>
    </div>
  `;
}

function renderLegalPage(title, paragraphs) {
  return `
    <div class="legal-page">
      <a class="route-back" href="/" data-home-route><i data-lucide="arrow-left"></i>Back to Home</a>
      <p class="eyebrow">Comfort Care Senior Living</p>
      <h1>${title}</h1>
      ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    </div>
  `;
}

function populateSelects() {
  const communityOptions = `<option value="">Select a community</option>${communities
    .map((community) => `<option value="${community.name}">${community.name}</option>`)
    .join("")}`;
  const careOptions = `<option value="">Select care type</option>${careTypes
    .map((care) => `<option value="${care}">${care}</option>`)
    .join("")}`;

  document.querySelectorAll("[data-community-select]").forEach((select) => {
    select.innerHTML = communityOptions;
  });
  document.querySelectorAll("[data-care-select]").forEach((select) => {
    select.innerHTML = careOptions;
  });
}

function bindModal() {
  document.addEventListener("click", (event) => {
    const homeRoute = event.target.closest("[data-home-route]");
    if (homeRoute) {
      event.preventDefault();
      history.pushState({}, "", "/");
      renderRoute();
      return;
    }

    const routeLink = event.target.closest("[data-route-link]");
    if (routeLink) {
      event.preventDefault();
      history.pushState({}, "", routeLink.getAttribute("href"));
      renderRoute();
      return;
    }

    const detailTrigger = event.target.closest("[data-community-detail]");
    if (detailTrigger) {
      event.preventDefault();
      const community = communities.find((item) => item.name === detailTrigger.dataset.communityDetail);
      history.pushState({}, "", `/communities/${community.slug}`);
      renderRoute();
      return;
    }

    const mapChip = event.target.closest("[data-map-chip]");
    if (mapChip) {
      const community = communities.find((item) => item.name === mapChip.dataset.mapChip);
      selectCommunityProfile(community);
      return;
    }

    const galleryImage = event.target.closest("[data-gallery-image]");
    if (galleryImage) {
      const spotlightImage = document.querySelector(".spotlight-image img");
      if (spotlightImage) spotlightImage.src = galleryImage.dataset.galleryImage;
      openLightbox(galleryImage.dataset.galleryImage);
      return;
    }

    const lightboxTrigger = event.target.closest("[data-lightbox-src]");
    if (lightboxTrigger) {
      openLightbox(lightboxTrigger.dataset.lightboxSrc);
      return;
    }

    const trigger = event.target.closest("[data-community-inquiry]");
    if (!trigger) return;
    const community = trigger.dataset.communityInquiry;
    modalTitle.textContent = `${community} Inquiry`;
    const select = modal.querySelector("[name='preferredCommunity']");
    select.value = community;
    modal.showModal();
  });

  document.querySelector("[data-modal-close]")?.addEventListener("click", () => modal.close());
  document.querySelector("[data-lightbox-close]")?.addEventListener("click", () => lightbox?.close());
}

function bindCommunityMapEvents() {
  window.addEventListener("community-map-select", (event) => {
    const name = event.detail?.communityName || "";
    const city = event.detail?.city || "";
    const community = communities.find((item) => item.name === name || item.city === city);
    selectCommunityProfile(community);
  });
}

function selectCommunityProfile(community) {
  if (!community) return;
  renderCommunitySpotlight(community);
  document.querySelector("[data-community-spotlight]")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindQuiz() {
  quizForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(quizForm);
    const region = form.get("region");
    const careType = form.get("careType");
    const names = regionMatches[region] || [];
    const match = communities.find((community) => names.includes(community.name) && community.careOptions.includes(careType))
      || communities.find((community) => names.includes(community.name))
      || communities[0];
    const output = quizForm.querySelector("[data-quiz-result]");
    output.innerHTML = `
      <strong>${match.name}</strong>
      <span>${match.city} may be a strong starting point for ${careType || "your care search"}.</span>
      <a href="/communities/${match.slug}" data-route-link="${match.slug}">View community profile</a>
    `;
  });
}

function openLightbox(src) {
  if (!lightbox || !lightboxImage || !src) return;
  lightboxImage.src = src;
  lightbox.showModal();
}

function updateActiveNav() {
  const sections = [...document.querySelectorAll("main > section[id]:not([hidden])")];
  let active = "";
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top < 160) active = section.id;
  });
  document.querySelectorAll(".nav a[href^='#']").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${active}`);
  });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function phoneHref(phone) {
  return String(phone).replace(/[^\d+]/g, "");
}

function directionsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function bindLeadForms() {
  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector(".form-status");
      const button = form.querySelector("button[type='submit']");
      status.textContent = "";
      button.disabled = true;
      button.classList.add("is-loading");

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.kind = form.dataset.kind || "contact";
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.errors?.[0] || data.error || "Please check the form and try again.");
        status.textContent = data.message;
        form.reset();
        if (form.closest("dialog")) setTimeout(() => modal.close(), 1200);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
        button.classList.remove("is-loading");
      }
    });
  });
}
