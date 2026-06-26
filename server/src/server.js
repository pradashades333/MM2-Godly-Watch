require("dotenv").config();

const app = require("./app");
const { buildMarketData } = require("./services/marketService");
const adoptMeService = require("./services/adoptMeService");
const growAGardenService = require("./services/growAGardenService");

const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const EBAY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

let lastEbayRefreshAt = 0;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleAutoRefresh();
});

async function runRefresh() {
  const refreshEbay = Date.now() - lastEbayRefreshAt >= EBAY_REFRESH_INTERVAL_MS;
  console.log(`[auto-refresh] starting at ${new Date().toISOString()} | ebay: ${refreshEbay}`);

  try {
    await buildMarketData({ refreshEbay });
    if (refreshEbay) lastEbayRefreshAt = Date.now();
    console.log(`[auto-refresh] mm2 done`);
  } catch (err) {
    console.error("[auto-refresh] mm2 failed:", err.message);
  }

  try {
    await adoptMeService.refreshMarketData();
    console.log(`[auto-refresh] adoptme done`);
  } catch (err) {
    console.error("[auto-refresh] adoptme failed:", err.message);
  }

  try {
    await growAGardenService.refreshMarketData();
    console.log(`[auto-refresh] growagarden done`);
  } catch (err) {
    console.error("[auto-refresh] growagarden failed:", err.message);
  }

  console.log(`[auto-refresh] all games done at ${new Date().toISOString()}`);
}

function scheduleAutoRefresh() {
  runRefresh();
  setInterval(runRefresh, REFRESH_INTERVAL_MS);
  console.log(`[auto-refresh] scheduled every ${REFRESH_INTERVAL_MS / 60000} min, eBay every 24h`);
}
