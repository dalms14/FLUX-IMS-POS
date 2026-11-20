import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Items from './Items';
import { startSession } from '../utils/session';
import { invalidateProductCatalog } from '../utils/productCatalog';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
jest.mock('../components/ReceiptViewModal', () => () => <div role="dialog" aria-label="Saved receipt" />);

const coffee = { _id: 'coffee', name: 'Coffee', category: 'Drinks', soloPrice: 100 };
const image = 'data:image/png;base64,test';
const stockRecipe = stock => ({ ingredients: [{
  inventoryId: { _id: 'beans', name: 'Beans', unit: 'g', stock }, unit: 'g', amountPerServing: 10,
}] });
const productReads = () => axios.get.mock.calls.filter(([url]) => url.includes('/products'));
const openPage = () => render(<Items />);
let now;

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  now = 1800000000000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  startSession({ email: 'cashier@example.com', role: 'owner' });
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/products') ? [coffee]
    : url.endsWith('/recipe') ? { recipe: stockRecipe(100) }
      : url.endsWith('/discounts') ? { data: [] } : { ...coffee, image },
  }));
});

afterEach(() => jest.restoreAllMocks());
const ready = async () => {
  await screen.findByText('Coffee');
  await waitFor(() => expect(screen.getByRole('img', { name: 'Coffee' })).toHaveAttribute('src', image));
};

test('returning immediately reuses products, availability, categories and images without repeating product requests', async () => {
  const view = openPage();
  await ready();
  expect(productReads()).toHaveLength(3);
  view.unmount();
  openPage();
  expect(screen.getByText('Coffee')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drinks' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Coffee' })).toHaveAttribute('src', image);
  expect(screen.queryByText('Preparing menu...')).not.toBeInTheDocument();
  await waitFor(() => expect(productReads()).toHaveLength(3));
});

test('an expired cache remains visible while stock and prices refresh without changing an order being entered', async () => {
  const view = openPage();
  await ready();
  view.unmount();
  now += 30001;
  let finish;
  axios.get.mockImplementation(url => url.endsWith('/products')
    ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve({ data: url.endsWith('/recipe') ? { recipe: stockRecipe(0) } : { ...coffee, image } }));
  openPage();
  expect(screen.getByText('Coffee')).toBeInTheDocument();
  expect(screen.queryByText('Preparing menu...')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Drinks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add', exact: true }));
  await act(async () => finish({ data: [{ ...coffee, soloPrice: 120 }] }));
  expect(screen.getByRole('button', { name: 'Unavailable' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Drinks' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('fluxCashierSession')).cart[0]).toMatchObject({ quantity: 1, price: 100 });
});

test('a failed recipe refresh retains cached availability and offers a retry', async () => {
  const view = openPage();
  await ready();
  view.unmount();
  now += 30001;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  axios.get.mockImplementation(url => url.endsWith('/recipe') ? Promise.reject(new Error('Network down'))
    : Promise.resolve({ data: url.endsWith('/products') ? [coffee] : { ...coffee, image } }));
  openPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Prices and availability may be outdated.');
  expect(screen.getByText('Coffee')).toBeInTheDocument();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/products') ? [coffee]
    : { recipe: stockRecipe(0) } }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('button', { name: 'Unavailable' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('product changes invalidate the POS catalog and images before the next visit', async () => {
  const view = openPage();
  await ready();
  view.unmount();
  invalidateProductCatalog();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/products') ? [] : { data: [] } }));
  openPage();
  expect(screen.queryByText('Coffee')).not.toBeInTheDocument();
  await screen.findByText('No products found.');
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/products'))).toHaveLength(2);
});

test('a successful sale refreshes availability immediately even with a fresh cached menu', async () => {
  openPage();
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Add', exact: true }));
  await screen.findByText('1x Coffee');
  axios.post.mockResolvedValue({ data: { success: true, receiptNo: 'FLX-CACHED' } });
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/products') ? [coffee]
    : url.endsWith('/recipe') ? { recipe: stockRecipe(0) } : { ...coffee, image } }));
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await screen.findByRole('dialog', { name: 'Saved receipt' });
  await screen.findByRole('button', { name: 'Unavailable' });
  expect(screen.getByText('No items added yet.')).toBeInTheDocument();
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/products'))).toHaveLength(2);
});

test('StrictMode and navigation during loading share the pending menu and recipe requests', async () => {
  let finish;
  axios.get.mockImplementation(url => url.endsWith('/products') ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve({ data: url.endsWith('/recipe') ? { recipe: null } : { ...coffee, image } }));
  const view = render(<React.StrictMode><Items /></React.StrictMode>);
  view.unmount();
  openPage();
  await act(async () => finish({ data: [coffee] }));
  await ready();
  expect(productReads()).toHaveLength(3);
});

test('a new login cannot reuse the previous session menu or image cache', async () => {
  const view = openPage();
  await ready();
  view.unmount();
  startSession({ email: 'other@example.com', role: 'owner' });
  axios.get.mockResolvedValue({ data: [] });
  openPage();
  expect(screen.queryByText('Coffee')).not.toBeInTheDocument();
  await screen.findByText('No products found.');
  expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/products'))).toHaveLength(2);
});
