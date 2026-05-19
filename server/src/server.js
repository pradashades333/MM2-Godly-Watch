require("dotenv").config();

const app = require("./app");
const { buildMarketData } = require("./services/marketService");

const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleAutoRefresh();
});

function scheduleAutoRefresh() {
  setInterval(async () => {
    console.log(`[auto-refresh] starting at ${new Date().toISOString()}`);
    try {
      await buildMarketData();
      console.log(`[auto-refresh] done at ${new Date().toISOString()}`);
    } catch (err) {
      console.error("[auto-refresh] failed:", err.message);
    }
  }, REFRESH_INTERVAL_MS);

  console.log(`[auto-refresh] scheduled every ${REFRESH_INTERVAL_MS / 60000} min`);
}