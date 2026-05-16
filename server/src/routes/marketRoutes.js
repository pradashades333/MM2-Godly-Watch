const express = require("express");
const marketService = require("../services/marketService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await marketService.getMarketData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/items", async (req, res, next) => {
  try {
    const data = await marketService.getMarketItems()
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/items/:id", async (req, res, next) => {
  try {
    const data = await marketService.getMarketItemById(req.params.id)
    res.json(data);

    if (!item) {
        return res.status(404).json({ message: "Item not found" });
    }

  } catch (err) {
    next(err);
  }
});

router.get("/recentmoves", async (req, res, next) => {
  try {
    const data = await marketService.getRecentMoves();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const data = await marketService.getStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
