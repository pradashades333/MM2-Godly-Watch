function slugify(name) {
  return name.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function make(name, value, demand, rarity, lastChange, origin) {
  return {
    id: slugify(name),
    name,
    category: "chromas",
    current: {
      supreme: { value, demand, rarity, lastChange, origin, stability: "Stable", range: null, lastUpdated: null, pageUrl: "https://supremevalues.com/mm2/chromas" }
    },
    lastCheckedAt: new Date().toISOString(),
    history: []
  };
}

module.exports = [
  // Tier 3
  make("C. Traveler's Gun",   225000, 9, 10,  5000, "Hallows 2023 (Unboxed)"),
  make("Chroma Evergun",       76000, 8,  8, -1000, "Xmas 2023 (Gifting)"),
  make("Chroma Evergreen",     60000, 7,  7, -1000, "Xmas 2023 (Unboxed)"),
  make("Chroma Bauble",        38000, 7,  6, -1000, "Xmas 2024 (Gifting)"),
  make("C. Constellation",     36000, 7,  6, -1000, "Xmas 2024 (Unboxed)"),
  make("C. Vampire's Gun",     35000, 7,  6, -1000, "Hallows 2024 (Unboxed)"),
  make("Chroma Alienbeam",     30000, 7,  6, -1000, "Hallows 2025 (Unboxed)"),
  // Tier 2
  make("Chroma Raygun",        14500, 6,  5,  -250, "Hallows 2025 (Tier 25)"),
  make("Chroma Sunrise",       11250, 6,  5,   250, "Summer 2025 (Unboxed)"),
  make("C. Snowcannon",         8500, 6,  5,   250, "Xmas 2025 (Tier 30)"),
  make("Chroma Blizzard",       8000, 5,  5,  -500, "Xmas 2025 Item Pack"),
  make("Chroma Sunset",         6500, 5,  5,   250, "Summer 2025 (Tier 25)"),
  make("C. Snow Dagger",        5750, 5,  5,   250, "Xmas 2025 (Unboxed)"),
  make("Chroma Treat",          4850, 5,  4,  -150, "Valentine 2026 Item Pack"),
  make("C. Heart Wand",         4750, 5,  4,  -250, "Valentine 2026 (Unboxed)"),
  make("Chroma Snowstorm",      4250, 5,  5,  -250, "Xmas 2025 Item Pack"),
  make("Chroma Watergun",       3400, 5,  5,   -50, "Summer 2024 (Unboxed)"),
  make("Chroma Sweet",          2850, 5,  4,  -150, "Valentine 2026 Item Pack"),
  make("Chroma Ornament",       2550, 5,  4,   -50, "Xmas 2025 (Gifting)"),
  // Tier 1
  make("C. Darkbringer",          75, 1,  2,    -5, "Mystery Crate #2"),
  make("C. Lightbringer",         70, 1,  2,    -5, "Mystery Crate #2"),
  make("Chroma Luger",            55, 1,  2,    -2, "Gun Box #1"),
  make("C. Candleflame",          45, 1,  2,    -3, "Hallows 2021 (Unboxed)"),
  make("C. Elderwood Blade",      45, 1,  2,    -2, "Hallows 2022 (Unboxed)"),
  make("C. Swirly Gun",           45, 1,  2,    -2, "Xmas 2021 (Unboxed)"),
  make("Chroma Laser",            42, 1,  2,    -6, "Gun Box #3"),
  make("C. Cookiecane",           38, 1,  2,    -2, "Xmas 2022 (Unboxed)"),
  make("C. Deathshard",           38, 1,  2,    -4, "Knife Box #1"),
  make("Chroma Slasher",          38, 1,  2,    -4, "Knife Box #4"),
  make("Chroma Fang",             35, 1,  2,    -3, "Knife Box #2"),
  make("Chroma Shark",            35, 1,  2,    -5, "Gun Box #2"),
  make("Chroma Gemstone",         32, 1,  2,    -3, "Mystery Crate #1"),
  make("C. Gingerblade",          32, 1,  2,    -1, "Xmas 2018 (Unboxed)"),
  make("Chroma Heat",             32, 1,  2,    -3, "Rainbow Box"),
  make("Chroma Seer",             32, 1,  2,    -1, "Season 1 Crafting"),
  make("Chroma Saw",              30, 1,  2,    -3, "Knife Box #3"),
  make("Chroma Tides",            30, 1,  2,    -2, "Knife Box #5"),
  make("Chroma Boneblade",        27, 1,  2,    -1, "Hallows 2018 (Unboxed)"),
];
