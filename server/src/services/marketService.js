const supremeService = require("./supremeService");
const setService = require("./setService");
const ancientService = require("./ancientService");
const ebayService = require("./ebayService");
const imageService = require("./imageService");
const trackedItems = require("../config/trackedItems");
const chromaItems = require("../config/chromaItems");
const {
  readHistory,
  writeHistory,
  mergeSnapshots,
  getRecentMoves: buildRecentMoves
} = require("./historyService");

async function buildMarketData({ refreshEbay = true } = {}) {
  const [godlyItems, setItems, ancientItems] = await Promise.all([
    supremeService.scrapeGodlies(),
    setService.scrapeSets(),
    ancientService.scrapeAncients()
  ]);
  const sourceItems = [...ancientItems, ...godlyItems, ...setItems, ...chromaItems];

  const previousItems = await readHistory();
  const previousMap = new Map(previousItems.map((item) => [item.id, item]));
  const completedItems = [];

  for (const sourceItem of sourceItems) {
    const trackedItem = findTrackedItemByName(sourceItem.name);
    const previousItem = previousMap.get(sourceItem.id);

    let ebayData = previousItem?.current?.ebay ?? null;

    if (refreshEbay && sourceItem.category !== "chromas") {
      let bestListing = null;
      try {
        const ebayResult = await ebayService.fetchEbayForItem(
          sourceItem.name,
          trackedItem?.ebayQueries,
          sourceItem.category
        );
        bestListing = ebayResult?.best ?? null;
      } catch (err) {
        console.error(`[market] eBay fetch failed for "${sourceItem.name}":`, err.message);
      }
      if (bestListing) {
        ebayData = {
          price: bestListing.price,
          currency: bestListing.currency,
          shippingPrice: bestListing.shippingPrice,
          totalPrice: bestListing.totalPrice,
          matchedQuery: bestListing.matchedQuery,
          url: bestListing.url
        };
      }
    }

    const imageUrl = await imageService.getImageForItem(sourceItem);

    completedItems.push({
      id: sourceItem.id,
      name: sourceItem.name,
      category: sourceItem.category,
      imageUrl,
      current: {
        supreme: sourceItem.current?.supreme ?? null,
        ebay: ebayData
      },
      lastCheckedAt: new Date().toISOString(),
      history: []
    });
  }

  const mergedItems = mergeSnapshots(previousItems, completedItems);
  await writeHistory(mergedItems);
  return mergedItems;
}

function findTrackedItemByName(itemName) {
  return trackedItems.find((item) => item.name === itemName) || null;
}

async function refreshMarketData() {
  const items = await buildMarketData({ refreshEbay: true });
  return {
    items,
    refreshedAt: new Date().toISOString()
  };
}

async function getMarketData() {
  const items = await readHistory();

  // Always include hardcoded chromas even before the refresh runs
  const existingIds = new Set(items.map(i => i.id));
  const missingChromas = chromaItems.filter(c => !existingIds.has(c.id));
  const allItems = [...items, ...missingChromas];

  const hydratedItems = await hydrateItemImages(allItems);
  return {
    items: hydratedItems,
    refreshedAt: hydratedItems[0]?.lastCheckedAt ?? null
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
  const itemsWithEbay = items.filter((item) => item.current?.ebay?.price != null);
  const averageSupremeValue = itemsWithSupreme.length
    ? Math.round(
        itemsWithSupreme.reduce(
          (sum, item) => sum + (item.current?.supreme?.value ?? 0),
          0
        ) / itemsWithSupreme.length
      )
    : null;
  const averageEbayPrice = itemsWithEbay.length
    ? Number(
        (
          itemsWithEbay.reduce(
            (sum, item) => sum + (item.current?.ebay?.price ?? 0),
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
    averageEbayPrice
  };
}

async function hydrateItemImages(items) {
  return Promise.all(
    items.map(async (item) => {
      if (item?.imageUrl) {
        return item;
      }
      const imageUrl = await imageService.getImageForItem(item);
      if (!imageUrl) return item;
      return { ...item, imageUrl };
    })
  );
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
