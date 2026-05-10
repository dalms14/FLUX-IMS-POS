import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { isAdminRole } from '../utils/roles';

const getList = (payload) => payload?.data || payload || [];

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ActivityRow = ({ activity, last }) => (
  <div style={{
    padding: '12px 0',
    borderBottom: last ? 'none' : '1px solid #e8e8e8',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '700', margin: '0 0 4px' }}>{activity.text}</p>
        <p style={{ fontSize: '12px', color: '#777', margin: 0 }}>{activity.actor}</p>
      </div>
      <span style={{ fontSize: '11px', color: '#888', flexShrink: 0, textAlign: 'right' }}>{formatDate(activity.date)}</span>
    </div>
  </div>
);

const ActivityList = ({ title, activities, loading, error, emptyText }) => (
  <div style={{ border: '1.5px solid #1a1a1a', borderRadius: '8px', padding: '20px', minHeight: '300px', backgroundColor: '#fff' }}>
    <h3 style={{ fontSize: '14px', fontWeight: '800', fontStyle: 'italic', margin: '0 0 4px', textTransform: 'uppercase' }}>
      {title}
    </h3>
    <div style={{ height: '2px', backgroundColor: '#1a1a1a', marginBottom: '12px' }} />

    {loading ? (
      <p style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '40px' }}>Loading activities...</p>
    ) : error ? (
      <p style={{ fontSize: '12px', color: '#C53030', textAlign: 'center', marginTop: '40px' }}>{error}</p>
    ) : activities.length === 0 ? (
      <p style={{ fontSize: '12px', color: '#bbb', textAlign: 'center', marginTop: '40px' }}>{emptyText}</p>
    ) : (
      activities.map((activity, i) => (
        <ActivityRow key={`${activity.type}-${activity.id}-${i}`} activity={activity} last={i === activities.length - 1} />
      ))
    )}
  </div>
);

const ProfilePage = () => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      setError('');

      try {
        const [transactionRes, refundRes] = await Promise.all([
          fetch('http://localhost:5000/api/transactions'),
          fetch('http://localhost:5000/api/refunds'),
        ]);

        if (!transactionRes.ok) throw new Error('Failed to load transactions');
        if (!refundRes.ok) throw new Error('Failed to load refunds');

        const transactionData = await transactionRes.json();
        const refundData = await refundRes.json();

        setTransactions(getList(transactionData));
        setRefunds(getList(refundData));
      } catch (err) {
        console.error('Error loading profile activities:', err);
        setError('Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  useEffect(() => {
    if (!uploadMessage) return undefined;
    const timer = setTimeout(() => setUploadMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [uploadMessage]);

  const allActivities = useMemo(() => {
    const transactionActivities = transactions.map(t => ({
      id: t._id || t.receiptNo,
      type: 'transaction',
      text: `Processed transaction ${t.receiptNo || ''} - PHP ${(t.total || 0).toLocaleString()}`,
      actor: t.cashier || t.cashierEmail || 'Unknown cashier',
      actorEmail: t.cashierEmail || '',
      date: t.createdAt,
    }));

    const refundActivities = refunds.map(r => ({
      id: r._id || r.receiptNo,
      type: 'refund',
      text: `Processed refund for ${r.receiptNo || 'transaction'} - PHP ${(r.totalRefunded || 0).toLocaleString()}`,
      actor: r.refundedBy || r.refundedByEmail || 'Unknown user',
      actorEmail: r.refundedByEmail || '',
      date: r.createdAt,
    }));

    return [...transactionActivities, ...refundActivities]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [transactions, refunds]);

  const userActivities = useMemo(() => {
    const userName = (user.name || '').trim().toLowerCase();
    const userEmail = (user.email || '').trim().toLowerCase();

    return allActivities.filter(activity => {
      const actor = (activity.actor || '').trim().toLowerCase();
      const actorEmail = (activity.actorEmail || '').trim().toLowerCase();
      return (userName && actor === userName) || (userEmail && actorEmail === userEmail);
    });
  }, [allActivities, user.email, user.name]);

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

      const updatedUser = { ...user, profileImage: data.user.profileImage };
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

      const updatedUser = { ...user, profileImage: '' };
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

  const infoStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid #e8e8e8',
    gap: '16px',
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    width: '90px',
    flexShrink: 0,
  };

  const valueStyle = {
    fontSize: '14px',
    color: '#1a1a1a',
    fontWeight: '500',
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <div className="mobile-page-content profile-mobile-content" style={{ flex: 1, overflow: 'auto', padding: '40px' }}>
        <div style={{ display: 'flex', gap: '32px', maxWidth: '1200px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '4px' }}>
              <div style={{ position: 'relative', width: '66px', height: '66px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowAvatarMenu(prev => !prev)}
                  disabled={uploading}
                  title="Profile picture options"
                  style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8B5E3C, #6F4A2F)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', fontWeight: '700', color: '#fff',
                    border: '2px solid #C4894A',
                    padding: 0,
                    overflow: 'hidden',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {user.profileImage
                    ? <img src={user.profileImage} alt={user.name || 'Profile'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name ? user.name.charAt(0).toUpperCase() : 'U')
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setShowAvatarMenu(prev => !prev)}
                  disabled={uploading}
                  title="Edit profile picture"
                  style={{
                    position: 'absolute',
                    right: '2px',
                    bottom: '6px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: '#1A1208',
                    border: '2px solid #F5F0EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F5EDE3',
                    boxSizing: 'border-box',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                {showAvatarMenu && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '70px',
                    width: '170px',
                    backgroundColor: '#fff',
                    border: '1px solid #E0D5CB',
                    borderRadius: '8px',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
                    padding: '6px',
                    zIndex: 5,
                  }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ width: '100%', padding: '9px 10px', border: 'none', borderRadius: '6px', backgroundColor: 'transparent', color: '#1a1a1a', fontSize: '12px', fontWeight: '700', textAlign: 'left', cursor: 'pointer' }}
                    >
                      Change picture
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={!user.profileImage || uploading}
                      style={{ width: '100%', padding: '9px 10px', border: 'none', borderRadius: '6px', backgroundColor: 'transparent', color: user.profileImage ? '#C53030' : '#bbb', fontSize: '12px', fontWeight: '700', textAlign: 'left', cursor: user.profileImage && !uploading ? 'pointer' : 'not-allowed' }}
                    >
                      Remove picture
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#1a1a1a', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                {user.name || 'User'}
              </h1>
            </div>
            {uploadMessage && (
              <p style={{ fontSize: '12px', color: uploadMessage.includes('updated') ? '#276749' : '#C53030', margin: '6px 0 8px 76px', fontWeight: '700' }}>
                {uploadMessage}
              </p>
            )}
            <div style={{ height: '3px', backgroundColor: '#1a1a1a', marginBottom: '28px' }} />

            <div style={{ backgroundColor: '#E8E8E8', borderRadius: '8px', overflow: 'hidden', marginBottom: '28px' }}>
              <div style={infoStyle}>
                <span style={labelStyle}>Role:</span>
                <span style={valueStyle}>{isAdminRole(user.role) ? 'OWNER/ADMIN' : 'STAFF'}</span>
              </div>
              <div style={infoStyle}>
                <span style={labelStyle}>Email:</span>
                <span style={valueStyle}>{user.email?.toUpperCase() || 'N/A'}</span>
              </div>
            </div>

            <ActivityList
              title="Your Activities"
              activities={userActivities.slice(0, 12)}
              loading={loading}
              error={error}
              emptyText="No activities found for this user."
            />
          </div>

          <div style={{ width: '360px', flexShrink: 0 }}>
            <ActivityList
              title="Recent Activities"
              activities={allActivities.slice(0, 12)}
              loading={loading}
              error={error}
              emptyText="No recent activities."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
