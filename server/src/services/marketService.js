const supremeService = require("./supremeService");
const ebayService = require("./ebayService");
const imageService = require("./imageService");
const trackedItems = require("../config/trackedItems");
const {
  readHistory,
  writeHistory,
  mergeSnapshots,
  getRecentMoves: buildRecentMoves
} = require("./historyService");

async function buildMarketData() {
  const supremeItems = await supremeService.scrapeGodlies();
  const completedItems = [];

  for (const supremeItem of supremeItems) {
    const trackedItem = findTrackedItemByName(supremeItem.name);

    const ebayResult = await ebayService.fetchEbayForItem(
      supremeItem.name,
      trackedItem?.ebayQueries
    );
    const bestListing = ebayResult?.best ?? null;
    const imageUrl = await imageService.getImageForItem(supremeItem);

    completedItems.push({
      id: supremeItem.id,
      name: supremeItem.name,
      category: supremeItem.category,
      imageUrl,
      current: {
        supreme: supremeItem.current?.supreme ?? null,
        ebay: bestListing
          ? {
              priceEUR: bestListing.priceEUR,
              sourcePrice: bestListing.sourcePrice,
              sourceCurrency: bestListing.sourceCurrency,
              shippingPriceEUR: bestListing.shippingPriceEUR,
              totalPriceEUR: bestListing.totalPriceEUR,
              matchedQuery: bestListing.matchedQuery,
              url: bestListing.url
            }
          : null
      },
      lastCheckedAt: supremeItem.lastCheckedAt || new Date().toISOString(),
      history: []
    });
  }

  const previousItems = await readHistory();
  const mergedItems = mergeSnapshots(previousItems, completedItems);
  await writeHistory(mergedItems);

  return mergedItems;
}

function findTrackedItemByName(itemName) {
  return trackedItems.find((item) => item.name === itemName) || null;
}

async function refreshMarketData() {
  const items = await buildMarketData();

  return {
    items,
    refreshedAt: new Date().toISOString()
  };
}

async function getMarketData() {
  const items = await readHistory();

  return {
    items,
    refreshedAt: items[0]?.lastCheckedAt ?? null
  };
}

async function getMarketItems() {
  const data = await getMarketData();
  return data.items;
}

async function getMarketItemById(itemId) {
  const items = await getMarketItems();
  return items.find((item) => item.id === itemId) ?? null;
}

async function getRecentMoves(limit = 20) {
  const items = await getMarketItems();
  return buildRecentMoves(items, limit);
}

async function getStats() {
  const items = await getMarketItems();
  const itemsWithSupreme = items.filter((item) => item.current?.supreme?.value != null);
  const itemsWithEbay = items.filter((item) => item.current?.ebay?.priceEUR != null);
  const averageSupremeValue = itemsWithSupreme.length
    ? Math.round(
        itemsWithSupreme.reduce(
          (sum, item) => sum + (item.current?.supreme?.value ?? 0),
          0
        ) / itemsWithSupreme.length
      )
    : null;
  const averageEbayPriceEUR = itemsWithEbay.length
    ? Number(
        (
          itemsWithEbay.reduce(
            (sum, item) => sum + (item.current?.ebay?.priceEUR ?? 0),
            0
          ) / itemsWithEbay.length
        ).toFixed(2)
      )
    : null;

  return {
    totalItems: items.length,
    itemsWithSupremeValue: itemsWithSupreme.length,
    itemsWithEbayPrice: itemsWithEbay.length,
    averageSupremeValue,
    averageEbayPriceEUR
  };
}

module.exports = {
  buildMarketData,
  refreshMarketData,
  getMarketData,
  getMarketItems,
  getMarketItemById,
  getRecentMoves,
  getStats
};
