export function calculateMarketStats(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const topValueItem = [...safeItems]
    .filter((item) => item.current?.supreme?.value != null)
    .sort((left, right) => right.current.supreme.value - left.current.supreme.value)[0] || null;
  const cheapestEbayItem = [...safeItems]
    .filter((item) => item.current?.ebay?.totalPrice != null)
    .sort((left, right) => left.current.ebay.totalPrice - right.current.ebay.totalPrice)[0] || null;

  return {
    totalItems: safeItems.length,
    itemsWithEbay: safeItems.filter((item) => item.current?.ebay?.price != null).length,
    topValueItem,
    cheapestEbayItem
  };
}
