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

