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

async function searchEbay(query, accessToken) {
  const url = new URL(`${EBAY_API_ROOT}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay search failed: ${response.status} ${text}`);
  }

  return response.json();
}

function normalizeEbayListing(listing, matchedQuery) {
  const sourcePrice = listing?.price?.value ? Number(listing.price.value) : null;
  const sourceCurrency = listing?.price?.currency ?? null;

  const shippingOption = listing?.shippingOptions?.[0] ?? null;
  const rawShippingPrice =
    shippingOption?.shippingCost?.value != null
      ? Number(shippingOption.shippingCost.value)
      : 0;

  const shippingCurrency =
    shippingOption?.shippingCost?.currency ?? sourceCurrency;

  const priceEUR =
    sourceCurrency === "EUR" ? sourcePrice : null;

  const shippingPriceEUR =
    shippingCurrency === "EUR" ? rawShippingPrice : 0;

  const totalPriceEUR =
    priceEUR != null ? Number((priceEUR + shippingPriceEUR).toFixed(2)) : null;

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
  const queries =
    customQueries.length > 0
      ? customQueries
      : [`Murder Mystery 2 ${itemName}`];
  const allListings = [];

  for (const query of queries) {
    const results = await searchEbay(query, token);

    const listings = (results.itemSummaries || []).map((listing) =>
      normalizeEbayListing(listing, query)
    );

    allListings.push(...listings);
  }

  const best = pickBestListing(allListings, itemName);

  return {
    queries,
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
