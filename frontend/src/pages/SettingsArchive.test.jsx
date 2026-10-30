import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import SettingsPage from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
});

describe.each([
    ['addons', 'Add-on', 'Add-ons', { _id: 'addon-1', name: 'Extra Shot', price: 30, active: true }],
    ['discounts', 'Discount', 'Discounts', { _id: 'discount-1', name: 'Student', percentage: 10, scope: 'item', active: true }],
])('%s archive', (section, label, plural, item) => {
    const endpoint = `http://localhost:5000/api/${section}`;

    test('archives only after confirmation, then restores the retained record', async () => {
        let record = { ...item };
        axios.get.mockImplementation(url => Promise.resolve({ data: { data:
            record.active === !url.includes('archived=true') ? [{ ...record }] : [],
        } }));
        axios.delete.mockImplementation(async () => {
            record = { ...record, active: false, archivedAt: '2026-10-28T00:00:00Z' };
            return { data: { success: true } };
        });
        axios.post.mockImplementation(async () => {
            record = { ...record, active: true, archivedAt: null };
            return { data: { success: true } };
        });
        render(<SettingsPage mode="products" initialSection={section} />);
        await screen.findByText(item.name);
        expect(screen.queryByRole('button', { name: /delete|^del$/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
        let dialog = screen.getByRole('dialog', { name: `Archive ${label}` });
        expect(dialog).toHaveTextContent('can be restored later');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(axios.delete).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
        dialog = screen.getByRole('dialog', { name: `Archive ${label}` });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
        await screen.findByText(`${label} archived.`);
        expect(axios.delete).toHaveBeenCalledWith(`${endpoint}/${item._id}`);
        await waitFor(() => expect(screen.queryByText(item.name)).not.toBeInTheDocument());
        expect(screen.queryByRole('button', { name: `Save ${label}` })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'View Archive' }));
        await screen.findByText(item.name);
        expect(axios.get).toHaveBeenCalledWith(`${endpoint}?archived=true`);
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
        await screen.findByText(`${label} restored.`);
        expect(axios.post).toHaveBeenCalledWith(`${endpoint}/${item._id}/restore`);
        await screen.findByText(`No archived ${plural.toLowerCase()}.`);

        fireEvent.click(screen.getByRole('button', { name: `Active ${plural}` }));
        await screen.findByText(item.name);
        expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    });

    test('failed restoration keeps the archived record and displays the error', async () => {
        axios.get.mockImplementation(url => Promise.resolve({ data: { data: url.includes('archived=true')
            ? [{ ...item, active: false }] : [],
        } }));
        axios.post.mockRejectedValue({ response: { data: { message: 'Could not restore this record.' } } });
        render(<SettingsPage mode="products" initialSection={section} />);
        fireEvent.click(screen.getByRole('button', { name: 'View Archive' }));
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
        await screen.findByText('Could not restore this record.');
        expect(screen.getByText(item.name)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    });

    test('restoration refreshes the current view when the user switches while it is pending', async () => {
        let record = { ...item, active: false };
        let finishRestore;
        axios.get.mockImplementation(url => Promise.resolve({ data: { data:
            record.active === !url.includes('archived=true') ? [{ ...record }] : [],
        } }));
        axios.post.mockImplementation(() => new Promise(resolve => {
            finishRestore = () => {
                record = { ...record, active: true };
                resolve({ data: { success: true } });
            };
        }));
        render(<SettingsPage mode="products" initialSection={section} />);
        fireEvent.click(screen.getByRole('button', { name: 'View Archive' }));
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
        fireEvent.click(screen.getByRole('button', { name: `Active ${plural}` }));
        await screen.findByText(`No ${plural.toLowerCase()} yet.`);
        await act(async () => finishRestore());
        await screen.findByText(item.name);
        expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
        expect(axios.get).toHaveBeenLastCalledWith(endpoint);
    });

    test('a late archive response cannot overwrite the active view', async () => {
        let resolveArchive;
        axios.get.mockImplementation(url => url.includes('archived=true')
            ? new Promise(resolve => { resolveArchive = resolve; })
            : Promise.resolve({ data: { data: [item] } }));
        render(<SettingsPage mode="products" initialSection={section} />);
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole('button', { name: 'View Archive' }));
        fireEvent.click(screen.getByRole('button', { name: `Active ${plural}` }));
        await screen.findByText(item.name);
        await act(async () => resolveArchive({ data: { data: [{ ...item, name: 'Old archived record', active: false }] } }));
        expect(screen.queryByText('Old archived record')).not.toBeInTheDocument();
        expect(screen.getByText(item.name)).toBeInTheDocument();
    });
});
