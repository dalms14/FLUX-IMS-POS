import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SalesPage from './SalesPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
jest.mock('../components/SalesForecast', () => () => null);
jest.mock('../components/PageHeader', () => props => <header>{props.title}{props.actions}</header>);
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/sales');
  axios.get.mockResolvedValue({ data: [] });
});
afterEach(() => {
  window.history.replaceState({}, '', '/');
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  jest.useRealTimers();
});

test('dashboard revenue link applies its date range as a full Philippine day to sales and refunds', async () => {
  window.history.replaceState({}, '', '/sales?startDate=2026-11-07&endDate=2026-11-07');
  render(<SalesPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  expect(screen.getByLabelText('Start Date')).toHaveValue('2026-11-07');
  expect(screen.getByLabelText('End Date')).toHaveValue('2026-11-07');
  for (const [url] of axios.get.mock.calls) {
    const params = new URL(url).searchParams;
    expect(params.get('startDate')).toBe('2026-11-07T00:00:00+08:00');
    expect(params.get('endDate')).toBe('2026-11-07T23:59:59.999+08:00');
  }
});

test('Items Sold link scrolls and moves keyboard focus to Product Sales once data loads', async () => {
  const scroll = jest.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  window.history.replaceState({}, '', '/sales?startDate=2026-11-07&endDate=2026-11-07#product-sales');
  render(<SalesPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  const target = screen.getByLabelText('Product Sales breakdown');
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll.mock.instances[0]).toBe(target);
  expect(target).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(4));
  expect(scroll).toHaveBeenCalledTimes(1);
});

test('Today uses the Philippine date after UTC midnight boundaries and invalid URL dates fall back to today', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-06T18:00:00Z'));
  window.history.replaceState({}, '', '/sales?startDate=2026-02-30&endDate=invalid');
  render(<SalesPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  expect(screen.getByLabelText('Start Date')).toHaveValue('2026-11-07');
  expect(screen.getByLabelText('End Date')).toHaveValue('2026-11-07');
});

test('blocks reversed dates including typed values, and recovers when corrected', async () => {
  render(<SalesPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'All Time' }));
  fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-11' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  const before = axios.get.mock.calls.length;
  fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-11-03' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Start date must be on or before end date');
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  expect(axios.get).toHaveBeenCalledTimes(before);
  expect(screen.getByLabelText('End Date')).toHaveAttribute('min', '2026-11-11');
  fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-11-11' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  const params = new URL(axios.get.mock.calls.at(-1)[0]).searchParams;
  expect(params.get('startDate')).toBe('2026-11-11T00:00:00+08:00');
  expect(params.get('endDate')).toBe('2026-11-11T23:59:59.999+08:00');
  fireEvent.click(screen.getByRole('button', { name: 'All Time' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  expect(screen.getByLabelText('End Date')).not.toHaveAttribute('min');
});
