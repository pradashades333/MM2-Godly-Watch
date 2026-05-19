const express = require("express");
const { readCurrency, writeCurrency, VALID_CURRENCIES } = require("../config/currencySettings");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ currency: readCurrency(), availableCurrencies: VALID_CURRENCIES });
});

router.post("/", (req, res) => {
  const { currency } = req.body;

  if (!VALID_CURRENCIES.includes(currency)) {
    return res.status(400).json({ message: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(", ")}` });
  }

  writeCurrency(currency);
  res.json({ currency });
});

module.exports = router;
