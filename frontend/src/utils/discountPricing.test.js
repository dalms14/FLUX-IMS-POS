import { calculateDiscount } from './discountPricing';

test('discounts keep their existing rounding when VAT removal is off or absent', () => {
  expect(calculateDiscount(289, { percentage: 20 })).toEqual({ vatRemoved: 0, percentageDiscount: 58, discount: 58 });
  expect(calculateDiscount(112, null).discount).toBe(0);
});

test('VAT is extracted before the percentage discount and savings include both amounts', () => {
  expect(calculateDiscount(112, { percentage: 20, vatExempt: true })).toEqual({ vatRemoved: 12, percentageDiscount: 20, discount: 32 });
  expect(calculateDiscount(112, { percentage: 0, vatExempt: true }).discount).toBe(12);
  expect(calculateDiscount(112.67, { percentage: 100, vatExempt: true }).discount).toBe(112.67);
});
