/** Format Shopify cents as a localized currency string. */
export function formatMoney(cents, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
