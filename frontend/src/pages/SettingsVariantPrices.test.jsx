import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SettingsPage from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

test('variant price inputs reject excessive values, negatives and extra decimals while saving valid centavos', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/categories') ? [{ _id: 'drinks', name: 'Drinks' }] : url.endsWith('/addons') ? { data: [] } : [] }));
  axios.post.mockResolvedValue({ data: { product: { _id: 'coffee' } } });
  axios.put.mockResolvedValue({ data: { success: true } });
  render(<SettingsPage mode="products" />);
  fireEvent.click(await screen.findByRole('button', { name: /\+ Add Product/ }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Chicken Alaking'), { target: { value: 'Coffee' } });
  fireEvent.change(screen.getByRole('option', { name: 'Select category...' }).parentElement, { target: { value: 'Drinks' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 325'), { target: { value: '100' } });
  const input = screen.getByLabelText('Large price add-on');
  for (const value of ['10000', '999999999', '-1', '1e3', '12.345']) {
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue('30');
    expect(screen.getByRole('alert')).toHaveTextContent('9,999.99');
  }
  fireEvent.change(input, { target: { value: '9999.99' } });
  expect(input).toHaveValue('9999.99');
  fireEvent.change(input, { target: { value: '19.95' } });
  fireEvent.blur(input);
  expect(input).toHaveValue('19.95');
  await waitFor(() => expect(screen.getByRole('button', { name: '+ Add size or add-on recipe' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/products', expect.objectContaining({
    variantGroups: expect.arrayContaining([{ name: 'Size', options: ['Regular', 'Large'], optionPrices: [0, 19.95] }]),
  })));
});
