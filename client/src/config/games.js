// Registry of supported games. Adding a new game means: add an entry here
// with its tier definitions, point the backend at a matching `/api/market`
// service (see server/src/config/games.js), and (optionally) add a card
// component for its item shape.
export const GAMES = {
  mm2: {
    id: "mm2",
    label: "MM2",
    shortLabel: "M2",
    icon: "/mm2-logo.webp",
    color: "var(--tier-chroma)",
    name: "Murder Mystery 2",
    valueLabel: "Supreme",
    hasEbay: true,
    hasMarketplace: true,
    hasListView: true,
    tiers: [
      { key: "chroma", label: "Chroma", color: "var(--tier-chroma)" },
      { key: "godly", label: "Godly", color: "var(--tier-godly)" },
      { key: "ancient", label: "Ancient", color: "var(--tier-ancient)" },
      { key: "sets", label: "Sets", color: "var(--tier-vintage)" }
    ],
  },
  adoptme: {
    id: "adoptme",
    label: "Adopt Me",
    shortLabel: "AM",
    icon: "/adoptme-logo.jpg",
    color: "var(--tier-godly)",
    name: "Adopt Me!",
    valueLabel: "Value",
    hasEbay: false,
    hasMarketplace: false,
    hasListView: false,
    tiers: [
      { key: "legendary", label: "Legendary", color: "var(--tier-legend)" },
      { key: "ultra-rare", label: "Ultra-Rare", color: "var(--tier-chroma)" },
      { key: "rare", label: "Rare", color: "var(--tier-godly)" },
      { key: "uncommon", label: "Uncommon", color: "var(--tier-ancient)" },
      { key: "common", label: "Common", color: "var(--tier-vintage)" }
    ],
    categories: [
      { key: "pets", label: "Pets", color: "var(--tier-chroma)" },
      { key: "vehicles", label: "Vehicles", color: "var(--tier-ancient)" }
    ]
  },
  growagarden: {
    id: "growagarden",
    label: "Grow a Garden",
    shortLabel: "GAG",
    icon: "/growagarden-logo.jpg",
    color: "var(--tier-vintage)",
    name: "Grow a Garden",
    valueLabel: "Value",
    hasEbay: false,
    hasMarketplace: false,
    hasListView: false,
    tiers: [
      { key: "mythical", label: "Mythical", color: "var(--tier-legend)" },
      { key: "legendary", label: "Legendary", color: "var(--tier-chroma)" },
      { key: "rare", label: "Rare", color: "var(--tier-godly)" },
      { key: "uncommon", label: "Uncommon", color: "var(--tier-ancient)" },
      { key: "common", label: "Common", color: "var(--tier-vintage)" }
    ],
    categories: [
      { key: "pets", label: "Pets", color: "var(--tier-chroma)" },
      { key: "crops", label: "Crops", color: "var(--tier-vintage)" },
      { key: "eggs", label: "Eggs", color: "var(--tier-ancient)" },
      { key: "gears", label: "Gears", color: "var(--tier-godly)" }
    ]
  }
};

export const GAME_LIST = Object.values(GAMES);
export const DEFAULT_GAME = "mm2";

export function getGameConfig(gameId) {
  return GAMES[gameId] || GAMES[DEFAULT_GAME];
}
