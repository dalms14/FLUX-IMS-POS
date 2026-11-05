import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SettingsPage from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/categories') ? [{ _id: 'drinks', name: 'Drinks' }] : url.endsWith('/addons') ? { data: [] } : [] }));
});
afterEach(() => jest.restoreAllMocks());
const openForm = async () => {
  render(<SettingsPage mode="products" />);
  fireEvent.click(await screen.findByRole('button', { name: /\+ Add Product/ }));
  await waitFor(() => expect(screen.queryByText('Loading ingredients...')).not.toBeInTheDocument());
};
const fillForm = () => {
  fireEvent.change(screen.getByPlaceholderText('e.g. Chicken Alaking'), { target: { value: 'Coffee' } });
  fireEvent.change(screen.getByRole('option', { name: 'Select category...' }).parentElement, { target: { value: 'Drinks' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 325'), { target: { value: '100' } });
};

test('missing product details show a dismissible on-screen notice without a browser alert or losing input', async () => {
  await openForm();
  fireEvent.change(screen.getByPlaceholderText('e.g. Chicken Alaking'), { target: { value: 'Coffee' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please fill in Name, Category and Solo Price.');
  expect(window.alert).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('e.g. Chicken Alaking')).toHaveValue('Coffee');
});

test('product save failures display the server message and keep the form open for correction', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'A product with this name already exists.' } } });
  await openForm(); fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A product with this name already exists.');
  expect(window.alert).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('e.g. Chicken Alaking')).toHaveValue('Coffee');
  expect(screen.getByRole('button', { name: 'Add Product' })).toBeEnabled();
});

test('a successful product save closes the form and shows a success notice', async () => {
  axios.post.mockResolvedValue({ data: { product: { _id: 'coffee' } } });
  axios.put.mockResolvedValue({ data: { success: true } });
  await openForm(); fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Product added');
  await waitFor(() => expect(screen.queryByText('Add New Product')).not.toBeInTheDocument());
  expect(window.alert).not.toHaveBeenCalled();
});
