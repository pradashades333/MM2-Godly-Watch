const supremeService = require("./supremeService");
const ebayService = require("./ebayService");
const imageService = require("./imageService");
const trackedItems = require("../config/trackedItems");
const { readHistory, writeHistory, mergeSnapshots } = require("./historyService");

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

module.exports = {
  buildMarketData
};
