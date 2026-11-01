import { allocateDiscountUnits } from './discountAllocation';

const cart = [
  { cartKey: 'coffee', price: 100, quantity: 4 },
  { cartKey: 'cake', price: 200, quantity: 2 },
  { cartKey: 'meal', price: 300, quantity: 1 },
];

test('two people discount the two highest-priced units, not two entire cart lines', () => {
  expect(allocateDiscountUnits(cart, 2)).toEqual({ meal: 1, cake: 1 });
  expect(cart[0].cartKey).toBe('coffee');
});

test('counts repeated units and caps the selection at the quantity available', () => {
  expect(allocateDiscountUnits(cart, 3)).toEqual({ meal: 1, cake: 2 });
  expect(allocateDiscountUnits(cart, 20)).toEqual({ meal: 1, cake: 2, coffee: 4 });
  expect(allocateDiscountUnits(cart, 0)).toEqual({});
});

test('reallocates when a higher-priced item is removed or a quantity changes', () => {
  expect(allocateDiscountUnits(cart.slice(0, 2), 2)).toEqual({ cake: 2 });
  expect(allocateDiscountUnits([{ ...cart[1], quantity: 1 }, cart[0]], 2)).toEqual({ cake: 1, coffee: 1 });
});
