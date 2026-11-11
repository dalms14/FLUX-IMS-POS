import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import SettingsPage from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  axios.get.mockResolvedValue({ data: { data: [] } });
  axios.post.mockResolvedValue({ data: { success: true } });
  axios.put.mockResolvedValue({ data: { success: true } });
});

test('VAT remover is opt-in, saves with a discount, and resets after creation', async () => {
  render(<SettingsPage mode="products" initialSection="discounts" />);
  await screen.findByText('No discounts yet.');
  const toggle = screen.getByRole('switch', { name: 'VAT remover' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.change(screen.getByLabelText('Discount name'), { target: { value: 'Senior offer' } });
  fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '20' } });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Add Discount' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/discounts', { name: 'Senior offer', percentage: 20, scope: 'item', vatExempt: true }));
  await screen.findByText('Discount added.');
  expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('editing loads the saved VAT choice and can turn it off', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ _id: 'senior', name: 'Senior offer', percentage: 20, scope: 'item', vatExempt: true }] } });
  render(<SettingsPage mode="products" initialSection="discounts" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  const toggle = screen.getByRole('switch', { name: 'VAT remover' });
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Save Discount' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith('http://localhost:5000/api/discounts/senior', { name: 'Senior offer', percentage: 20, scope: 'item', vatExempt: false }));
});
