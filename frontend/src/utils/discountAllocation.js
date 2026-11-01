// One discounted unit per eligible diner, starting with the highest unit price.
export function allocateDiscountUnits(cart, people) {
  let remaining = Math.max(0, Math.floor(Number(people) || 0));
  const allocation = {};
  [...cart].sort((a, b) => Number(b.price) - Number(a.price)).forEach(item => {
    const quantity = Math.min(remaining, Math.max(0, Math.floor(Number(item.quantity) || 0)));
    if (quantity > 0) allocation[item.cartKey] = quantity;
    remaining -= quantity;
  });
  return allocation;
}
