import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { FiCamera, FiRefreshCw, FiSearch } from 'react-icons/fi';
import './ProfilePage.css';

const formatDate = value => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
};
const dayKey = value => {
  const date = new Date(value);
  return !value || Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};
const readUser = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };

export default function ProfilePage() {
  const [user, setUser] = useState(readUser);
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [lastSignInAt, setLastSignInAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const fileInputRef = useRef(null);
  const sessionId = useRef(user._session?.id);
  const active = useRef(true);
  const requestVersion = useRef(0);
  const fetchActivities = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/auth/my-activity');
      if (!response.ok) throw new Error('Unable to load your profile activity. Please try again.');
      const data = await response.json();
      if (!active.current || version !== requestVersion.current || readUser()._session?.id !== sessionId.current) return;
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      setRefunds(Array.isArray(data.refunds) ? data.refunds : []);
      setLastSignInAt(data.lastSignInAt || null);
      if (data.user) setUser(current => ({ ...current, ...data.user }));
    } catch (err) {
      if (active.current && version === requestVersion.current) setError(err.message);
    } finally {
      if (active.current && version === requestVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    fetchActivities();
    return () => { active.current = false; };
  }, [fetchActivities]);
  useEffect(() => {
    if (!uploadMessage) return undefined;
    const timer = setTimeout(() => setUploadMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [uploadMessage]);

  const activities = useMemo(() => [
    ...transactions.map(t => ({ id: `sale-${t._id || t.receiptNo}`, type: 'Sale', receipt: t.receiptNo || 'Transaction', amount: Number(t.total || 0), date: t.createdAt })),
    ...refunds.map(r => ({ id: `refund-${r._id || r.receiptNo}`, type: 'Refund', receipt: r.receiptNo || 'Transaction', amount: Number(r.totalRefunded || 0), date: r.createdAt })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [transactions, refunds]);
  const dateError = startDate && endDate && startDate > endDate;
  const filtered = activities.filter(activity => {
    const day = dayKey(activity.date);
    return !dateError && (!startDate || (day && day >= startDate)) && (!endDate || (day && day <= endDate))
      && `${activity.type} ${activity.receipt} ${activity.amount}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const assignedRole = user.role === 'custom' ? (user.jobRole || 'Custom') : ({ owner: 'Owner', admin: 'Admin', staff: 'Staff' }[String(user.role).toLowerCase()] || user.role || 'Not assigned');

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadMessage('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadMessage('Please choose an image under 2MB.');
      return;
    }

    setUploading(true);
    setUploadMessage('');

    try {
      const profileImage = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('http://localhost:5000/api/auth/profile-picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, profileImage }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok) throw new Error(data?.message || 'Failed to update profile picture. Please restart the backend server.');

      const latestUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (latestUser._session?.id !== user._session?.id) return;
      const updatedUser = { ...latestUser, profileImage: data.user.profileImage };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setUploadMessage('Profile picture updated.');
    } catch (err) {
      setUploadMessage(err.message || 'Failed to update profile picture.');
    } finally {
      setUploading(false);
      setShowAvatarMenu(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user.profileImage) {
      setShowAvatarMenu(false);
      return;
    }

    setUploading(true);
    setUploadMessage('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/profile-picture', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok) throw new Error(data?.message || 'Failed to remove profile picture. Please restart the backend server.');

      const latestUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (latestUser._session?.id !== user._session?.id) return;
      const updatedUser = { ...latestUser, profileImage: '' };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setUploadMessage('Profile picture removed.');
    } catch (err) {
      setUploadMessage(err.message || 'Failed to remove profile picture.');
    } finally {
      setUploading(false);
      setShowAvatarMenu(false);
    }
  };

  return <div className="mobile-app-shell profile-shell">
    <Sidebar />
    <main className="mobile-page-content profile-content">
      <header className="profile-page-heading"><h1>My Profile</h1><p>Your account details and recent activity.</p></header>
      <section className="profile-account-card" aria-label="Account details">
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <button type="button" className="profile-avatar" aria-label="Profile picture options" aria-expanded={showAvatarMenu} disabled={uploading} onClick={() => setShowAvatarMenu(value => !value)}>
              {user.profileImage ? <img src={user.profileImage} alt={user.name || 'Profile'} /> : (user.name || 'U').charAt(0).toUpperCase()}
            </button>
            <button type="button" className="profile-avatar-edit" aria-label="Edit profile picture" disabled={uploading} onClick={() => setShowAvatarMenu(value => !value)}><FiCamera /></button>
            {showAvatarMenu && <div className="profile-avatar-menu">
              <button type="button" onClick={() => fileInputRef.current?.click()}>Change picture</button>
              <button type="button" onClick={handleRemoveAvatar} disabled={!user.profileImage || uploading}>Remove picture</button>
              <button type="button" onClick={() => setShowAvatarMenu(false)}>Close</button>
            </div>}
            <input ref={fileInputRef} aria-label="Upload profile picture" type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          </div>
          <div><h2>{user.name || 'User'}</h2><span className="profile-role">{assignedRole}</span><p className="profile-picture-hint">{uploading ? 'Updating picture...' : 'Profile picture: image up to 2 MB'}</p></div>
        </div>
        {uploadMessage && <p className="profile-upload-message" role="status">{uploadMessage}</p>}
        <dl className="profile-details">
          <div><dt>Email address</dt><dd>{user.email || 'Not provided'}</dd></div>
          <div><dt>User ID</dt><dd>{user.userId || 'Not assigned'}</dd></div>
          <div><dt>Assigned role</dt><dd>{assignedRole}</dd></div>
          <div><dt>Last sign-in</dt><dd>{loading ? 'Loading...' : error ? 'Unavailable' : formatDate(lastSignInAt)}</dd></div>
        </dl>
      </section>
      <section className="profile-activity-card" aria-label="Your activity">
        <div className="profile-activity-heading"><div><h2>Your Activity</h2><p>Recent sales and refunds processed by your account.</p></div><button type="button" onClick={fetchActivities} disabled={loading}><FiRefreshCw aria-hidden="true" /> Refresh</button></div>
        <div className="profile-filters">
          <label className="profile-search">Search activity<div><FiSearch aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Receipt number, sale or refund..." /></div></label>
          <label>Start date<input type="date" value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)} /></label>
          <label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} /></label>
          <button type="button" onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); }}>Clear</button>
        </div>
        {dateError && <p role="alert" className="profile-error">End date must be on or after start date.</p>}
        {!loading && !error && <p className="profile-activity-count">Showing {filtered.length} of {activities.length} recent entries · Philippine time</p>}
        <div className="profile-activity-list" tabIndex="0" aria-label="Scrollable activity list" aria-busy={loading}>
          {loading ? <p className="profile-empty" role="status">Loading activities...</p> : error ? <p className="profile-error" role="alert">{error}</p> : filtered.length === 0 ? <p className="profile-empty">{activities.length ? 'No activities match your filters.' : 'No sales or refunds recorded for your account yet.'}</p> : filtered.map(activity => <article key={activity.id} className="profile-activity-row">
            <span className="profile-activity-type">{activity.type}</span><div><strong>{activity.receipt}</strong><p>{activity.type === 'Refund' ? 'Refund processed' : 'Transaction processed'}</p></div>
            <strong className="profile-activity-amount">₱{activity.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><time dateTime={activity.date}>{formatDate(activity.date)}</time>
          </article>)}
        </div>
        <p className="profile-activity-footnote">Includes up to 50 recent sales and 50 recent refunds.</p>
      </section>
    </main>
  </div>;
}
