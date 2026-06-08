require("dotenv").config();

const { scoreListing } = require("./matchingService");

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_ENV = process.env.EBAY_ENV || "production";

const EBAY_API_ROOT =
  EBAY_ENV === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

const PRIMARY_MARKETPLACE = "EBAY_BE";
const SET_MARKETPLACES = ["EBAY_DE", "EBAY_BE", "EBAY_NL", "EBAY_ES", "EBAY_IT"];

async function getEbayAccessToken() {
  const credentials = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_API_ROOT}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function searchEbay(query, accessToken, marketplaceId) {
  const url = new URL(`${EBAY_API_ROOT}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay search failed: ${response.status} ${text}`);
  }

  return response.json();
}

function normalizeEbayListing(listing, matchedQuery) {
  const price = listing?.price?.value ? Number(listing.price.value) : null;
  const currency = listing?.price?.currency ?? null;

  const shippingOption = listing?.shippingOptions?.[0] ?? null;
  const shippingPrice =
    shippingOption?.shippingCost?.value != null
      ? Number(shippingOption.shippingCost.value)
      : 0;

  const totalPrice =
    price != null ? Number((price + shippingPrice).toFixed(2)) : null;

  return {
    itemId: listing?.itemId ?? null,
    legacyItemId: listing?.legacyItemId ?? null,
    title: listing?.title ?? "",
    price,
    currency,
    shippingPrice,
    totalPrice,
    matchedQuery,
    url: listing?.itemWebUrl ?? null,
    seller: listing?.seller?.username ?? null,
    itemGroupType: listing?.itemGroupType ?? null,
    listingMarketplaceId: listing?.listingMarketplaceId ?? null
  };
}

function dedupeQueries(queries) {
  return [...new Set(queries.filter(Boolean).map((query) => query.trim()))];
}

function expandChromaAlias(name) {
  const baseName = String(name || "").trim();
  if (!baseName) return baseName;
  return baseName.replace(/\bC\.\s*/gi, "Chroma ");
}

function buildSearchNameVariants(itemName) {
  const baseName = String(itemName || "").replace(/\s+/g, " ").trim();
  const chromaExpanded = expandChromaAlias(baseName);
  const withoutParentheses = baseName.replace(/\s*\([^)]*\)/g, "").trim();
  const chromaWithoutParentheses = expandChromaAlias(withoutParentheses);
  const parentheticalAsWords = baseName
    .replace(/\(([^)]+)\)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
  const chromaParentheticalAsWords = expandChromaAlias(parentheticalAsWords);
  const withoutApostrophes = baseName.replace(/['']/g, "").trim();
  const chromaWithoutApostrophes = expandChromaAlias(withoutApostrophes);
  const possessiveAsPlural = baseName.replace(/['']s\b/gi, "s").trim();
  const chromaPossessiveAsPlural = expandChromaAlias(possessiveAsPlural);

  return dedupeQueries([
    baseName,
    chromaExpanded,
    withoutParentheses,
    chromaWithoutParentheses,
    parentheticalAsWords,
    chromaParentheticalAsWords,
    withoutApostrophes,
    chromaWithoutApostrophes,
    possessiveAsPlural,
    chromaPossessiveAsPlural
  ]);
}

function buildFallbackQueries(itemName) {
  const nameVariants = buildSearchNameVariants(itemName);
  const queries = [];

  for (const name of nameVariants) {
    queries.push(`MM2 ${name}`);

    if (name.toLowerCase().includes(" set")) {
      queries.push(`Murder Mystery 2 ${name}`);
      queries.push(`${name} MM2`);
    }
  }

  return dedupeQueries(queries);
}

function shouldExpandSearch(bestListing) {
  if (!bestListing) {
    return true;
  }

  const title = String(bestListing.title || "").toLowerCase();

  return (
    bestListing.itemGroupType === "SELLER_DEFINED_VARIATIONS" ||
    title.includes(" godlies") ||
    title.includes(" ancients")
  );
}

function getMarketplacesForQuery(query) {
  const normalizedQuery = String(query || "").toLowerCase();

  if (normalizedQuery.includes(" set")) {
    return SET_MARKETPLACES;
  }

  return [PRIMARY_MARKETPLACE];
}

async function fetchListingsForQueries(queries, accessToken) {
  const allListings = [];
  const seenIds = new Set();

  for (const query of queries) {
    for (const marketplaceId of getMarketplacesForQuery(query)) {
      await new Promise(r => setTimeout(r, 400));
      const results = await searchEbay(query, accessToken, marketplaceId);
      for (const listing of (results.itemSummaries || [])) {
        const id = listing.itemId;
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        allListings.push(normalizeEbayListing(listing, query));
      }
    }
  }

  return allListings;
}

function pickBestListing(listings, itemName, category = null) {
  const scored = listings
    .map((listing) => ({
      ...listing,
      relevanceScore: scoreListing(itemName, listing, category)
    }))
    .filter(
      (listing) =>
        listing.url &&
        listing.price != null &&
        listing.relevanceScore >= 15 &&
        listing.itemGroupType !== "SELLER_DEFINED_VARIATIONS"
    )
    .sort((a, b) => {
      const leftPrice = a.totalPrice ?? a.price;
      const rightPrice = b.totalPrice ?? b.price;
      return leftPrice - rightPrice;
    });

  if (!scored.length) return null;

  const cheapest = scored[0];
  const nextFew = scored.slice(1, 4);

  if (nextFew.length >= 2) {
    const cheapestPrice = cheapest.totalPrice ?? cheapest.price;
    const nextPrices = nextFew.map((item) => item.totalPrice ?? item.price);
    const averageNext =
      nextPrices.reduce((sum, value) => sum + value, 0) / nextPrices.length;

    if (cheapestPrice < averageNext * 0.4) {
      return nextFew[0];
    }
  }

  return cheapest;
}

async function fetchEbayForItem(itemName, customQueries = [], category = null) {
  const token = await getEbayAccessToken();
  const nameVariants = buildSearchNameVariants(itemName);

  const primaryQueries =
    customQueries.length > 0
      ? dedupeQueries(customQueries)
      : dedupeQueries(nameVariants.map((name) => `Murder Mystery 2 ${name}`));

  const allListings = await fetchListingsForQueries(primaryQueries, token);
  let queriesUsed = [...primaryQueries];
  let best = pickBestListing(allListings, itemName, category);

  if (!customQueries.length && shouldExpandSearch(best)) {
    const fallbackQueries = buildFallbackQueries(itemName).filter(
      (query) => !queriesUsed.includes(query)
    );

    if (fallbackQueries.length) {
      const fallbackListings = await fetchListingsForQueries(fallbackQueries, token);
      allListings.push(...fallbackListings);
      queriesUsed = [...queriesUsed, ...fallbackQueries];
      best = pickBestListing(allListings, itemName, category);
    }
  }

  return {
    queries: queriesUsed,
    listings: allListings,
    best
  };
}

module.exports = {
  getEbayAccessToken,
  searchEbay,
  normalizeEbayListing,
  pickBestListing,
  fetchEbayForItem
};
