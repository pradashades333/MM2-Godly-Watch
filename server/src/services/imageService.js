const cheerio = require("cheerio");
const imageMappings = require("../config/imageMappings");

const GODLY_WEAPONS_API_URL =
  "https://murder-mystery-2.fandom.com/api.php?action=parse&page=Godly_Weapons&prop=text&formatversion=2&format=json";

let cachedWikiMappings = null;
let wikiMappingsPromise = null;

async function getImageForItem(item) {
  const manualImage =
    imageMappings[item?.id] ?? imageMappings[normalizeItemKey(item?.name)];

  if (manualImage) {
    return manualImage;
  }

  const wikiMappings = await loadWikiMappings();
  return wikiMappings[item?.id] ?? wikiMappings[normalizeItemKey(item?.name)] ?? null;
}

async function loadWikiMappings() {
  if (cachedWikiMappings) {
    return cachedWikiMappings;
  }

  if (!wikiMappingsPromise) {
    wikiMappingsPromise = fetchAndBuildWikiMappings()
      .then((mappings) => {
        cachedWikiMappings = mappings;
        return mappings;
      })
      .catch((error) => {
        console.error("Failed to load wiki image mappings", error);
        return {};
      });
  }

  return wikiMappingsPromise;
}

async function fetchAndBuildWikiMappings() {
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
