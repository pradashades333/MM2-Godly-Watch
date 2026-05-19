const CURRENCY_LOCALE = {
  EUR: "de-DE",
  USD: "en-US",
  GBP: "en-GB"
};

export function formatCurrency(value, currency = "EUR") {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }

  const locale = CURRENCY_LOCALE[currency] || "de-DE";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}
