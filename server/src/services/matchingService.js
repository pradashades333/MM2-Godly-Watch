function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/['â€˜â€™]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyMatch(itemName, listingTitle) {
  const item = normalizeName(itemName);
  const title = normalizeName(listingTitle);

  if (!item || !title) return false;

  const hasExact = title.includes(item);
  const itemWords = item.split(" ").filter(Boolean);
  const matchedWords = itemWords.filter((word) => title.includes(word));

  if (!hasExact && matchedWords.length === 0) {
    return false;
  }

  const badBroadTerms = ["random", "bundle", "lot", "all godlies", "super rare"];

  if (badBroadTerms.some((term) => title.includes(term)) && !hasExact) {
    return false;
  }

  if (title.includes("chroma") && !item.includes("chroma")) {
    return false;
  }

  if (title.includes("set") && !item.includes("set") && !hasExact) {
    return false;
  }

  return true;
}

function scoreListing(itemName, listing) {
  const title = listing?.title || "";
  const item = normalizeName(itemName);
  const normalizedTitle = normalizeName(title);
  const normalizedQuery = normalizeName(listing?.matchedQuery || "");

  if (!isLikelyMatch(itemName, title)) {
    return -999;
  }

  let score = 0;

  if (normalizedTitle.includes(item)) score += 100;
  if (normalizedTitle.startsWith(item)) score += 20;
  if (normalizedTitle.includes("murder mystery 2")) score += 20;
  if (normalizedTitle.includes("mm2")) score += 15;
  if (normalizedTitle.includes("godly")) score += 5;
  if (normalizedTitle.includes("ancient")) {
    score += item.includes("ancient") ? 5 : -20;
  }

  if (normalizedTitle.includes("cheap")) score -= 10;
  if (normalizedTitle.includes("bundle")) score -= 30;
  if (normalizedTitle.includes("lot")) score -= 30;
  if (normalizedTitle.includes("random")) score -= 40;
  if (normalizedTitle.includes("all godlies")) score -= 35;
  if (normalizedTitle.includes("super rare")) score -= 15;

  if (normalizedTitle.includes("set") && !item.includes("set")) score -= 20;
  if (normalizedTitle.includes("chroma") && !item.includes("chroma")) score -= 30;

  if (listing?.itemGroupType === "SELLER_DEFINED_VARIATIONS") score -= 20;
  if (listing?.itemGroupType === "SELLER_DEFINED_VARIATIONS" && normalizedTitle.includes("&")) {
    score -= 25;
  }
  if (normalizedTitle.includes("godlies")) score -= 20;
  if (normalizedTitle.includes("ancients")) score -= 20;
  if (normalizedTitle.includes("guns") && !normalizedTitle.includes(item)) score -= 15;
  if (normalizedTitle.includes("&")) score -= 20;
  if (normalizedTitle.includes("sunset") && item === "sunrise") score -= 30;
  if (normalizedTitle.includes("sunrise") && item === "sunset") score -= 30;

  if (normalizedQuery.includes("gun")) {
    if (normalizedTitle.includes("gun")) score += 25;
    else score -= 35;

    if (normalizedTitle.includes(`${item} mm2 godly gun`)) score += 30;
    if (normalizedTitle.includes(`${item} mm2 gun`)) score += 20;
  }

  if (normalizedQuery.includes("knife")) {
    if (normalizedTitle.includes("knife")) score += 25;
    else score -= 35;
  }

  return score;
}

module.exports = {
  normalizeName,
  isLikelyMatch,
  scoreListing
};
