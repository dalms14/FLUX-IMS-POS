import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import FirstLoginPasswordPage from './pages/FirstLoginPasswordPage';
import Dashboard from './pages/Dashboard';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import TransactionPage from './pages/TransactionPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import Items from './pages/Items'; 
import InventoryPage from './pages/InventoryPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import SettingsPage from './pages/SettingsPage';
import SalesPage from './pages/SalesPage';
import StaffPage from './pages/StaffPage';
import CreateAccountPage from './pages/CreateAccountPage';
import ReportsPage from './pages/ReportsPage';
import EliteMembersPage from './pages/EliteMembersPage';
import { getLandingPath, hasPermission } from './utils/roles';
import { getSessionCredentials, getSessionUser, SESSION_CHANGED_EVENT } from './utils/session';
import useSessionSync from './utils/useSessionSync';
import { sendSessionHeartbeat } from './utils/sessionHeartbeat';
import ShiftEndCountdown from './components/ShiftEndCountdown';
import './App.css';

// Protect routes that require login
export const PrivateRoute = ({ children }) => {
  const user = getSessionUser();
  return user ? children : <Navigate to="/login" />;
};

export const PermissionRoute = ({ children, permission }) => {
  const user = getSessionUser();
  if (!user) return <Navigate to="/login" replace />;
  return hasPermission(user, permission) ? children : <Navigate to={getLandingPath(user)} />;
};

function App() {
  useSessionSync();

  useEffect(() => {
    let reportedActivity = 0;
    const sendHeartbeat = () => {
      if (!document.hidden) {
        reportedActivity = getSessionCredentials()?.lastActiveAt || 0;
        sendSessionHeartbeat();
      }
    };
    const sendRecentActivity = () => {
      const activity = getSessionCredentials()?.lastActiveAt || 0;
      // Report the first input after an idle period immediately, including just
      // before the server deadline. Continuous input is sent at most every 5s.
      if (activity - reportedActivity >= 5000) sendHeartbeat();
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 10000);
    const checkWhenReturningToApp = () => {
      if (!document.hidden) sendHeartbeat();
    };
    document.addEventListener('visibilitychange', checkWhenReturningToApp);
    window.addEventListener('focus', sendHeartbeat);
    window.addEventListener(SESSION_CHANGED_EVENT, sendRecentActivity);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', checkWhenReturningToApp);
      window.removeEventListener('focus', sendHeartbeat);
      window.removeEventListener(SESSION_CHANGED_EVENT, sendRecentActivity);
    };
  }, []);

  return (
    <Router>
      <div className="App">
        <ShiftEndCountdown />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/first-login-password" element={<FirstLoginPasswordPage />} />

          <Route
            path="/dashboard"
            element={
              <PermissionRoute permission="dashboard">
                <Dashboard />
              </PermissionRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/history"
            element={
              <PermissionRoute permission="history">
                <HistoryPage />
              </PermissionRoute>
            }
          />

          <Route
            path="/transactions"
            element={
              <PermissionRoute permission="transactions">
                <TransactionPage />
              </PermissionRoute>
            }
          />

          <Route
            path="/sales"
            element={
              <PermissionRoute permission="sales">
                <SalesPage />
              </PermissionRoute>
            }
          />

          <Route
            path="/staff"
            element={
              <PermissionRoute permission="staff">
                <StaffPage />
              </PermissionRoute>
            }
          />
          <Route path="/staff/create" element={<PermissionRoute permission="users"><CreateAccountPage /></PermissionRoute>} />

          <Route
            path="/reports"
            element={
              <PermissionRoute permission="reports">
                <ReportsPage />
              </PermissionRoute>
            }
          />

          <Route path="/items"
          element={
          <PermissionRoute permission="items">
            <Items /></PermissionRoute>
          } />

          <Route path="/orders" element={<Navigate to="/items" />} />
          <Route path="/order-display" element={<Navigate to="/items" />} />

          <Route path="/forgot-password" 
          element={<ForgotPasswordPage />} />

          <Route path="/change-password" 
          element={<ChangePasswordPage />} />

          <Route path="*" element={<Navigate to="/login" />} />

          <Route path="/inventory" element={<PermissionRoute permission="inventory"><InventoryPage /></PermissionRoute>}
          
          />
          <Route path="/purchase-orders" element={<PermissionRoute permission="purchase_orders"><PurchaseOrdersPage /></PermissionRoute>} />
          <Route path="/products" element={<PermissionRoute permission="products"><SettingsPage initialSection="inventory" mode="products" /></PermissionRoute>} />
          <Route path="/elite-members" element={<PermissionRoute permission="elite_members"><EliteMembersPage /></PermissionRoute>} />
          <Route path="/product-settings" element={<Navigate to="/products" />} />
          <Route path="/settings" element={<PermissionRoute permission="settings"><SettingsPage /></PermissionRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
