const supremeService = require("./supremeService");
const ebayService = require("./ebayService");
const imageService = require("./imageService");
const { readHistory, writeHistory, mergeSnapshots } = require("./historyService");

async function buildMarketData() {
  const supremeItems = await supremeService.scrapeGodlies();
  const completedItems = [];

  for (const supremeItem of supremeItems) {
    const ebayResult = await ebayService.fetchEbayForItem(supremeItem.name);
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

module.exports = {
  buildMarketData
};
