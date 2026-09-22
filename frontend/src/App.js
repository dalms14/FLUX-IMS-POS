import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import LoginPage from './pages/LoginPage';
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
import ReportsPage from './pages/ReportsPage';
import { getLandingPath, hasPermission } from './utils/roles';
import './App.css';

// Protect routes that require login
const PrivateRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  return user ? children : <Navigate to="/login" />;
};

const PermissionRoute = ({ children, permission }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user?.email && !user?.role) return <Navigate to="/login" />;
  return hasPermission(user, permission) ? children : <Navigate to={getLandingPath(user)} />;
};

function App() {
  useEffect(() => {
    const sendHeartbeat = async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.email) return;

      try {
        await axios.post('http://localhost:5000/api/auth/heartbeat', { email: user.email });
      } catch (err) {
        console.error('Error updating online status:', err);
      }
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(heartbeatTimer);
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

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
          <Route path="/product-settings" element={<Navigate to="/products" />} />
          <Route path="/settings" element={<PermissionRoute permission="settings"><SettingsPage /></PermissionRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
