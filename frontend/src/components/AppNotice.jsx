import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';

export default function AppNotice({ notice, onDismiss }) {
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);
  if (!notice) return null;
  const success = notice.tone === 'success';
  return createPortal(
    <div role={success ? 'status' : 'alert'} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 5000,
      width: 'min(360px, calc(100vw - 40px))', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '15px', border: '1px solid #E0D5CB', borderLeft: '4px solid #8B5E3C', borderRadius: '8px',
      background: '#fff', color: '#33251D', boxShadow: '0 5px 20px rgba(26,18,8,.12)', fontFamily: 'Segoe UI, sans-serif' }}>
      {success ? <FiCheckCircle size={20} style={{ flexShrink: 0, marginTop: '1px', color: '#8B5E3C' }} /> : <FiAlertCircle size={20} style={{ flexShrink: 0, marginTop: '1px', color: '#8B5E3C' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: '13px' }}>{notice.title}</strong>
        <p id="app-notice-message" style={{ margin: '5px 0 0', fontSize: '12px', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{notice.message}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" style={{ display: 'flex', padding: '2px', border: 'none', background: 'transparent', color: '#8A7A6B', cursor: 'pointer' }}><FiX size={17} /></button>
    </div>, document.body);
}
