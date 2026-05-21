require("dotenv").config();

const app = require("./app");
const { buildMarketData } = require("./services/marketService");

const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleAutoRefresh();
});

async function runRefresh() {
  console.log(`[auto-refresh] starting at ${new Date().toISOString()}`);
  try {
    await buildMarketData();
    console.log(`[auto-refresh] done at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[auto-refresh] failed:", err.message);
  }
}

function scheduleAutoRefresh() {
  // Run immediately on startup, then every hour
  runRefresh();
  setInterval(runRefresh, REFRESH_INTERVAL_MS);
  console.log(`[auto-refresh] scheduled every ${REFRESH_INTERVAL_MS / 60000} min`);
}