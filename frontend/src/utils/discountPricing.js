const money = value => Math.round(value * 100) / 100;

// VAT-inclusive prices: remove VAT only from the eligible discount base.
// Preserve the existing whole-peso percentage discount rounding.
export function calculateDiscount(base, discount) {
  const vatRemoved = discount?.vatExempt === true ? money(base - base / 1.12) : 0;
  const eligibleBase = discount?.vatExempt === true ? money(base - vatRemoved) : base;
  const roundedDiscount = discount ? Math.round(eligibleBase * Number(discount.percentage || 0) / 100) : 0;
  const percentageDiscount = discount?.vatExempt === true ? Math.min(eligibleBase, roundedDiscount) : roundedDiscount;
  return { vatRemoved, percentageDiscount, discount: money(vatRemoved + percentageDiscount) };
}
