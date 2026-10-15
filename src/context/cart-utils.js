// Prices in the store data are display strings like "$4.99" — pull the
// numeric value out so the cart can total things up.
export function parsePrice(price) {
  if (typeof price === "number") return price;
  const num = parseFloat(String(price).replace(/[^0-9.]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}
