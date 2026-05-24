require("dotenv").config();

const app = require("./app");
const { buildMarketData } = require("./services/marketService");

const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;           // supreme values: every 1 hour
const EBAY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // ebay prices: once per 24 hours

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
    console.log(`[auto-refresh] done at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[auto-refresh] failed:", err.message);
  }
}

function scheduleAutoRefresh() {
  runRefresh();
  setInterval(runRefresh, REFRESH_INTERVAL_MS);
  console.log(`[auto-refresh] scheduled every ${REFRESH_INTERVAL_MS / 60000} min, eBay every 24h`);
}
