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
import SettingsPage from './pages/SettingsPage';
import SalesPage from './pages/SalesPage';
import StaffPage from './pages/StaffPage';
import ReportsPage from './pages/ReportsPage';
import { isAdminRole } from './utils/roles';
import './App.css';

// Protect routes that require login
const PrivateRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user?.email && !user?.role) return <Navigate to="/login" />;
  return isAdminRole(user.role) ? children : <Navigate to="/dashboard" />;
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

  // Disable developer tools and inspect element
  useEffect(() => {
    // Disable F12
    const handleKeyDown = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || 
          (e.ctrlKey && e.shiftKey && e.key === 'J') || (e.ctrlKey && e.shiftKey && e.key === 'C')) {
        e.preventDefault();
        return false;
      }
    };

    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    // Detect developer tools opening (DevTools detection)
    const detectDevTools = setInterval(() => {
      const start = performance.now();
      debugger; // eslint-disable-line no-debugger
      const end = performance.now();
      
      // If debugger statement takes too long, DevTools is open
      if (end - start > 100) {
        console.clear();
        document.body.innerHTML = '<h1 style="text-align:center; margin-top: 50px; color: #8B5E3C;">🔒 Developer Tools Disabled</h1>';
        // Prevent further access
        while (true) {
          debugger; // eslint-disable-line no-debugger
        }
      }
    }, 1000);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(detectDevTools);
    };
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
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
              <PrivateRoute>
                <HistoryPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/transactions"
            element={
              <PrivateRoute>
                <TransactionPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/sales"
            element={
              <AdminRoute>
                <SalesPage />
              </AdminRoute>
            }
          />

          <Route
            path="/staff"
            element={
              <AdminRoute>
                <StaffPage />
              </AdminRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <AdminRoute>
                <ReportsPage />
              </AdminRoute>
            }
          />

          <Route path="/items"
          element={
          <PrivateRoute>
            <Items /></PrivateRoute>
          } />

          <Route path="/orders" element={<Navigate to="/items" />} />
          <Route path="/order-display" element={<Navigate to="/items" />} />

          <Route path="/forgot-password" 
          element={<ForgotPasswordPage />} />

          <Route path="/change-password" 
          element={<ChangePasswordPage />} />

          <Route path="*" element={<Navigate to="/login" />} />

          <Route path="/inventory" element={<AdminRoute><InventoryPage /></AdminRoute>}
          
          />
          <Route path="/products" element={<AdminRoute><SettingsPage initialSection="inventory" mode="products" /></AdminRoute>} />
          <Route path="/product-settings" element={<Navigate to="/products" />} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
