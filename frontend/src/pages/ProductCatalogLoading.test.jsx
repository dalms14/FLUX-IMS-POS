import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import SettingsPage from './SettingsPage';
import { startSession } from '../utils/session';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

const coffee = { _id: 'coffee', name: 'Coffee', category: 'Drinks', soloPrice: 100 };
const catalogRequests = () => axios.get.mock.calls.filter(([url]) => url.includes('/products?'));
const openPage = () => render(<SettingsPage mode="products" />);
let now;

beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    now = 1800000000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    startSession({ email: 'owner@example.com', role: 'owner' });
    axios.get.mockImplementation(url => Promise.resolve({ data:
        url.includes('/products?') ? [coffee] : url.endsWith('/addons') ? { data: [] } : [],
    }));
});

afterEach(() => jest.restoreAllMocks());

test('returning to Products shows cached rows immediately without downloading the catalog again', async () => {
    const page = openPage();
    await screen.findByText('Coffee');
    page.unmount();
    openPage();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.queryByText('Loading products...')).not.toBeInTheDocument();
    await act(async () => {});
    expect(catalogRequests()).toHaveLength(1);
});

test('a stale catalog stays visible while a background request updates it', async () => {
    const page = openPage();
    await screen.findByText('Coffee');
    page.unmount();
    now += 30001;
    let finish;
    axios.get.mockImplementation(url => url.includes('/products?')
        ? new Promise(resolve => { finish = resolve; })
        : Promise.resolve({ data: [] }));
    openPage();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.queryByText('Loading products...')).not.toBeInTheDocument();
    expect(catalogRequests()).toHaveLength(2);
    await act(async () => finish({ data: [{ ...coffee, name: 'Updated Coffee' }] }));
    expect(screen.getByText('Updated Coffee')).toBeInTheDocument();
});

test('a failed background refresh keeps cached rows and lets the user retry', async () => {
    const page = openPage();
    await screen.findByText('Coffee');
    page.unmount();
    now += 30001;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValue(new Error('Network unavailable'));
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Displayed products may be outdated.');
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    axios.get.mockResolvedValue({ data: [{ ...coffee, name: 'Updated Coffee' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Updated Coffee');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('StrictMode and leaving during a request reuse the pending catalog request', async () => {
    let finish;
    axios.get.mockImplementation(url => url.includes('/products?')
        ? new Promise(resolve => { finish = resolve; })
        : Promise.resolve({ data: [] }));
    const page = render(<React.StrictMode><SettingsPage mode="products" /></React.StrictMode>);
    page.unmount();
    openPage();
    expect(catalogRequests()).toHaveLength(1);
    await act(async () => finish({ data: [coffee] }));
    expect(screen.getByText('Coffee')).toBeInTheDocument();
});

test('archiving and restoring invalidate both catalog views even within the freshness window', async () => {
    let archived = false;
    axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/products?')
        ? (url.includes('archived=true') === archived ? [{ ...coffee, archived }] : [])
        : [],
    }));
    axios.delete.mockImplementation(async () => { archived = true; return { data: {} }; });
    axios.post.mockImplementation(async () => { archived = false; return { data: {} }; });
    openPage();
    await screen.findByText('Coffee');
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0]);
    await screen.findByText('No products found.');
    fireEvent.click(screen.getByRole('button', { name: 'Active Products' }));
    await screen.findByText('Coffee');
    fireEvent.click(within(screen.getByRole('region', { name: 'Products' })).getByRole('button', { name: 'Archive' }));
    fireEvent.click(within(screen.getByText('Archive Product?').parentElement).getByRole('button', { name: 'Archive' }));
    await screen.findByText('No products found.');
    fireEvent.click(screen.getByRole('button', { name: 'Archive', exact: true }));
    await screen.findByText('Coffee');
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await screen.findByText('No products found.');
    fireEvent.click(screen.getByRole('button', { name: 'Active Products' }));
    await screen.findByText('Coffee');
    expect(axios.delete).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(1);
});

test('a late archive response cannot replace cached active rows', async () => {
    openPage();
    await screen.findByText('Coffee');
    let finish;
    axios.get.mockImplementation(url => url.includes('archived=true')
        ? new Promise(resolve => { finish = resolve; })
        : Promise.resolve({ data: [] }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Active Products' }));
    await screen.findByText('Coffee');
    await act(async () => finish({ data: [{ ...coffee, name: 'Archived Coffee', archived: true }] }));
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.queryByText('Archived Coffee')).not.toBeInTheDocument();
});

test('a failed uncached archive request does not display active products as archived', async () => {
    openPage();
    await screen.findByText('Coffee');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValue(new Error('Network unavailable'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load products.');
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Active Products' }));
    await screen.findByText('Coffee');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a new login cannot reuse the previous session catalog or its late response', async () => {
    let finishOld;
    axios.get.mockImplementation(url => url.includes('/products?')
        ? new Promise(resolve => { finishOld = resolve; })
        : Promise.resolve({ data: [] }));
    const oldPage = openPage();
    oldPage.unmount();
    startSession({ email: 'other@example.com', role: 'owner' });
    axios.get.mockResolvedValue({ data: [{ ...coffee, name: 'New session coffee' }] });
    const page = openPage();
    await screen.findByText('New session coffee');
    await act(async () => finishOld({ data: [coffee] }));
    page.unmount();
    openPage();
    await waitFor(() => expect(screen.getByText('New session coffee')).toBeInTheDocument());
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument();
    expect(catalogRequests()).toHaveLength(2);
});
