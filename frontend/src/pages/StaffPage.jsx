import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, PERMISSIONS, isOwnerAccount } from '../utils/roles';

const USER_STATUS_REFRESH_MS = 5000;

const getEditablePermissions = (user = {}) => {
  if (Array.isArray(user.permissions)) return user.permissions;
  return user.role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_STAFF_PERMISSIONS;
};

const AccessEditModal = ({ user, permissions, saving, error, onToggle, onSave, onClose }) => {
  const selectedCount = permissions.length;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26, 18, 8, 0.55)', zIndex: 1800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px', fontFamily: 'Segoe UI, sans-serif' }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{ width: 'min(720px, 100%)', maxHeight: '86vh', overflow: 'auto', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}
      >
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #E8DDD0', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: '11px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Edit Page Access</p>
            <h2 style={{ margin: 0, fontSize: '21px', color: '#1a1a1a', fontWeight: '900' }}>{user.name || 'Unnamed User'}</h2>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#777' }}>{user.email} - {user.role}</p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            disabled={saving}
            style={{ width: '34px', height: '34px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#7A6A5A', fontSize: '18px', fontWeight: '900', cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            x
          </button>
        </div>

        <div style={{ padding: '22px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '9px' }}>
            {PERMISSIONS.map(permission => {
              const checked = permissions.includes(permission.key);
              return (
                <label
                  key={permission.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    minHeight: '46px',
                    padding: '10px 12px',
                    border: `1.5px solid ${checked ? '#8B5E3C' : '#DDD2C7'}`,
                    borderRadius: '8px',
                    backgroundColor: checked ? '#FDF5EE' : '#FAFAF8',
                    color: checked ? '#6F4A2F' : '#4A3A2A',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(permission.key)}
                    style={{ width: '15px', height: '15px', flexShrink: 0 }}
                  />
                  {permission.label}
                </label>
              );
            })}
          </div>

          {error && (
            <p style={{ margin: '16px 0 0', padding: '11px 12px', borderRadius: '8px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', color: '#C53030', fontSize: '12px', fontWeight: '800' }}>
              {error}
            </p>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E8DDD0', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#777', fontWeight: '700' }}>{selectedCount} page access option{selectedCount !== 1 ? 's' : ''} selected</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '11px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#f5f5f5', color: '#555', fontSize: '13px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{ padding: '11px 18px', border: 'none', borderRadius: '8px', backgroundColor: saving ? '#C4A87A' : '#8B5E3C', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : 'Save Access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeleteUserModal = ({ user, password, error, deleting, onPasswordChange, onConfirm, onClose }) => {
  const label = user?.name || user?.email || 'this account';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26, 18, 8, 0.55)', zIndex: 1800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px', fontFamily: 'Segoe UI, sans-serif' }}
    >
      <form
        onClick={event => event.stopPropagation()}
        onSubmit={onConfirm}
        style={{ width: 'min(390px, 100%)', backgroundColor: '#fff', borderRadius: '14px', padding: '26px', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}
      >
        <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', borderRadius: '14px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '900', color: '#1a1a1a', textAlign: 'center' }}>
          Do you really want to delete this account?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#777', lineHeight: 1.5, textAlign: 'center' }}>
          {label} will no longer be able to log in. Enter your password to confirm.
        </p>
        <label style={{ display: 'block', marginBottom: '14px' }}>
          <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#4A3A2A', fontWeight: '800' }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={event => onPasswordChange(event.target.value)}
            autoFocus
            placeholder="Enter your password"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1.5px solid #D8CABB', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
          />
        </label>
        {error && (
          <p style={{ margin: '0 0 14px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', color: '#C53030', fontSize: '12px', fontWeight: '700' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: '#f5f5f5', color: '#555', fontSize: '13px', fontWeight: '700', cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={deleting || !password.trim()}
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: deleting || !password.trim() ? '#FEB2B2' : '#E53E3E', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: deleting || !password.trim() ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  );
};

const StaffPage = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [userToEditAccess, setUserToEditAccess] = useState(null);
  const [accessPermissions, setAccessPermissions] = useState([]);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState('');

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const ownerCanEditAccess = isOwnerAccount(currentUser);
  const isCurrentUser = (user) => (
    Boolean(currentUser.email) &&
    String(user.email || '').trim().toLowerCase() === String(currentUser.email).trim().toLowerCase()
  );

  useEffect(() => {
    let mounted = true;

    const fetchUsers = async (showInitialLoading = false) => {
      if (showInitialLoading) {
        setLoading(true);
      }
      setError('');

      try {
        const res = await axios.get('http://localhost:5000/api/auth/users');
        if (mounted) {
          setUsers(res.data.data || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        if (mounted) {
          setError('Failed to load user accounts.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) {
        fetchUsers();
      }
    };

    fetchUsers(true);
    const refreshTimer = setInterval(refreshWhenVisible, USER_STATUS_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      mounted = false;
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;

    return users.filter(user => (
      (user.name || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query) ||
      (user.userId || '').toLowerCase().includes(query) ||
      (user.role || '').toLowerCase().includes(query)
    ));
  }, [searchQuery, users]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-PH', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const onlineCount = useMemo(() => users.filter(user => user.isOnline).length, [users]);

  const openAccessEditModal = (user) => {
    setUserToEditAccess(user);
    setAccessPermissions(getEditablePermissions(user));
    setAccessError('');
  };

  const closeAccessEditModal = () => {
    if (accessSaving) return;
    setUserToEditAccess(null);
    setAccessPermissions([]);
    setAccessError('');
  };

  const toggleAccessPermission = (permission) => {
    setAccessPermissions(prev => (
      prev.includes(permission)
        ? prev.filter(item => item !== permission)
        : [...prev, permission]
    ));
    setAccessError('');
  };

  const handleSaveAccess = async () => {
    if (!userToEditAccess) return;

    setAccessSaving(true);
    setAccessError('');

    try {
      const res = await axios.put(`http://localhost:5000/api/auth/users/${userToEditAccess._id}/access`, {
        currentUserEmail: currentUser.email,
        currentUserId: currentUser.userId,
        permissions: accessPermissions,
      });
      const updatedUser = res.data.user;

      setUsers(prev => prev.map(user => (
        user._id === updatedUser._id ? updatedUser : user
      )));
      setSelectedUser(prev => (
        prev?._id === updatedUser._id ? { ...prev, ...updatedUser } : prev
      ));
      setUserToEditAccess(null);
      setAccessPermissions([]);
      setAccessError('');
    } catch (err) {
      console.error('Error updating user access:', err);
      setAccessError(err.response?.data?.message || 'Failed to update user access.');
    } finally {
      setAccessSaving(false);
    }
  };

  const openDeleteUserModal = (user) => {
    setUserToDelete(user);
    setDeletePassword('');
    setDeleteError('');
  };

  const closeDeleteUserModal = () => {
    if (deletingId) return;
    setUserToDelete(null);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteUser = async (event) => {
    event.preventDefault();
    if (!userToDelete || !deletePassword.trim()) return;

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    setDeletingId(userToDelete._id);
    setError('');
    setDeleteError('');

    try {
      await axios.delete(`http://localhost:5000/api/auth/users/${userToDelete._id}`, {
        data: {
          currentUserEmail: currentUser.email,
          password: deletePassword,
        },
      });
      setUsers(prev => prev.filter(existingUser => existingUser._id !== userToDelete._id));
      closeDeleteUserModal();
    } catch (err) {
      console.error('Error deleting user:', err);
      setDeleteError(err.response?.data?.message || 'Failed to delete user account.');
    } finally {
      setDeletingId('');
    }
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
    setActivityLogs([]);
    setActivityError('');
    setActivityLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('email', user.email || '');
      const res = await axios.get(`http://localhost:5000/api/auth/login-activity?${params}`);
      setActivityLogs(res.data.data || []);
    } catch (err) {
      console.error('Error fetching user activity:', err);
      setActivityError('Failed to load login activity.');
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <div className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <PageHeader
          title="Users"
          description="View all owner, admin, and staff accounts registered in FLUX."
          actions={
            <>
            <div style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '8px', padding: '12px 16px', minWidth: '130px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#8B5E3C', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Total Users</p>
              <p style={{ margin: 0, fontSize: '24px', color: '#1a1a1a', fontWeight: '900' }}>{users.length}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid #BFE8CF', borderRadius: '8px', padding: '12px 16px', minWidth: '130px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#1F7A3A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Online Now</p>
              <p style={{ margin: 0, fontSize: '24px', color: '#14532D', fontWeight: '900' }}>{onlineCount}</p>
            </div>
            </>
          }
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            style={{ width: '280px', padding: '11px 14px', border: '1.5px solid #D8CABB', borderRadius: '8px', fontSize: '13px', outline: 'none', backgroundColor: '#fff' }}
          />
          <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
            Showing {filteredUsers.length} of {users.length}
          </p>
        </div>

        <div className="staff-table-card" style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div className="staff-list-head" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.15fr 1fr 190px', gap: '12px', padding: '14px 18px', backgroundColor: '#1A1208' }}>
            {['User', 'Email', 'User ID', 'Status', 'Created', 'Action'].map(header => (
              <p key={header} style={{ margin: 0, fontSize: '11px', color: '#C4894A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{header}</p>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '42px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>Loading user accounts...</div>
          ) : error ? (
            <div style={{ padding: '42px', textAlign: 'center', color: '#C53030', fontSize: '14px', fontWeight: '700' }}>{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '42px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No user accounts found.</div>
          ) : (
            filteredUsers.map((user, index) => (
              <div
                key={user._id || user.email}
                className="staff-list-row"
                onClick={() => openUserDetails(user)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 1fr 1.15fr 1fr 190px',
                  gap: '12px',
                  padding: '14px 18px',
                  alignItems: 'center',
                  backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8',
                  borderBottom: index === filteredUsers.length - 1 ? 'none' : '1px solid #F0E8E0',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #8B5E3C, #6F4A2F)', color: '#fff', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {user.profileImage
                      ? <img src={user.profileImage} alt={user.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (user.name ? user.name.charAt(0).toUpperCase() : 'S')
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'Unnamed User'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#8B5E3C', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{user.role}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#555', wordBreak: 'break-word' }}>{user.email || '-'}</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#555', fontWeight: '700' }}>{user.userId || '-'}</p>
                <div style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 9px',
                    borderRadius: '999px',
                    backgroundColor: user.isOnline ? '#ECFDF3' : '#F3F4F6',
                    color: user.isOnline ? '#166534' : '#6B7280',
                    border: `1px solid ${user.isOnline ? '#BFE8CF' : '#E5E7EB'}`,
                    fontSize: '11px',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: user.isOnline ? '#22C55E' : '#9CA3AF', flexShrink: 0 }} />
                    {user.isOnline ? 'Online' : 'Offline'}
                  </span>
                  <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#8A7A6B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Last seen {formatDateTime(user.lastSeenAt)}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#777' }}>{formatDate(user.createdAt)}</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {ownerCanEditAccess && user.role !== 'owner' && (
                    <button
                      onClick={event => {
                        event.stopPropagation();
                        openAccessEditModal(user);
                      }}
                      style={{
                        padding: '8px 10px',
                        border: '1px solid #BEE3F8',
                        borderRadius: '7px',
                        backgroundColor: '#EBF8FF',
                        color: '#2B6CB0',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                      }}
                    >
                      Edit Access
                    </button>
                  )}
                  {!isCurrentUser(user) && !isOwnerAccount(user) && (
                  <button
                    onClick={event => {
                      event.stopPropagation();
                      openDeleteUserModal(user);
                    }}
                    disabled={deletingId === user._id}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid #FED7D7',
                      borderRadius: '7px',
                      backgroundColor: deletingId === user._id ? '#F3F4F6' : '#FFF5F5',
                      color: deletingId === user._id ? '#999' : '#C53030',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: deletingId === user._id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deletingId === user._id ? 'Deleting...' : 'Delete'}
                  </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {userToEditAccess && (
          <AccessEditModal
            user={userToEditAccess}
            permissions={accessPermissions}
            saving={accessSaving}
            error={accessError}
            onToggle={toggleAccessPermission}
            onSave={handleSaveAccess}
            onClose={closeAccessEditModal}
          />
        )}
        {userToDelete && (
          <DeleteUserModal
            user={userToDelete}
            password={deletePassword}
            error={deleteError}
            deleting={deletingId === userToDelete._id}
            onPasswordChange={setDeletePassword}
            onConfirm={handleDeleteUser}
            onClose={closeDeleteUserModal}
          />
        )}
        {selectedUser && (
          <div
            onClick={() => setSelectedUser(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26, 18, 8, 0.55)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={{ width: 'min(680px, 100%)', maxHeight: '86vh', overflow: 'auto', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 24px 64px rgba(0,0,0,0.26)' }}
            >
              <div style={{ padding: '20px 22px', borderBottom: '1px solid #E8DDD0', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 5px', fontSize: '11px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.8px' }}>User Activity</p>
                  <h2 style={{ margin: 0, fontSize: '21px', color: '#1a1a1a', fontWeight: '900' }}>{selectedUser.name || 'Unnamed User'}</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#777' }}>{selectedUser.email} · {selectedUser.userId || '-'}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  title="Close"
                  style={{ width: '34px', height: '34px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#7A6A5A', fontSize: '18px', fontWeight: '900', cursor: 'pointer', flexShrink: 0 }}
                >
                  x
                </button>
              </div>

              <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', borderBottom: '1px solid #F0E8E0' }}>
                {[
                  ['Status', selectedUser.isOnline ? 'Online' : 'Offline'],
                  ['Last Seen', formatFullDateTime(selectedUser.lastSeenAt)],
                  ['Created', formatFullDateTime(selectedUser.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} style={{ backgroundColor: '#FAFAF8', border: '1px solid #E8DDD0', borderRadius: '8px', padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '900' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div style={{ padding: '20px 22px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '900', color: '#1a1a1a' }}>Login / Logout Times</h3>
                {activityLoading ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: '#999', backgroundColor: '#FAFAF8', borderRadius: '8px' }}>Loading activity...</div>
                ) : activityError ? (
                  <div style={{ padding: '18px', textAlign: 'center', color: '#C53030', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '800' }}>{activityError}</div>
                ) : activityLogs.length === 0 ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: '#999', backgroundColor: '#FAFAF8', borderRadius: '8px' }}>No login activity recorded yet.</div>
                ) : (
                  <div style={{ border: '1px solid #E8DDD0', borderRadius: '8px', overflow: 'hidden' }}>
                    {activityLogs.map((log, index) => {
                      const action = log.action || 'login';
                      const isLogin = action === 'login';
                      return (
                        <div key={log._id || `${log.createdAt}-${index}`} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '12px', padding: '12px 14px', alignItems: 'center', borderBottom: index === activityLogs.length - 1 ? 'none' : '1px solid #F0E8E0', backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                          <span style={{ display: 'inline-flex', justifyContent: 'center', padding: '5px 9px', borderRadius: '999px', backgroundColor: isLogin ? '#ECFDF3' : '#FFF5F5', color: isLogin ? '#166534' : '#C53030', border: `1px solid ${isLogin ? '#BFE8CF' : '#FED7D7'}`, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            {isLogin ? 'Logged in' : 'Logged out'}
                          </span>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '900' }}>{formatFullDateTime(log.createdAt)}</p>
                            <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#999' }}>{log.ipAddress || 'No IP recorded'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPage;
