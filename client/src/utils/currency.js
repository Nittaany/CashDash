/**
 * Convert decimal string/number to minor units (cents/paisa)
 * Uses string math to avoid floating point drift
 * @param {string|number} input - Decimal input (e.g., "100.50")
 * @returns {number|null} Integer minor units or null if invalid
 */
export function toMinorUnits(input) {
  if (input === null || input === undefined || input === "") return null;

  const str = String(input).trim();
  if (!/^-?\d+(\.\d{0,2})?$/.test(str)) return null;

  const isNegative = str.startsWith("-");
  const absStr = isNegative ? str.slice(1) : str;

  const parts = absStr.split(".");
  const whole = parts[0] || "0";
  let decimal = parts[1] || "0";

  // Pad or truncate decimal to exactly 2 digits
  decimal = decimal.padEnd(2, "0").slice(0, 2);

  const minorUnits = parseInt(whole, 10) * 100 + parseInt(decimal, 10);

  if (isNegative || minorUnits <= 0) return null;

  return minorUnits;
}

/**
 * Get locale for currency
 * @param {string} currency - Currency code
 * @returns {string} Locale string
 */
function getLocaleForCurrency(currency) {
  switch (currency) {
    case "INR":
    case "NPR":
      return "en-IN";
    case "USD":
      return "en-US";
    default:
      return "en-IN";
  }
}

/**
 * Format minor units to display string
 * @param {number} amountMinor - Amount in minor units
 * @param {string} currency - Currency code (NPR, INR, USD)
 * @returns {string} Formatted string
 */
export function formatMoney(amountMinor, currency = "NPR") {
  if (typeof amountMinor !== "number" || isNaN(amountMinor)) {
    return `${currency} 0.00`;
  }

  const absAmount = Math.abs(amountMinor);
  const whole = Math.floor(absAmount / 100);
  const decimal = (absAmount % 100).toString().padStart(2, "0");

  const locale = getLocaleForCurrency(currency);
  const formatted = whole.toLocaleString(locale);
  const sign = amountMinor < 0 ? "-" : "";

  return `${currency} ${sign}${formatted}.${decimal}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency) {
  const symbols = {
    NPR: "रू",
    INR: "₹",
    USD: "$"
  };
  return symbols[currency] || currency;
}
