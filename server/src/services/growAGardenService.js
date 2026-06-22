const { execFile } = require("child_process");
const { promisify } = require("util");

const EXTRA_PETS = require("../data/growAGardenExtraPets");

const execFileAsync = promisify(execFile);

const ITEMS_URL = "https://traderie.com/api/growagarden/items";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_PAGES = 60;

// traderie.com sits behind Cloudflare bot-management that fingerprints
// Node's fetch/TLS stack and returns a 403 challenge page, but curl's
// requests pass through fine. Shell out to curl as a workaround.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let cache = { items: [], refreshedAt: null };
let inFlight = null;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Traderie's demand scale runs 0-10 in 0.5 steps; the UI gauges expect 0-5.
function normalizeDemand(demand) {
  if (demand == null) return 0;
  return Math.round(demand / 2);
}

function normalizeItem(raw) {
  const price = raw.prices?.[0] ?? null;

  return {
    id: `growagarden-${raw.slug}`,
    name: raw.name,
    game: "growagarden",
    category: String(raw.type || "").toLowerCase(),
    imageUrl: raw.img ?? null,
    current: {
      supreme: {
        value: price ? toNumber(price.user_value) : null,
        demand: price ? normalizeDemand(price.demand) : 0,
        demandRaw: price ? (price.demand ?? 0) : 0,
        rarity: 0
      },
      ebay: null
    },
    lastCheckedAt: new Date().toISOString(),
    history: []
  };
}

function normalizeExtraPet(extra) {
  return {
    id: `growagarden-${extra.slug}`,
    name: extra.name,
    game: "growagarden",
    category: "pets",
    imageUrl: extra.imageUrl,
    current: {
      supreme: { value: null, demand: 0, demandRaw: 0, rarity: 0 },
      ebay: null
    },
    lastCheckedAt: new Date().toISOString(),
    history: []
  };
}

async function fetchPage(page) {
  const url = `${ITEMS_URL}?page=${encodeURIComponent(String(page))}`;

  const { stdout } = await execFileAsync(
    "curl",
    ["-s", "-A", USER_AGENT, "--max-time", "20", url],
    { maxBuffer: 10 * 1024 * 1024 }
  );

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`traderie.com returned a non-JSON response for page ${page}`);
  }

  return Array.isArray(payload?.items) ? payload.items : [];
}

async function fetchAllItems() {
  const all = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const items = await fetchPage(page);
    if (!items.length) break;
    all.push(...items);
  }

  return all;
}

async function buildMarketData() {
  const raw = await fetchAllItems();
  if (!raw.length) {
    throw new Error("Failed to fetch any Grow a Garden market data");
  }

  const normalized = raw
    .filter((item) => item.type !== "Currency")
    .map(normalizeItem);

  // Traderie sometimes lists the same pet/crop twice with different internal
  // IDs. Deduplicate by name, keeping whichever copy has a value.
  const byName = new Map();
  for (const item of normalized) {
    const existing = byName.get(item.name);
    if (!existing || (item.current.supreme.value != null && existing.current.supreme.value == null)) {
      byName.set(item.name, item);
    }
  }
  const items = Array.from(byName.values());

  const existingIds = new Set(items.map((item) => item.id));
  const extraItems = EXTRA_PETS
    .map(normalizeExtraPet)
    .filter((item) => !existingIds.has(item.id));

  cache = { items: [...items, ...extraItems], refreshedAt: new Date().toISOString() };
  return cache;
}

function isStale() {
  if (!cache.refreshedAt) return true;
  return Date.now() - new Date(cache.refreshedAt).getTime() > CACHE_TTL_MS;
}

async function getMarketData() {
  if (isStale()) {
    if (!inFlight) {
      inFlight = buildMarketData()
        .catch((err) => {
          console.error("[growagarden] failed to refresh data:", err.message);
          return cache;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    if (!cache.refreshedAt) {
      await inFlight;
    }
  }

  return { items: cache.items, refreshedAt: cache.refreshedAt };
}

async function getMarketItems() {
  const data = await getMarketData();
  return data.items;
}

async function getMarketItemById(itemId) {
  const items = await getMarketItems();
  return items.find((item) => item.id === itemId) ?? null;
}

async function getRecentMoves() {
  return [];
}

async function getStats() {
  const items = await getMarketItems();
  const itemsWithValue = items.filter((item) => item.current?.supreme?.value != null);

  return {
    totalItems: items.length,
    itemsWithSupremeValue: itemsWithValue.length,
    itemsWithEbayPrice: 0,
    averageSupremeValue: null,
    averageEbayPrice: null
  };
}

async function refreshMarketData() {
  const data = await buildMarketData();
  return { items: data.items, refreshedAt: data.refreshedAt };
}

module.exports = {
  getMarketData,
  getMarketItems,
  getMarketItemById,
  getRecentMoves,
  getStats,
  refreshMarketData
};
