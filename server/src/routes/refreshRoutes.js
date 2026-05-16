const express = require("express");
const marketService = require("../services/marketService");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const data = await marketService.refreshMarketData();

    res.json({
      message: "Market data refreshed",
      refreshedAt: data.refreshedAt,
      itemCount: data.items.length,
      items: data.items
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router
