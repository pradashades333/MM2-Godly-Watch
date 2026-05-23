const cheerio = require("cheerio");
const imageMappings = require("../config/imageMappings");

const GODLY_WEAPONS_API_URL =
  "https://murder-mystery-2.fandom.com/api.php?action=parse&page=Godly_Weapons&prop=text&formatversion=2&format=json";
const WIKI_API_ROOT = "https://murder-mystery-2.fandom.com/api.php";

let cachedGodlyMappings = null;
let godlyMappingsPromise = null;
let cachedSetPageMappings = null;
let setPageMappingsPromise = null;
let cachedSetImageMappings = {};
let cachedAncientMappings = null;
let ancientMappingsPromise = null;

async function getImageForItem(item) {
  const manualImage =
    imageMappings[item?.id] ?? imageMappings[normalizeItemKey(item?.name)];

  if (manualImage) {
    return manualImage;
  }

  if (item?.category === "sets") {
    return getSetImageForItem(item);
  }

  if (item?.category === "ancients") {
    return getAncientImageForItem(item);
  }

  const godlyMappings = await loadGodlyMappings();
  return godlyMappings[item?.id] ?? godlyMappings[normalizeItemKey(item?.name)] ?? null;
}

async function loadGodlyMappings() {
  if (cachedGodlyMappings) {
    return cachedGodlyMappings;
  }

  if (!godlyMappingsPromise) {
    godlyMappingsPromise = fetchAndBuildGodlyMappings()
      .then((mappings) => {
        cachedGodlyMappings = mappings;
        return mappings;
      })
      .catch((error) => {
        console.error("Failed to load godly image mappings", error);
        return {};
      });
  }

  return godlyMappingsPromise;
}

async function getSetImageForItem(item) {
  const itemKey = normalizeItemKey(item?.name || item?.id);

  if (cachedSetImageMappings[itemKey]) {
    return cachedSetImageMappings[itemKey];
  }

  const setPageMappings = await loadSetPageMappings();
  let imageUrl = setPageMappings[item?.id] ?? setPageMappings[itemKey] ?? null;

  if (!imageUrl) {
    imageUrl = await fetchWikiImageByTitle(item?.name || "");
  }

  if (imageUrl) {
    cachedSetImageMappings[itemKey] = imageUrl;
  }

  return imageUrl;
}

const SET_WIKI_ALIASES = {
  "ever-set":              "Evergreen",
  "chroma-ever-set":       "Chroma Evergreen",
  "full-ice-set":          "Ice Dragon",
  "travelers-set":         "Traveler's Gun",
  "spectral-set":          "Spectre",
  "colored-seer-set":      "Seer",
  "full-bringer-set":      "Darkbringer",
  "full-luger-set":        "Luger",
  "full-elite-set":        "Blue Seer",
  "chroma-weapon-set":     "Chroma Darkbringer",
  "full-chroma-set":       "Chroma Slasher",
  "santas-set-legendary":  "Cookiecane",
  "gingerbread-set-2019":  "Gingerblade",
  "gingerbread-set":       "Gingerblade",
  "vampire-set-legend":    "Vampire's Gun",
  "vampire-set-rare":      "Vampire's Gun",
  "vampire-set":           "Vampire's Gun",
  "pumpkin-set":           "Hallowgun",
  "pumpkin-set-2019":      "Hallowgun",
  "pumpkin-set-2020":      "Hallowgun",
  "pumpkin-set-2021":      "Hallowgun",
  "aurora-set-legend":     "Australis",
  "aurora-set-rare":       "Australis",
  "aurora-set":            "Australis",
};

async function fetchWikiImageByTitle(itemName) {
  const base = String(itemName || "").trim();
  const key = normalizeItemKey(base);

  // Check hand-curated alias first
  const alias = SET_WIKI_ALIASES[key];
  if (alias) {
    const url = await fetchWikiPageImage(alias);
    if (url) return url;
  }

  // Try exact name, then name without parentheticals, then strip " Set"
  const withoutParens = base.replace(/\s*\([^)]*\)/g, "").trim();
  const withoutSet = withoutParens.replace(/ Set$/, "").trim();

  const candidates = [...new Set([base, withoutParens, withoutSet])].filter(Boolean);

  for (const title of candidates) {
    const url = await fetchWikiPageImage(title);
    if (url) return url;
  }

  return null;
}

async function fetchWikiPageImage(title) {
  const url = new URL(WIKI_API_ROOT);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("pithumbsize", "400");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});

    for (const page of pages) {
      if ("missing" in page) continue;
      const found = page?.thumbnail?.source ?? null;
      if (found) return found;
    }
  } catch {
    // swallow
  }

  return null;
}

async function getAncientImageForItem(item) {
  const ancientMappings = await loadAncientMappings();
  const key = normalizeItemKey(item?.name || item?.id);
  let imageUrl = ancientMappings[key] ?? ancientMappings[item?.id] ?? null;

  if (!imageUrl) {
    imageUrl = await fetchWikiImageByTitle(item?.name || "");
  }

  return imageUrl;
}

async function loadAncientMappings() {
  if (cachedAncientMappings) {
    return cachedAncientMappings;
  }

  if (!ancientMappingsPromise) {
    ancientMappingsPromise = fetchAndBuildAncientMappings()
      .then((mappings) => {
        cachedAncientMappings = mappings;
        return mappings;
      })
      .catch((error) => {
        console.error("Failed to load ancient image mappings", error);
        return {};
      });
  }

  return ancientMappingsPromise;
}

async function fetchAndBuildAncientMappings() {
  const pages = [];
  let continueToken = null;

  do {
    const url = new URL(WIKI_API_ROOT);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", "Category:Ancient");
    url.searchParams.set("cmlimit", "500");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    if (continueToken) {
      url.searchParams.set("cmcontinue", continueToken);
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Ancient category request failed with ${response.status}`);
    }

    const payload = await response.json();
    pages.push(...(payload?.query?.categorymembers || []));
    continueToken = payload?.continue?.cmcontinue ?? null;
  } while (continueToken);

  const mappings = {};

  for (const batch of chunkArray(pages, 50)) {
    const titles = batch.map((p) => p.title).join("|");
    const url = new URL(WIKI_API_ROOT);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("pithumbsize", "400");
    url.searchParams.set("titles", titles);
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const payload = await response.json();
      for (const page of Object.values(payload?.query?.pages || {})) {
        if ("missing" in page || !page?.thumbnail?.source) continue;
        mappings[normalizeItemKey(page.title)] = page.thumbnail.source;
      }
    } catch {
      // swallow batch errors
    }
  }

  return mappings;
}

async function loadSetPageMappings() {
  if (cachedSetPageMappings) {
    return cachedSetPageMappings;
  }

  if (!setPageMappingsPromise) {
    setPageMappingsPromise = fetchAndBuildSetPageMappings()
      .then((mappings) => {
        cachedSetPageMappings = mappings;
        return mappings;
      })
      .catch((error) => {
        console.error("Failed to load set image mappings", error);
        return {};
      });
  }

  return setPageMappingsPromise;
}

async function fetchAndBuildSetPageMappings() {
  const setPages = await fetchAllSetCategoryMembers();
  const mappings = {};

  for (const batch of chunkArray(setPages, 50)) {
    const batchMappings = await fetchSetImageBatch(batch);
    Object.assign(mappings, batchMappings);
  }

  return mappings;
}

async function fetchAndBuildGodlyMappings() {
  const response = await fetch(GODLY_WEAPONS_API_URL);

  if (!response.ok) {
    throw new Error(`Wiki image request failed with ${response.status}`);
  }

  const payload = await response.json();
  const html = payload?.parse?.text;

  if (!html) {
    return {};
  }

  const $ = cheerio.load(html);
  const mappings = {};

  $("table tr").each((_, row) => {
    const cells = $(row).find("td");

    if (cells.length < 5) {
      return;
    }

    const name = $(cells[0]).text().trim();
    const imageUrl = extractWikiImageUrl($(cells[4]));

    if (!name || !imageUrl) {
      return;
    }

    mappings[normalizeItemKey(name)] = imageUrl;
  });

  return mappings;
}

function extractWikiImageUrl(cell) {
  const directLink = cell.find("a.mw-file-description.image").attr("href");

  if (directLink && directLink.startsWith("https://static.wikia.nocookie.net/")) {
    return directLink;
  }

  const lazySource = cell.find("img").attr("data-src");
  if (lazySource && lazySource.startsWith("https://static.wikia.nocookie.net/")) {
    return lazySource;
  }

  const source = cell.find("img").attr("src");
  if (source && source.startsWith("https://static.wikia.nocookie.net/")) {
    return source;
  }

  return null;
}

function cleanSetWikiLabel(value) {
  return String(value || "")
    .replace(/^Murder Mystery 2 Wiki:Wiki-Bot\//i, "")
    .replace(/^Wiki-Bot\//i, "")
    .replace(/^Category:/i, "")
    .replace(/_/g, " ")
    .trim();
}

async function fetchAllSetCategoryMembers() {
  const pages = [];
  let continueToken = null;

  do {
    const url = new URL(WIKI_API_ROOT);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", "Category:Wiki-Bot");
    url.searchParams.set("cmlimit", "500");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    if (continueToken) {
      url.searchParams.set("cmcontinue", continueToken);
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Set category request failed with ${response.status}`);
    }

    const payload = await response.json();
    pages.push(...(payload?.query?.categorymembers || []));
    continueToken = payload?.continue?.cmcontinue ?? null;
  } while (continueToken);

  return pages;
}

async function fetchSetImageBatch(setPages) {
  if (!setPages.length) {
    return {};
  }

  const titles = setPages.map((page) => page.title).join("|");
  const url = new URL(WIKI_API_ROOT);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("pithumbsize", "400");
  url.searchParams.set("titles", titles);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Set image batch request failed with ${response.status}`);
  }

  const payload = await response.json();
  const pages = Object.values(payload?.query?.pages || {});
  const mappings = {};

  for (const page of pages) {
    const imageUrl = page?.thumbnail?.source ?? null;

    if (!imageUrl) {
      continue;
    }

    const cleanedName = cleanSetWikiLabel(page.title);
    mappings[normalizeItemKey(cleanedName)] = imageUrl;
  }

  return mappings;
}

function chunkArray(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function normalizeItemKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  getImageForItem
};
