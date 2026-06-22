const express = require("express");
const { getGame } = require("../config/games");

const router = express.Router();

function tagItem(item, gameId) {
  return { ...item, game: item.game ?? gameId };
}

function tagGame(value, gameId) {
  if (Array.isArray(value)) {
    return value.map((item) => tagItem(item, gameId));
  }
  if (value && typeof value === "object" && Array.isArray(value.items)) {
    return { ...value, items: value.items.map((item) => tagItem(item, gameId)) };
  }
  if (value && typeof value === "object") {
    return tagItem(value, gameId);
  }
  return value;
}

router.get("/", async (req, res, next) => {
  try {
    const { id: gameId, service } = getGame(req.query.game);
    const data = await service.getMarketData();
    res.json(tagGame(data, gameId));
  } catch (err) {
    next(err);
  }
});

router.get("/items", async (req, res, next) => {
  try {
    const { id: gameId, service } = getGame(req.query.game);
    const data = await service.getMarketItems();
    res.json(tagGame(data, gameId));
  } catch (err) {
    next(err);
  }
});

router.get("/items/:id", async (req, res, next) => {
  try {
    const { id: gameId, service } = getGame(req.query.game);
    const item = await service.getMarketItemById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(tagGame(item, gameId));
  } catch (err) {
    next(err);
  }
});

router.get("/recent-moves", async (req, res, next) => {
  try {
    const { service } = getGame(req.query.game);
    const data = await service.getRecentMoves();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const { service } = getGame(req.query.game);
    const data = await service.getStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
