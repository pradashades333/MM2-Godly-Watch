const { getPetImageMap } = require("./adoptMeImageService");

const PETS_SOURCE_URL = "https://amvgg.com/values/pets";
const VEHICLES_SOURCE_URL = "https://amvgg.com/values/vehicles";
const IMAGE_BASE = "https://amvgg.com";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cache = { items: [], refreshedAt: null };
let inFlight = null;

const DEMAND_RATING = {
  Low: 1,
  Medium: 2,
  High: 3,
  "Very High": 4,
  Insane: 5
};

// Walks `str` starting at `startIdx` (which must point at `[` or `{`) and
// returns the substring up to its matching close, treating quoted strings
// (with backslash escapes) as opaque so brackets inside them don't count.
function extractBalanced(str, startIdx) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }

  return null;
}

// amvgg.com's /values/<category> pages sometimes respond with the raw
// Next.js RSC payload (content-type text/x-component) instead of full HTML.
// In that format, `"<listKey>":[...]` appears directly as plain JSON in the
// response body (e.g. "pets" on /values/pets, "items" on /values/vehicles).
function extractDirectList(html, listKey) {
  const key = `"${listKey}":`;
  let idx = html.indexOf(key);

  while (idx !== -1) {
    const arrayText = extractBalanced(html, idx + key.length);
    if (arrayText) {
      try {
        const list = JSON.parse(arrayText);
        if (Array.isArray(list) && list.length) return list;
      } catch {
        // keep searching
      }
    }
    idx = html.indexOf(key, idx + key.length);
  }

  return null;
}

// Other times the same pages embed their data as RSC stream chunks within
// full HTML: <script>self.__next_f.push([1,"...JSON-escaped payload..."])</script>
// where the payload string contains `"<listKey>":[...]`.
function extractRscStreamList(html, listKey) {
  const needle = "self.__next_f.push(";
  const key = `"${listKey}":`;
  let searchFrom = 0;

  while (true) {
    const callIdx = html.indexOf(needle, searchFrom);
    if (callIdx === -1) break;

    const argStart = html.indexOf("[", callIdx + needle.length);
    searchFrom = callIdx + needle.length;
    if (argStart === -1) continue;

    const argText = extractBalanced(html, argStart);
    if (!argText) continue;

    let outer;
    try {
      outer = JSON.parse(argText);
    } catch {
      continue;
    }

    const payload = outer?.[1];
    if (typeof payload !== "string") continue;

    const keyIdx = payload.indexOf(key);
    if (keyIdx === -1) continue;

    const arrayText = extractBalanced(payload, keyIdx + key.length);
    if (!arrayText) continue;

    try {
      const list = JSON.parse(arrayText);
      if (Array.isArray(list) && list.length) return list;
    } catch {
      continue;
    }
  }

  return null;
}

function extractListFromHtml(html, listKey) {
  return extractDirectList(html, listKey) ?? extractRscStreamList(html, listKey);
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function demandToRating(demand) {
  return DEMAND_RATING[demand] ?? 0;
}

function normalizePet(pet, imageMap = {}) {
  const regularValue = toNumber(pet.regularValue);
  const neonValue = toNumber(pet.neonValue);
  const megaValue = toNumber(pet.megaValue);

  return {
    id: `adoptme-${slugify(pet.name)}`,
    name: pet.name,
    game: "adoptme",
    category: "pets",
    imageUrl: imageMap[pet.name] ?? `${IMAGE_BASE}/items/${encodeURIComponent(pet.name)}.webp`,
    current: {
      supreme: {
        value: regularValue,
        demand: demandToRating(pet.regularDemand),
        rarity: demandToRating(pet.megaDemand)
      },
      ebay: null,
      adoptme: {
        // "FR" (fly + ride potions) values — the default/headline values
        regularValue,
        neonValue,
        megaValue,
        // no-potion values
        npRegularValue: toNumber(pet.npRegularValue),
        npNeonValue: toNumber(pet.npNeonValue),
        npMegaValue: toNumber(pet.npMegaValue),
        // single fly-potion values
        fValue: toNumber(pet.fValue),
        nfValue: toNumber(pet.nfValue),
        mfValue: toNumber(pet.mfValue),
        // single ride-potion values
        rValue: toNumber(pet.rValue),
        nrValue: toNumber(pet.nrValue),
        mrValue: toNumber(pet.mrValue),
        // demand ratings (0-5) for each value above
        regularDemand: demandToRating(pet.regularDemand),
        neonDemand: demandToRating(pet.neonDemand),
        megaDemand: demandToRating(pet.megaDemand),
        npRegularDemand: demandToRating(pet.npRegularDemand),
        npNeonDemand: demandToRating(pet.npNeonDemand),
        npMegaDemand: demandToRating(pet.npMegaDemand),
        fDemand: demandToRating(pet.fDemand),
        nfDemand: demandToRating(pet.nfDemand),
        mfDemand: demandToRating(pet.mfDemand),
        rDemand: demandToRating(pet.rDemand),
        nrDemand: demandToRating(pet.nrDemand),
        mrDemand: demandToRating(pet.mrDemand),
        origin: pet.origin ?? null
      }
    },
    lastCheckedAt: new Date().toISOString(),
    history: []
  };
}

function normalizeVehicle(vehicle) {
  return {
    id: `adoptme-vehicle-${slugify(vehicle.name)}`,
    name: vehicle.name,
    game: "adoptme",
    category: "vehicles",
    imageUrl: `${IMAGE_BASE}/items/${encodeURIComponent(vehicle.name)}.webp`,
    current: {
      supreme: {
        value: toNumber(vehicle.value),
        demand: demandToRating(vehicle.demand),
        rarity: 0
      },
      ebay: null,
      adoptme: null
    },
    lastCheckedAt: new Date().toISOString(),
    history: []
  };
}

async function fetchAmvggPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`amvgg.com responded with ${response.status}`);
  }

  return response.text();
}

async function fetchPets() {
  const html = await fetchAmvggPage(PETS_SOURCE_URL);
  const pets = extractListFromHtml(html, "pets");
  if (!pets) {
    throw new Error("Could not find pet data in amvgg.com response");
  }

  const imageMap = await getPetImageMap(pets.map((pet) => pet.name));
  return pets.map((pet) => normalizePet(pet, imageMap));
}

async function fetchVehicles() {
  const html = await fetchAmvggPage(VEHICLES_SOURCE_URL);
  const vehicles = extractListFromHtml(html, "items");
  if (!vehicles) {
    throw new Error("Could not find vehicle data in amvgg.com response");
  }

  return vehicles.map(normalizeVehicle);
}

async function buildMarketData() {
  const [petsResult, vehiclesResult] = await Promise.allSettled([fetchPets(), fetchVehicles()]);

  if (petsResult.status === "rejected") {
    console.error("[adoptme] failed to fetch pets:", petsResult.reason.message);
  }
  if (vehiclesResult.status === "rejected") {
    console.error("[adoptme] failed to fetch vehicles:", vehiclesResult.reason.message);
  }

  const pets = petsResult.status === "fulfilled" ? petsResult.value : [];
  const vehicles = vehiclesResult.status === "fulfilled" ? vehiclesResult.value : [];

  if (!pets.length && !vehicles.length) {
    throw new Error("Failed to fetch any Adopt Me market data");
  }

  const items = [...pets, ...vehicles];
  cache = { items, refreshedAt: new Date().toISOString() };
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
          console.error("[adoptme] failed to refresh pet data:", err.message);
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
