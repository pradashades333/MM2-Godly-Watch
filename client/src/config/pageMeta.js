// Shared SEO metadata — used by the app at runtime (applyPageMeta) and by
// scripts/prerender.mjs at build time to emit static HTML per route.

export const SITE_URL = "https://godlywatch.com";

export const HOME_META = {
  title: "GodlyWatch | MM2, Adopt Me & Grow a Garden Value Tracker",
  description:
    "GodlyWatch — live values and price tracking for MM2 (Murder Mystery 2), Adopt Me, and Grow a Garden on Roblox. Trade checker, inventory tracker, and marketplace. Updated daily.",
};

export const GAME_META = {
  mm2: {
    home: {
      title: "MM2 Values – Murder Mystery 2 Value List | GodlyWatch",
      description:
        "Live Murder Mystery 2 values updated daily. Check MM2 godly, chroma and ancient prices, track price history, and test trades with the free trade checker.",
    },
    board: {
      title: "MM2 Value List – Live Godly & Chroma Values | GodlyWatch",
      description:
        "Full MM2 value list with live Supreme values and real eBay sold prices for every godly, chroma, ancient and set. Sort by value, demand and 7-day trend.",
    },
    "trade-checker": {
      title: "MM2 Trade Checker – Win, Fair or Lose | GodlyWatch",
      description:
        "Free MM2 trade checker. Add up to 4 items per side and instantly see if your Murder Mystery 2 trade is a win, fair, or a loss based on live values.",
    },
    "inventory-tracker": {
      title: "MM2 Inventory Tracker – Collection Value | GodlyWatch",
      description:
        "Track your MM2 inventory value over time. Add your godlies and chromas and watch your collection's total worth update with daily price changes.",
    },
    marketplace: {
      title: "Buy MM2 Godlies – Safe MM2 Marketplace | GodlyWatch",
      description:
        "Buy MM2 godlies and chromas safely. Every listing is sold through eBay with buyer protection and compared against live market value before you pay.",
    },
  },
  adoptme: {
    home: {
      title: "Adopt Me Values – Pet Value List | GodlyWatch",
      description:
        "Live Adopt Me pet values updated daily. Check values for every pet, including Neon and Mega variants with Fly & Ride potions, and test trades for free.",
    },
    board: {
      title: "Adopt Me Value List – Live Pet Values | GodlyWatch",
      description:
        "Full Adopt Me value list with live values for every pet and vehicle — including Neon, Mega, Fly and Ride variants. Sorted by value and demand.",
    },
    "trade-checker": {
      title: "Adopt Me Trade Calculator – Win, Fair or Lose | GodlyWatch",
      description:
        "Free Adopt Me trade calculator. Add up to 9 items per side, pick Neon/Mega and Fly/Ride variants, and see instantly if your trade is win, fair or lose.",
    },
    "inventory-tracker": {
      title: "Adopt Me Inventory Tracker – Pet Collection Value | GodlyWatch",
      description:
        "Track the total value of your Adopt Me pet collection over time with live values for regular, Neon and Mega pets.",
    },
  },
  growagarden: {
    home: {
      title: "Grow a Garden Values – Pet & Crop Value List | GodlyWatch",
      description:
        "Live Grow a Garden values updated daily. Check prices for every pet, crop, egg and gear, and test your trades with the free trade checker.",
    },
    board: {
      title: "Grow a Garden Value List – Live Pet, Crop & Egg Values | GodlyWatch",
      description:
        "Full Grow a Garden value list with live values and demand for every pet, crop, egg and gear. Sorted by tier, value and 7-day trend.",
    },
    "trade-checker": {
      title: "Grow a Garden Trade Checker – Win, Fair or Lose | GodlyWatch",
      description:
        "Free Grow a Garden trade checker. Add items to both sides and instantly see if your trade is a win, fair or a loss based on live values.",
    },
    "inventory-tracker": {
      title: "Grow a Garden Inventory Tracker | GodlyWatch",
      description:
        "Track the total value of your Grow a Garden pets, crops and gear over time with live daily values.",
    },
  },
};

const GAME_SHORT = { mm2: "MM2", adoptme: "Adopt Me", growagarden: "Grow a Garden" };
const GAME_LONG = {
  mm2: "Murder Mystery 2 (MM2)",
  adoptme: "Adopt Me on Roblox",
  growagarden: "Grow a Garden on Roblox",
};

export function getItemPageMeta(gameId, itemName, valueText) {
  const shortName = GAME_SHORT[gameId] || gameId;
  const longName = GAME_LONG[gameId] || gameId;
  return {
    title: `${itemName} Value ${shortName} – Price & History | GodlyWatch`,
    description:
      `What is ${itemName} worth in ${longName}? ` +
      (valueText ? `Current value: ${valueText}. ` : "") +
      `Live value, price history chart and demand for ${itemName}, updated daily on GodlyWatch.`,
  };
}

export function getItemDescriptionText(gameId, itemName, { valueText, demandText, categoryText } = {}) {
  const shortName = GAME_SHORT[gameId] || gameId;
  const longName = GAME_LONG[gameId] || gameId;
  const categoryPhrase = categoryText
    ? `${/^[aeiou]/i.test(categoryText) ? "an" : "a"} ${categoryText}`
    : "an item";
  return [
    `${itemName} is ${categoryPhrase} in ${longName}.`,
    valueText
      ? `Its current value is ${valueText}, updated daily from live market data.`
      : `Its value is tracked daily from live market data.`,
    demandText ? `Demand is currently rated ${demandText}.` : null,
    `Use the free ${shortName} trade checker to see if a trade involving ${itemName} is a win, fair, or a loss.`,
  ]
    .filter(Boolean)
    .join(" ");
}
