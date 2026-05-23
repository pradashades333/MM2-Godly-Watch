const cheerio = require("cheerio");

async function scrapeAncients() {
  try {
    const response = await fetch("https://supremevalues.com/mm2/ancients");
    const html = await response.text();
    const $ = cheerio.load(html);

    const data = [];
    const lastUpdated =
      /Values Last Updated\s*-\s*([A-Za-z]+\s+\d+(?:st|nd|rd|th),\s+\d{4})/i.exec(html)?.[1] ?? null;

    $(".itembody").each((i, el) => {
      const block = $(el);
      const wrapper = block.parent();
      const fullText = wrapper.text().replace(/\s+/g, " ").trim();

      const name = wrapper.find(".itemhead").first().text().trim();
      const rawValue = block.find(".itemvalue").first().text().trim();
      const rawRange = block.find(".itemrange").first().text().trim();
      const stability = block.find(".itemstability").first().text().trim();
      const origin = block.find(".itemorigin").first().text().trim();

      const demandMatch = fullText.match(/Demand\s*-\s*(\d+)/i);
      const rarityMatch = fullText.match(/Rarity\s*-\s*(\d+)/i);
      const changeMatch = fullText.match(/Last Change in Value\s*-\s*\(([+-]?\d+)\)/i);

      const value = parseNumber(rawValue);
      const range = rawRange && rawRange.toUpperCase() !== "N/A" ? rawRange : null;
      const demand = demandMatch ? Number(demandMatch[1]) : null;
      const rarity = rarityMatch ? Number(rarityMatch[1]) : null;
      const lastChange = changeMatch ? Number(changeMatch[1]) : null;

      if (!name || value == null) {
        return;
      }

      data.push({
        id: slugify(name),
        name,
        category: "ancients",
        current: {
          supreme: {
            value,
            range,
            demand,
            rarity,
            stability: stability || null,
            lastChange,
            lastUpdated,
            origin: origin || null,
            pageUrl: "https://supremevalues.com/mm2/ancients"
          }
        },
        lastCheckedAt: new Date().toISOString(),
        history: []
      });
    });

    return data;
  } catch (err) {
    console.error("scrapeAncients failed", err);
    return [];
  }
}

function parseNumber(value) {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  scrapeAncients
};
