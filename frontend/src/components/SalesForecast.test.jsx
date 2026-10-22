import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import SalesForecast from './SalesForecast';

jest.mock('axios');
const row = (date, sales = 5000) => ({ date, sales, closed: false });
const sample = {
  status: 'ready', source: 'demo', tomorrow: 5000, total: 35000, historyDays: 28,
  trainedThrough: '2026-10-22',
  history: [row('2026-10-20'), row('2026-10-21'), row('2026-10-22')],
  forecast: Array.from({ length: 7 }, (_, i) => row(`2026-10-${23 + i}`)),
};
beforeEach(() => jest.resetAllMocks());

test('clearly labels sample forecasts and provides an accessible daily breakdown', async () => {
  axios.get.mockResolvedValue({ data: sample });
  render(<SalesForecast />);
  expect(await screen.findByRole('list', { name: 'Daily sales estimates' })).toBeInTheDocument();
  expect(screen.getByText('SAMPLE DATA')).toBeInTheDocument();
  expect(screen.getByText(/not Eli Coffee sales/)).toBeInTheDocument();
  expect(screen.getByText('Tomorrow (sample)')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(7);
  expect(screen.getByText(/Monday uses the last four Mondays/)).toBeInTheDocument();
  expect(screen.queryByText(/Historical prediction error/)).not.toBeInTheDocument();
  expect(axios.get.mock.calls[0][0]).toBe('http://localhost:5000/api/sales-forecast?source=demo');
});

test('real mode shows readiness without relabeling sample figures as client forecasts', async () => {
  axios.get.mockResolvedValueOnce({ data: sample }).mockResolvedValueOnce({ data: {
    source: 'real', status: 'awaiting-real-sales', message: 'Real sales forecasting is not enabled yet.',
  } });
  render(<SalesForecast />);
  await screen.findByRole('list', { name: 'Daily sales estimates' });
  fireEvent.click(screen.getByRole('button', { name: 'Real sales' }));
  expect(screen.queryByText('Tomorrow (sample)')).not.toBeInTheDocument();
  expect(await screen.findByText('Real sales forecasting is not enabled yet.')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(axios.get.mock.calls[1][0]).toContain('source=real');
});

test('supports retrying a failed request', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: sample });
  render(<SalesForecast />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('list', { name: 'Daily sales estimates' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a slow sample request cannot overwrite a later real-mode response', async () => {
  let resolveSample;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveSample = resolve; }))
    .mockResolvedValueOnce({ data: { source: 'real', status: 'insufficient-history', historyDays: 12, minimumHistoryDays: 28 } });
  render(<SalesForecast />);
  fireEvent.click(screen.getByRole('button', { name: 'Real sales' }));
  await screen.findByText('More sales history needed');
  await act(async () => { resolveSample({ data: sample }); });
  await waitFor(() => expect(screen.getByText(/12 of 28 completed days/)).toBeInTheDocument());
  expect(screen.queryByRole('list', { name: 'Daily sales estimates' })).not.toBeInTheDocument();
});
