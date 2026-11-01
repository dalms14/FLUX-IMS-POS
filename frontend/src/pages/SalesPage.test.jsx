import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import SalesPage from './SalesPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
jest.mock('../components/SalesForecast', () => () => null);
jest.mock('../components/PageHeader', () => props => <header>{props.title}{props.actions}</header>);
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: [] }); });

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
  expect(axios.get.mock.calls.at(-1)[0]).toContain('startDate=2026-11-11&endDate=2026-11-11');
  fireEvent.click(screen.getByRole('button', { name: 'All Time' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled());
  expect(screen.getByLabelText('End Date')).not.toHaveAttribute('min');
});
