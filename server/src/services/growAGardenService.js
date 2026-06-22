const { execFile } = require("child_process");
const { promisify } = require("util");
const http2 = require("http2");
const zlib = require("zlib");

const EXTRA_PETS = require("../data/growAGardenExtraPets");

const execFileAsync = promisify(execFile);

const ITEMS_URL = "https://traderie.com/api/growagarden/items";
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_PAGES = 60;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

let staticFallback = [];
try {
  staticFallback = require("../data/growAGardenCache.json");
} catch {}

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

function fetchPageHttp2(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = http2.connect(`https://${parsed.hostname}`, {
      settings: { enablePush: false },
    });
    client.on("error", (err) => { client.close(); reject(err); });

    const timer = setTimeout(() => { client.close(); reject(new Error("http2 timeout")); }, 20000);

    const req = client.request({
      ":method": "GET",
      ":path": parsed.pathname + parsed.search,
      "user-agent": USER_AGENT,
      "accept": "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
      "referer": "https://traderie.com/growagarden",
      "origin": "https://traderie.com",
    });

    let encoding = null;
    req.on("response", (headers) => {
      encoding = headers["content-encoding"];
    });

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      clearTimeout(timer);
      client.close();
      const raw = Buffer.concat(chunks);
      try {
        let body;
        if (encoding === "br") body = zlib.brotliDecompressSync(raw);
        else if (encoding === "gzip") body = zlib.gunzipSync(raw);
        else if (encoding === "deflate") body = zlib.inflateSync(raw);
        else body = raw;
        resolve(body.toString("utf8"));
      } catch {
        resolve(raw.toString("utf8"));
      }
    });
    req.on("error", (err) => { clearTimeout(timer); client.close(); reject(err); });
    req.end();
  });
}

async function fetchPageCurl(url) {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-s", "--compressed",
      "-A", USER_AGENT,
      "-H", "Accept: application/json, text/plain, */*",
      "-H", "Accept-Language: en-US,en;q=0.9",
      "-H", "Referer: https://traderie.com/growagarden",
      "-H", "Origin: https://traderie.com",
      "--max-time", "20",
      url,
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  return stdout;
}

async function fetchPage(page) {
  const url = `${ITEMS_URL}?page=${encodeURIComponent(String(page))}`;

  const strategies = [
    { name: "curl", fn: () => fetchPageCurl(url) },
    { name: "http2", fn: () => fetchPageHttp2(url) },
    { name: "fetch", fn: async () => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://traderie.com/growagarden",
        },
      });
      return await res.text();
    }},
  ];

  for (const { name, fn } of strategies) {
    try {
      const text = await fn();
      const payload = JSON.parse(text);
      if (Array.isArray(payload?.items)) {
        if (page === 1) console.log(`[growagarden] fetching via ${name}`);
        return payload.items;
      }
    } catch (err) {
      console.warn(`[growagarden] ${name} failed for page ${page}: ${err.message}`);
    }
  }

  throw new Error(`All fetch strategies failed for page ${page}`);
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
          if (!cache.items.length && staticFallback.length) {
            console.log(`[growagarden] using static fallback (${staticFallback.length} items)`);
            cache = { items: staticFallback, refreshedAt: "static" };
          }
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
