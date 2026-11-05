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
