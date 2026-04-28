const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const BASE = "https://comfortcaresl.com";
const SITEMAPS = [
  `${BASE}/page-sitemap.xml`,
  `${BASE}/post-sitemap.xml`
];
const KEY_PAGE_PATTERNS = [
  /\/lifestyle-options\//,
  /\/michigan-senior-care-about-comfort-care-senior-living\//,
  /\/contact-comfort-care-senior-living\//,
  /\/virtual-tours\//,
  /\/press-resources\//,
  /\/covid-19\//,
  /\/independent-living\//,
  /\/cost-of-memory-care\//,
  /\/nursing-home-costs\//,
  /\/low-income-assisted-living\//,
  /\/housing-for-seniors-based-on-income\//,
  /\/right-time-for-memory-care\//,
  /\/end-stage-dementia\//,
  /\/elder-care-lawyer\//
];
const COMMUNITY_DETAIL_PATTERN = /\/communities\/mi\/[^/]+\/[^/]+\/?$/;
const COMMUNITY_INDEX_PATTERN = /\/communities\/mi\/[^/]+\/?$/;

function decodeEntities(value = "") {
  const named = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "-", mdash: "-",
    rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "..."
  };
  return String(value)
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => {
      const n = code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/&([a-z]+);/gi, (_, name) => named[name.toLowerCase()] ?? `&${name};`)
    .replace(/[\uFFFD?]/g, "'");
}

function cleanText(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return decodeEntities(match?.[1] || "");
}

function absolutize(url) {
  if (!url || url.startsWith("data:")) return "";
  try { return new URL(url, BASE).href; } catch { return ""; }
}

function uniq(values) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
}

function extractMatches(text, regex) {
  return uniq([...text.matchAll(regex)].map((match) => match[0]));
}

function compactList(items, max = 80) {
  const blocked = /^(comfort care|home|about us|contact|careers|blog|lifestyle options|our communities|scroll to top|submit|send|menu|name|email|phone number)$/i;
  return uniq(items.map(cleanText)).filter((item) => item.length > 2 && item.length < 260 && !blocked.test(item)).slice(0, max);
}

function extractImages(html) {
  const images = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = absolutize(attr(tag, "src") || attr(tag, "data-src"));
    const srcset = attr(tag, "srcset") || attr(tag, "data-srcset");
    const alt = cleanText(attr(tag, "alt"));
    const candidates = [src];
    for (const part of srcset.split(",")) candidates.push(absolutize(part.trim().split(/\s+/)[0]));
    for (const url of candidates) {
      if (!url || !/wp-content\/uploads|comfortcaresl\.com\/wp-content/i.test(url)) continue;
      const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
      images.push({ url, alt, filename });
    }
  }
  const seen = new Set();
  return images.filter((image) => {
    if (seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

function extractPage(url, html) {
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const metaDescription = decodeEntities(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || "");
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1] || url;
  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const bodyHtml = bodyMatch?.[0] || html;
  const text = cleanText(bodyHtml);
  const headings = [];
  for (const match of bodyHtml.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const value = cleanText(match[2]);
    if (value && value.length < 180) headings.push({ level: Number(match[1]), text: value });
  }
  const paragraphs = [];
  for (const match of bodyHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const value = cleanText(match[1]);
    if (value.length >= 35 && value.length <= 1200) paragraphs.push(value);
  }
  const listItems = compactList([...bodyHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]));
  const phones = extractMatches(text, /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g);
  const addressCandidates = extractMatches(text, /\d{2,6}\s+[A-Z][A-Za-z0-9.'’\-\s]+(?:Avenue|Ave|Road|Rd|Drive|Dr|Court|Ct|Boulevard|Blvd|Parkway|Pkwy|Street|St|Lane|Ln)[^,.]*(?:,\s*)?[A-Za-z\s]+,\s*MI\s*\d{5}/g);
  const careOptions = uniq(["Assisted Living", "Memory Care", "MemoryVille", "Enhanced Living", "Continuum of Care", "Independent Living"].filter((item) => text.toLowerCase().includes(item.toLowerCase())));
  const amenityTerms = ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Meal times", "24/7 Housekeeping", "Beauty studio", "Family gathering", "Movie sessions", "Chef-prepared meals", "Outdoor activities", "Free WiFi", "Coffee", "Juice Bar", "Transportation", "Laundry"];
  const amenities = uniq(amenityTerms.filter((item) => text.toLowerCase().includes(item.toLowerCase())));
  const images = extractImages(html);

  return {
    url,
    canonical,
    type: COMMUNITY_DETAIL_PATTERN.test(url) ? "community-detail" : COMMUNITY_INDEX_PATTERN.test(url) ? "community-index" : KEY_PAGE_PATTERNS.some((pattern) => pattern.test(url)) ? "content-page" : "other",
    title,
    metaDescription,
    headings: uniq(headings.map((h) => `${h.level}:${h.text}`)).map((value) => ({ level: Number(value.slice(0, 1)), text: value.slice(2) })),
    phones,
    addresses: addressCandidates,
    careOptions,
    amenities,
    paragraphs: uniq(paragraphs).slice(0, 80),
    listItems,
    images,
    textExcerpt: text.slice(0, 6000)
  };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "ComfortCareContentAudit/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const sitemapUrls = [];
  for (const sitemap of SITEMAPS) {
    const xml = await fetchText(sitemap);
    sitemapUrls.push(...[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decodeEntities(m[1])));
  }
  const urls = uniq(sitemapUrls).filter((url) => url.startsWith(BASE));
  const selected = urls.filter((url) =>
    url === `${BASE}/` ||
    url === `${BASE}/communities/` ||
    COMMUNITY_DETAIL_PATTERN.test(url) ||
    COMMUNITY_INDEX_PATTERN.test(url) ||
    KEY_PAGE_PATTERNS.some((pattern) => pattern.test(url))
  );

  const pages = [];
  const failures = [];
  for (const url of selected) {
    try {
      const html = await fetchText(url);
      pages.push(extractPage(url, html));
      console.log(`extracted ${url}`);
    } catch (error) {
      failures.push({ url, error: error.message });
      console.error(`failed ${url}: ${error.message}`);
    }
  }

  const communityPages = pages.filter((page) => page.type === "community-detail");
  const communitySummaries = communityPages.map((page) => ({
    name: page.headings.find((h) => /comfort care|senior|living|assisted|memory/i.test(h.text))?.text || page.title.replace(/\s*[|–-].*$/, ""),
    url: page.url,
    title: page.title,
    metaDescription: page.metaDescription,
    address: page.addresses[0] || "",
    phone: page.phones.at(-1) || page.phones[0] || "",
    careOptions: page.careOptions,
    amenities: page.amenities,
    imageUrls: page.images.slice(0, 12).map((image) => image.url),
    keyCopy: page.paragraphs.slice(0, 8)
  }));

  const output = {
    extractedAt: new Date().toISOString(),
    source: BASE,
    pageCount: pages.length,
    communityCount: communitySummaries.length,
    failures,
    communities: communitySummaries,
    pages
  };

  await fs.writeFile(path.join(DATA_DIR, "comfortcare-old-site-extract.json"), JSON.stringify(output, null, 2));
  await fs.writeFile(path.join(DATA_DIR, "comfortcare-old-site-summary.md"), toMarkdown(output));
}

function toMarkdown(output) {
  const lines = [];
  lines.push("# Comfort Care Old Site Content Extract", "");
  lines.push(`Source: ${output.source}`);
  lines.push(`Extracted: ${output.extractedAt}`);
  lines.push(`Pages extracted: ${output.pageCount}`);
  lines.push(`Community detail pages: ${output.communityCount}`, "");
  lines.push("## Communities", "");
  for (const community of output.communities) {
    lines.push(`### ${community.name}`);
    lines.push(`- URL: ${community.url}`);
    if (community.address) lines.push(`- Address: ${community.address}`);
    if (community.phone) lines.push(`- Phone: ${community.phone}`);
    if (community.careOptions.length) lines.push(`- Care options: ${community.careOptions.join(", ")}`);
    if (community.amenities.length) lines.push(`- Amenities found: ${community.amenities.join(", ")}`);
    if (community.imageUrls.length) lines.push(`- Image URLs found: ${community.imageUrls.length}`);
    if (community.keyCopy.length) {
      lines.push("- Key copy:");
      community.keyCopy.slice(0, 4).forEach((copy) => lines.push(`  - ${copy}`));
    }
    lines.push("");
  }
  lines.push("## Other Extracted Pages", "");
  output.pages.filter((page) => page.type !== "community-detail").forEach((page) => {
    lines.push(`- ${page.title || page.url} — ${page.url}`);
  });
  if (output.failures.length) {
    lines.push("", "## Failures", "");
    output.failures.forEach((failure) => lines.push(`- ${failure.url}: ${failure.error}`));
  }
  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
