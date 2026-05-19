const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "currency.json");

const VALID_CURRENCIES = ["EUR", "USD", "GBP"];

const PRIMARY_MARKETPLACE = {
  EUR: "EBAY_BE",
  USD: "EBAY_US",
  GBP: "EBAY_GB"
};

const SET_MARKETPLACES = {
  EUR: ["EBAY_DE", "EBAY_BE", "EBAY_NL", "EBAY_ES", "EBAY_IT"],
  USD: ["EBAY_US"],
  GBP: ["EBAY_GB"]
};

function readCurrency() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const { currency } = JSON.parse(raw);
    return VALID_CURRENCIES.includes(currency) ? currency : "EUR";
  } catch {
    return "EUR";
  }
}

function writeCurrency(currency) {
  fs.writeFileSync(FILE, JSON.stringify({ currency }), "utf8");
}

module.exports = {
  readCurrency,
  writeCurrency,
  VALID_CURRENCIES,
  PRIMARY_MARKETPLACE,
  SET_MARKETPLACES
};
