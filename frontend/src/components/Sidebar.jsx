import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { isAdminRole } from '../utils/roles';
import './Sidebar.css';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { key: 'items', label: 'Items and POS', path: '/items', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { key: 'products', label: 'Products', path: '/products', adminOnly: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
  { key: 'sales', label: 'Sales', path: '/sales', adminOnly: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { key: 'inventory', label: 'Inventory', path: '/inventory', adminOnly: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  { key: 'transactions', label: 'Transactions', path: '/transactions', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { key: 'staff', label: 'Staff', path: '/staff', adminOnly: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { key: 'history', label: 'History', path: '/history', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg> },
  { key: 'reports', label: 'Reports', path: '/reports', adminOnly: true, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> },
  { key: 'settings', label: 'Settings', path: '/settings', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [hoveredKey, setHoveredKey] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = isAdminRole(user.role);
  const visibleItems = navItems.filter(item => isAdmin || !item.adminOnly);

  const confirmLogout = async () => {
    try {
      if (user.email) {
        await axios.post('http://localhost:5000/api/auth/logout', { email: user.email });
      }
    } catch (err) {
      console.error('Error updating logout status:', err);
    } finally {
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const goTo = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const primaryMobileKeys = ['items', 'dashboard', 'transactions'];
  const mobilePrimaryItems = visibleItems.filter(item => primaryMobileKeys.includes(item.key));
  const mobileMoreItems = visibleItems.filter(item => !primaryMobileKeys.includes(item.key));
  const isMoreActive = mobileMoreItems.some(item => location.pathname === item.path) || location.pathname === '/profile';

  return (
    <>
    <div className="flux-sidebar-desktop" style={{
      width: collapsed ? '64px' : '220px',
      minHeight: '100vh',
      backgroundColor: '#1A1208',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      borderRight: '1px solid rgba(212,184,154,0.08)',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      fontFamily: 'Segoe UI, sans-serif',
    }}>

      {/* Brand + Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '14px 5px' : '14px 12px',
        borderBottom: '1px solid rgba(212,184,154,0.08)',
        minHeight: '64px',
        gap: collapsed ? '3px' : '8px',
      }}>
        <div className={`sidebarBrand ${collapsed ? 'sidebarBrandCollapsed' : 'sidebarBrandExpanded'}`} style={{
          minWidth: 0,
          width: collapsed ? 0 : '112px',
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
          overflow: 'hidden',
          transition: 'opacity 0.28s ease 0.08s, transform 0.28s ease 0.08s, width 0.2s ease',
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#F5EDE3', letterSpacing: '-0.3px' }}>FLUX</div>
            <div style={{ fontSize: '9px', color: '#8B5E3C', letterSpacing: '2.5px', fontWeight: '600', marginTop: '2px' }}>ELI COFFEE</div>
          </div>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            border: '1px solid rgba(212,184,154,0.15)',
            backgroundColor: 'rgba(212,184,154,0.06)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#8B5E3C', flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#8B5E3C'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,184,154,0.06)'; e.currentTarget.style.color = '#8B5E3C'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      {/* ── Clickable User Profile ── */}
      <div
        onClick={() => navigate('/profile')}
        onMouseEnter={() => setHoveredKey('profile')}
        onMouseLeave={() => setHoveredKey(null)}
        style={{
          padding: '10px 8px',
          borderBottom: '1px solid rgba(212,184,154,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '0',
          cursor: 'pointer',
          backgroundColor: hoveredKey === 'profile'
            ? 'rgba(139,94,60,0.15)'
            : location.pathname === '/profile'
            ? 'rgba(139,94,60,0.12)'
            : 'transparent',
          transition: 'background 0.15s',
          borderRadius: '0',
        }}
        title={collapsed ? 'View Profile' : ''}
      >
        <span style={{ width: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #8B5E3C, #6F4A2F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: '700', color: '#F5EDE3', flexShrink: 0,
            border: location.pathname === '/profile' ? '2px solid #C4894A' : '2px solid transparent',
            transition: 'border 0.15s',
            overflow: 'hidden',
          }}>
            {user.profileImage
              ? <img src={user.profileImage} alt={user.name || 'Profile'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user.name ? user.name.charAt(0).toUpperCase() : 'U')
            }
          </div>
        </span>
          <div style={{
            minWidth: 0,
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
            transition: 'opacity 0.24s ease 0.08s, transform 0.24s ease 0.08s',
            overflow: 'hidden',
            pointerEvents: collapsed ? 'none' : 'auto',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#E8DDD0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name || 'User'}
            </div>
            <div style={{ fontSize: '10px', color: '#8B5E3C', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '600', marginTop: '1px' }}>
              {user.role || 'staff'}
            </div>
          </div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '8px 8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isHovered = hoveredKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              title={collapsed ? item.label : ''}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '0',
                padding: '0',
                minHeight: '40px',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(139,94,60,0.15)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: isActive ? '#C4894A' : isHovered ? '#C4B5A5' : '#7A6A5A',
                transition: 'all 0.15s ease', marginBottom: '2px', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive || isHovered ? '#C4894A' : '#6A5A4A', transition: 'color 0.15s' }}>
                {item.icon}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: isActive ? '600' : '400',
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                transition: 'opacity 0.24s ease 0.08s, transform 0.24s ease 0.08s',
                overflow: 'hidden',
                pointerEvents: collapsed ? 'none' : 'auto',
              }}>{item.label}</span>
              <span style={{ marginLeft: 'auto', marginRight: '12px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#C4894A', flexShrink: 0, opacity: !collapsed && isActive ? 1 : 0, transition: 'opacity 0.2s ease' }} />
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(212,184,154,0.08)' }}>
        <button
          onClick={handleLogout}
          onMouseEnter={() => setHoveredKey('logout')}
          onMouseLeave={() => setHoveredKey(null)}
          title={collapsed ? 'Log out' : ''}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '0',
            padding: '0',
            minHeight: '40px',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: hoveredKey === 'logout' ? 'rgba(239,68,68,0.08)' : 'transparent',
            color: hoveredKey === 'logout' ? '#EF4444' : '#4A3A2A',
            transition: 'all 0.15s ease', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          <span style={{
            fontSize: '13px',
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
            transition: 'opacity 0.24s ease 0.08s, transform 0.24s ease 0.08s',
            overflow: 'hidden',
            pointerEvents: collapsed ? 'none' : 'auto',
          }}>Log out</span>
        </button>
      </div>
    </div>
    <div className="flux-mobile-nav-shell">
      {mobileMenuOpen && (
        <div className="flux-mobile-more-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="flux-mobile-more-panel" onClick={event => event.stopPropagation()}>
            <div className="flux-mobile-more-header">
              <button
                type="button"
                className={`flux-mobile-profile ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={() => goTo('/profile')}
              >
                <span className="flux-mobile-avatar">
                  {user.profileImage
                    ? <img src={user.profileImage} alt={user.name || 'Profile'} />
                    : (user.name ? user.name.charAt(0).toUpperCase() : 'U')
                  }
                </span>
                <span className="flux-mobile-user-text">
                  <span>{user.name || 'User'}</span>
                  <small>{user.role || 'staff'}</small>
                </span>
              </button>
              <button
                type="button"
                className="flux-mobile-close"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                x
              </button>
            </div>

            <div className="flux-mobile-more-grid">
              {mobileMoreItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`flux-mobile-more-item ${isActive ? 'active' : ''}`}
                    onClick={() => goTo(item.path)}
                  >
                    <span>{item.icon}</span>
                    <strong>{item.label}</strong>
                  </button>
                );
              })}
              <button
                type="button"
                className="flux-mobile-more-item danger"
                onClick={handleLogout}
              >
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                <strong>Log out</strong>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="flux-mobile-bottom-nav" aria-label="Mobile navigation">
        {mobilePrimaryItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.key}
              type="button"
              className={`flux-mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => goTo(item.path)}
            >
              <span>{item.icon}</span>
              <strong>{item.key === 'items' ? 'POS' : item.label}</strong>
            </button>
          );
        })}
        <button
          type="button"
          className={`flux-mobile-nav-item ${isMoreActive || mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(prev => !prev)}
        >
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="19" cy="12" r="1"/>
              <circle cx="5" cy="12" r="1"/>
            </svg>
          </span>
          <strong>More</strong>
        </button>
      </nav>
    </div>
    {showLogoutConfirm && (
      <div
        onClick={() => setShowLogoutConfirm(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3000,
          backgroundColor: 'rgba(26, 18, 8, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '18px',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        <div
          onClick={event => event.stopPropagation()}
          style={{
            width: 'min(360px, 100%)',
            backgroundColor: '#fff',
            borderRadius: '14px',
            padding: '26px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            textAlign: 'center',
          }}
        >
          <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', borderRadius: '14px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '900', color: '#1a1a1a' }}>
            Log out?
          </h3>
          <p style={{ margin: '0 0 22px', fontSize: '13px', color: '#777', lineHeight: 1.5 }}>
            Are you sure you want to log out of your account?
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: '#f5f5f5', color: '#555', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: '#E53E3E', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
