import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import IngredientDemandForecast from './IngredientDemandForecast';

jest.mock('axios');
const result = {
  source: 'demo', status: 'ready', from: '2026-11-11', through: '2026-11-17',
  ingredients: [
    { inventoryId: 'milk', name: 'Sample Milk', unit: 'ml', estimatedDemand: 1400, availableStock: 1000, shortfall: 400, expiringUnused: 100 },
    { inventoryId: 'beans', name: 'Sample Beans', unit: 'g', estimatedDemand: 200, availableStock: 500, shortfall: 0, expiringUnused: 0 },
  ], products: [{ productId: 'latte', name: 'Sample Latte', quantity: 14 }],
};
beforeEach(() => jest.resetAllMocks());

test('shows ingredient units, usable stock and shortages, with explicit demo labeling', async () => {
  axios.get.mockResolvedValue({ data: result });
  render(<IngredientDemandForecast source="demo" refresh={0} />);
  const region = await screen.findByRole('region', { name: 'Seven-day ingredient demand estimates' });
  const milk = within(region).getByRole('row', { name: /Sample Milk/ });
  expect(milk).toHaveTextContent('1,400 ml');
  expect(milk).toHaveTextContent('1,000 ml');
  expect(milk).toHaveTextContent('400 ml');
  expect(milk).toHaveTextContent('Restock');
  expect(milk).toHaveTextContent('Some stock expires before use');
  expect(screen.getByText('Covered')).toBeInTheDocument();
  expect(screen.getByText(/Sample products, recipes and stock only/)).toBeInTheDocument();
  expect(screen.getByText(/Sample Latte: about 14 servings/)).toBeInTheDocument();
  expect(axios.get.mock.calls[0][0]).toBe('http://localhost:5000/api/sales-forecast/ingredient-demand?source=demo');
});

test('missing mappings show actionable issues without partial stock recommendations', async () => {
  axios.get.mockResolvedValue({ data: { source: 'real', status: 'needs-review', ingredients: [], issues: [{ name: 'Latte', message: 'Configure an ingredient recipe for this product.' }] } });
  render(<IngredientDemandForecast source="real" refresh={0} />);
  expect(await screen.findByText('Review sales and recipe mappings')).toBeInTheDocument();
  expect(screen.getByText('Configure an ingredient recipe for this product.')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText(/Sample products/)).not.toBeInTheDocument();
});

test('real sales readiness explains unavailable estimates without showing sample figures', async () => {
  axios.get.mockResolvedValue({ data: { source: 'real', status: 'insufficient-history', message: 'Ingredient estimates need at least 42 completed days of verified product sales.' } });
  render(<IngredientDemandForecast source="real" refresh={0} />);
  expect(await screen.findByText(/42 completed days/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('ingredient estimates have their own retry when loading fails', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: result });
  render(<IngredientDemandForecast source="demo" refresh={0} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Ingredient estimates could not be loaded');
  fireEvent.click(screen.getByRole('button', { name: 'Retry ingredient estimates' }));
  expect(await screen.findByRole('table')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('switching to real data clears sample stock and ignores late sample responses', async () => {
  let resolveDemo;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveDemo = resolve; }))
    .mockResolvedValueOnce({ data: { ...result, source: 'real', ingredients: [{ ...result.ingredients[0], name: 'Client Milk' }] } });
  const { rerender } = render(<IngredientDemandForecast source="demo" refresh={0} />);
  rerender(<IngredientDemandForecast source="real" refresh={0} />);
  await screen.findByText('Client Milk');
  await act(async () => { resolveDemo({ data: result }); });
  expect(screen.queryByText('Sample Milk')).not.toBeInTheDocument();
  expect(screen.getByText('Client Milk')).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent(/^Ingredient Demand$/);
});

test('refresh reloads estimates and clears previously displayed stock', async () => {
  axios.get.mockResolvedValueOnce({ data: result }).mockImplementationOnce(() => new Promise(() => {}));
  const { rerender } = render(<IngredientDemandForecast source="demo" refresh={0} />);
  await screen.findByRole('table');
  rerender(<IngredientDemandForecast source="demo" refresh={1} />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText('Estimating ingredient needs...')).toBeInTheDocument();
});
