import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App, { PrivateRoute, PermissionRoute } from './App';
import { recordSessionActivity, startSession } from './utils/session';
import { sendSessionHeartbeat } from './utils/sessionHeartbeat';
jest.mock('./utils/sessionHeartbeat', () => ({ sendSessionHeartbeat: jest.fn() }));

jest.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <span data-testid="redirect">{to}</span>,
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => children,
  Route: () => null,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
}), { virtual: true });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });
test('logged-out users are redirected before protected content is rendered', () => {
  render(<PrivateRoute><div>Protected content</div></PrivateRoute>);
  expect(screen.getByTestId('redirect')).toHaveTextContent('/login');
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
});
test('staff cannot open a page outside their assigned permissions', () => {
  startSession({ email: 'staff@example.com', role: 'staff', sessionToken: 'a'.repeat(64) });
  render(<PermissionRoute permission="products"><div>Product administration</div></PermissionRoute>);
  expect(screen.getByTestId('redirect')).toHaveTextContent('/dashboard');
  expect(screen.queryByText('Product administration')).not.toBeInTheDocument();
});
test('an authorized owner still reaches the requested page', () => {
  startSession({ email: 'owner@example.com', role: 'owner', sessionToken: 'b'.repeat(64) });
  render(<PermissionRoute permission="products"><div>Product administration</div></PermissionRoute>);
  expect(screen.getByText('Product administration')).toBeInTheDocument();
});

test.each([
  [['users'], false],
  [['staff'], false],
  [['staff', 'users'], true],
])('account creation requires both Users and Create Accounts: %j', (permissions, allowed) => {
  startSession({ email: 'clerk@example.com', role: 'custom', permissions, sessionToken: 'c'.repeat(64) });
  render(<PermissionRoute permission="users"><div>Create Account form</div></PermissionRoute>);
  expect(Boolean(screen.queryByText('Create Account form'))).toBe(allowed);
});

test('a custom role can open membership with its own permission and loses access when revoked', () => {
  startSession({ email: 'clerk@example.com', role: 'custom', permissions: ['elite_members'], sessionToken: 'b'.repeat(64) });
  const page = render(<PermissionRoute permission="elite_members"><div>Membership management</div></PermissionRoute>);
  expect(screen.getByText('Membership management')).toBeInTheDocument();
  startSession({ email: 'clerk@example.com', role: 'custom', permissions: ['products'], sessionToken: 'b'.repeat(64) });
  page.rerender(<PermissionRoute permission="elite_members"><div>Membership management</div></PermissionRoute>);
  expect(screen.queryByText('Membership management')).not.toBeInTheDocument();
  expect(screen.getByTestId('redirect')).toHaveTextContent('/products');
});
test('the first real input just before idle expiry is reported immediately, while continuous input is throttled', () => {
  jest.useFakeTimers();
  const beginning = Date.now();
  startSession({ email: 'staff@example.com', role: 'staff', sessionToken: 'a'.repeat(64) });
  const app = render(<App />);
  sendSessionHeartbeat.mockClear();
  act(() => { jest.setSystemTime(beginning + 14 * 60000 + 59000); recordSessionActivity(); });
  expect(sendSessionHeartbeat).toHaveBeenCalledTimes(1);
  act(() => { jest.setSystemTime(beginning + 15 * 60000); recordSessionActivity(); });
  expect(sendSessionHeartbeat).toHaveBeenCalledTimes(1);
  app.unmount();
  jest.useRealTimers();
});
