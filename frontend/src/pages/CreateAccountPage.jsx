import React from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { UserAccountSettings } from './SettingsPage';

export default function CreateAccountPage() {
  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />
      <main className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px', minWidth: 0 }}>
        <PageHeader
          title="Create Account"
          description="Register a user and choose their role and access."
          actions={<Link to="/staff" style={{ padding: '12px 16px', border: '1px solid #D8CABB', borderRadius: '8px', color: '#6F4A2F', backgroundColor: '#fff', fontSize: '13px', fontWeight: '800', textDecoration: 'none' }}>Back to Users</Link>}
        />
        <UserAccountSettings />
      </main>
    </div>
  );
}
