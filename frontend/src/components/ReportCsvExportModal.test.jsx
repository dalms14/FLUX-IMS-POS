import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ReportCsvExportModal from './ReportCsvExportModal';

jest.mock('axios');
const props = { initialType: 'sales_transactions', initialStart: '2026-10-03', initialEnd: '2026-10-03', loginRole: 'all', onClose: jest.fn(), onDownload: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { data: [] } }); });

test('switching to a date range exposes both dates and blocks a reversed range with an inline message', async () => {
  render(<ReportCsvExportModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Date range' }));
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-10-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  expect(screen.getByRole('alert')).toHaveTextContent('on or after');
  expect(axios.get).not.toHaveBeenCalled();
  expect(props.onDownload).not.toHaveBeenCalled();
});
test('changing the date clears the preview and forces fresh records on download', async () => {
  render(<ReportCsvExportModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview report' }));
  await screen.findByRole('region', { name: 'CSV preview' });
  fireEvent.change(screen.getByLabelText('Report date'), { target: { value: '2026-10-04' } });
  expect(screen.queryByRole('region', { name: 'CSV preview' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(props.onDownload).toHaveBeenCalledWith(expect.objectContaining({ filename: 'flux-sales-transactions-2026-10-04.csv' })));
  expect(axios.get).toHaveBeenCalledTimes(2);
});
test('request failures remain visible and never download stale data', async () => {
  axios.get.mockRejectedValue({ response: { data: { message: 'Report service unavailable.' } } });
  render(<ReportCsvExportModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Report service unavailable');
  expect(props.onDownload).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
});
