require("dotenv").config();

const { scoreListing } = require("./matchingService");

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_ENV = process.env.EBAY_ENV || "production";
const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || "EBAY_DE";

const EBAY_API_ROOT =
  EBAY_ENV === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
const exchangeRateCache = new Map();

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

async function searchEbay(query, accessToken, marketplaceId = EBAY_MARKETPLACE_ID) {
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

async function getExchangeRate(fromCurrency, toCurrency = "EUR") {
  if (!fromCurrency || fromCurrency === toCurrency) {
    return 1;
  }

  const cacheKey = `${fromCurrency}:${toCurrency}`;

  if (exchangeRateCache.has(cacheKey)) {
    return exchangeRateCache.get(cacheKey);
  }

  const url = new URL("https://api.frankfurter.app/latest");
  url.searchParams.set("from", fromCurrency);
  url.searchParams.set("to", toCurrency);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FX lookup failed: ${response.status}`);
  }

  const data = await response.json();
  const rate = data?.rates?.[toCurrency];

  if (!rate) {
    throw new Error(`Missing FX rate for ${fromCurrency} to ${toCurrency}`);
  }

  exchangeRateCache.set(cacheKey, rate);
  return rate;
}

async function convertAmountToEUR(amount, currency) {
  if (amount == null) return null;
  if (!currency || currency === "EUR") return amount;

  const rate = await getExchangeRate(currency, "EUR");
  return Number((amount * rate).toFixed(2));
}

async function normalizeEbayListing(listing, matchedQuery) {
  const sourcePrice = listing?.price?.value ? Number(listing.price.value) : null;
  const sourceCurrency = listing?.price?.currency ?? null;

  const shippingOption = listing?.shippingOptions?.[0] ?? null;
  const rawShippingPrice =
    shippingOption?.shippingCost?.value != null
      ? Number(shippingOption.shippingCost.value)
      : 0;

  const shippingCurrency =
    shippingOption?.shippingCost?.currency ?? sourceCurrency;

  const priceEUR = await convertAmountToEUR(sourcePrice, sourceCurrency);
  const shippingPriceEUR = await convertAmountToEUR(rawShippingPrice, shippingCurrency);

  const totalPriceEUR =
    priceEUR != null && shippingPriceEUR != null
      ? Number((priceEUR + shippingPriceEUR).toFixed(2))
      : null;

  return {
    itemId: listing?.itemId ?? null,
    legacyItemId: listing?.legacyItemId ?? null,
    title: listing?.title ?? "",
    priceEUR,
    sourcePrice,
    sourceCurrency,
    shippingPriceEUR,
    totalPriceEUR,
    matchedQuery,
    url: listing?.itemWebUrl ?? null,
    seller: listing?.seller?.username ?? null,
    itemGroupType: listing?.itemGroupType ?? null,
    listingMarketplaceId: listing?.listingMarketplaceId ?? null
  };
}

function dedupeQueries(queries) {
  return [...new Set(queries.filter(Boolean))];
}

function buildFallbackQueries(itemName) {
  return dedupeQueries([
    `MM2 ${itemName}`
  ]);
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

async function fetchListingsForQueries(queries, accessToken) {
  const allListings = [];

  for (const query of queries) {
    const marketplaces = customMarketplaceOrder(query);

    for (const marketplaceId of marketplaces) {
      const results = await searchEbay(query, accessToken, marketplaceId);
      const listings = await Promise.all(
        (results.itemSummaries || []).map((listing) =>
          normalizeEbayListing(listing, query)
        )
      );

      allListings.push(...listings);
    }
  }

  return allListings;
}

function customMarketplaceOrder(query) {
  const normalizedQuery = String(query || "").toLowerCase();

  if (normalizedQuery.includes("sunrise") || normalizedQuery.includes("sunset")) {
    return [EBAY_MARKETPLACE_ID, "EBAY_GB"];
  }

  return [EBAY_MARKETPLACE_ID];
}

function pickBestListing(listings, itemName) {
  const scored = listings
    .map((listing) => ({
      ...listing,
      relevanceScore: scoreListing(itemName, listing)
    }))
    .filter(
      (listing) =>
        listing.url &&
        listing.sourcePrice != null &&
        listing.relevanceScore > 0
    )
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      const leftPrice = a.totalPriceEUR ?? a.sourcePrice;
      const rightPrice = b.totalPriceEUR ?? b.sourcePrice;
      return leftPrice - rightPrice;
    });

  if (!scored.length) return null;

  const topFew = scored.slice(0, 4);
  const cheapest = topFew[0];
  const nextThree = topFew.slice(1);

  if (nextThree.length >= 2) {
    const cheapestPrice = cheapest.totalPriceEUR ?? cheapest.sourcePrice;
    const nextPrices = nextThree.map((item) => item.totalPriceEUR ?? item.sourcePrice);
    const averageNext =
      nextPrices.reduce((sum, value) => sum + value, 0) / nextPrices.length;

    if (cheapestPrice < averageNext * 0.7) {
      return nextThree[0];
    }
  }

  return cheapest;
}

async function fetchEbayForItem(itemName, customQueries = []) {
  const token = await getEbayAccessToken();

  const primaryQueries =
    customQueries.length > 0
      ? dedupeQueries(customQueries)
      : [`Murder Mystery 2 ${itemName}`];
  const allListings = await fetchListingsForQueries(primaryQueries, token);
  let queriesUsed = [...primaryQueries];
  let best = pickBestListing(allListings, itemName);

  if (!customQueries.length && shouldExpandSearch(best)) {
    const fallbackQueries = buildFallbackQueries(itemName).filter(
      (query) => !queriesUsed.includes(query)
    );

    if (fallbackQueries.length) {
      const fallbackListings = await fetchListingsForQueries(fallbackQueries, token);
      allListings.push(...fallbackListings);
      queriesUsed = [...queriesUsed, ...fallbackQueries];
      best = pickBestListing(allListings, itemName);
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
