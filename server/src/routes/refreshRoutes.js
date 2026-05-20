const express = require("express");
const marketService = require("../services/marketService");

const router = express.Router();

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
let lastRefreshAt = null;
let refreshInProgress = false;

router.post("/", async (req, res, next) => {
  if (refreshInProgress) {
    return res.status(429).json({ message: "Refresh already in progress. Please wait." });
  }

  if (lastRefreshAt && Date.now() - lastRefreshAt < COOLDOWN_MS) {
    const secondsLeft = Math.ceil((COOLDOWN_MS - (Date.now() - lastRefreshAt)) / 1000);
    const minutesLeft = Math.ceil(secondsLeft / 60);
    return res.status(429).json({ message: `Refresh available in ${minutesLeft} min.` });
  }

  try {
    refreshInProgress = true;
    const data = await marketService.refreshMarketData();
    lastRefreshAt = Date.now();

    res.json({
      message: "Market data refreshed",
      refreshedAt: data.refreshedAt,
      itemCount: data.items.length,
      items: data.items
    });
  } catch (err) {
    next(err);
  } finally {
    refreshInProgress = false;
  }
});

module.exports = router;
