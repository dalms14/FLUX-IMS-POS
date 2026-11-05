import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfilePage from './ProfilePage';
jest.mock('./Sidebar', () => () => <nav>Navigation</nav>);
const user = { name: 'Athan', email: 'athan@example.com', userId: 'ELI010', role: 'custom', jobRole: 'Operations', _session: { id: 'session1' } };
const payload = { user, lastSignInAt: '2026-11-05T16:05:00Z',
    transactions: [{ _id: 't1', receiptNo: 'FLX-SALE-001', total: 200, createdAt: '2026-11-05T16:10:00Z' }],
    refunds: [{ _id: 'r1', receiptNo: 'FLX-REFUND-002', totalRefunded: 50, createdAt: '2026-11-04T16:15:00Z' }],
};
beforeEach(() => { localStorage.clear(); localStorage.setItem('user', JSON.stringify(user)); global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload }); });
afterEach(() => jest.restoreAllMocks());

test('profile shows accurate account details and sign-in, with one searchable activity list and Philippine date filters', async () => {
    render(<ProfilePage />);
    await screen.findByText('FLX-SALE-001');
    expect(screen.getByText('athan@example.com')).toBeInTheDocument();
    expect(screen.getByText('ELI010')).toBeInTheDocument();
    expect(screen.getAllByText('Operations')).toHaveLength(2);
    expect(screen.getByText(/Nov 06, 2026, 12:05 AM/i)).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Your activity' })).toHaveLength(1);
    expect(screen.queryByText('Recent Activities')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'refund' } });
    expect(screen.queryByText('FLX-SALE-001')).not.toBeInTheDocument();
    expect(screen.getByText('FLX-REFUND-002')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-06' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-06' } });
    expect(screen.getByText('FLX-SALE-001')).toBeInTheDocument();
    expect(screen.queryByText('FLX-REFUND-002')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-05' } });
    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after');
});

test('load failure can be retried and missing sign-in is shown honestly', async () => {
    fetch.mockResolvedValueOnce({ ok: false });
    render(<ProfilePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load');
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ user, transactions: [], refunds: [], lastSignInAt: null }) });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('No sales or refunds recorded for your account yet.');
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
});

test('profile picture upload and removal preserve the current login session', async () => {
    render(<ProfilePage />);
    await screen.findByText('FLX-SALE-001');
    fetch.mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ user: { profileImage: 'data:image/png;base64,AAA=' } }) });
    fireEvent.change(screen.getByLabelText('Upload profile picture'), { target: { files: [new File(['picture'], 'photo.png', { type: 'image/png' })] } });
    await screen.findByText('Profile picture updated.');
    expect(JSON.parse(localStorage.getItem('user'))._session.id).toBe('session1');
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile picture' }));
    fetch.mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ user: { profileImage: '' } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
    await screen.findByText('Profile picture removed.');
    await waitFor(() => expect(JSON.parse(localStorage.getItem('user')).profileImage).toBe(''));
});
