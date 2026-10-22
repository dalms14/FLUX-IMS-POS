import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { buildAccountRoleTemplates } from '../utils/accountRoleTemplates';

export default function AccountRoleTemplates({ selectedId, onApply, refreshKey = 0 }) {
  const [templates, setTemplates] = useState(() => buildAccountRoleTemplates());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    axios.get('http://localhost:5000/api/auth/users', { signal: controller.signal })
      .then(response => {
        if (active) setTemplates(buildAccountRoleTemplates(response.data.data || []));
      })
      .catch(() => {
        if (active) setError('Could not load existing roles. You can still set the role manually.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [refreshKey, retry]);

  return <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #E0D5CB', borderRadius: '8px', background: '#FAF7F4' }}>
    <label htmlFor="account-role-template" style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: '800', color: '#6B5A4C', textTransform: 'uppercase', letterSpacing: '.7px' }}>Reuse an existing role</label>
    <select id="account-role-template" value={selectedId} disabled={loading} onChange={event => {
      const template = templates.find(item => item.id === event.target.value);
      if (template) onApply(template);
    }} aria-describedby="account-role-template-help" style={{ width: '100%', padding: '11px 12px', border: '1px solid #D4B89A', borderRadius: '8px', background: '#fff', fontFamily: 'inherit', fontSize: '13px', color: '#5F3A22', boxSizing: 'border-box' }}>
      <option value="">{loading ? 'Loading existing roles...' : 'Choose a role template (optional)'}</option>
      <optgroup label="Standard role"><option value="standard-staff">Staff - standard POS access</option></optgroup>
      {templates.length > 1 && <optgroup label="Existing custom roles">{templates.slice(1).map(template => <option key={template.id} value={template.id}>{template.label}</option>)}</optgroup>}
    </select>
    <p id="account-role-template-help" style={{ margin: '8px 0 0', color: '#8A7A6B', fontSize: '11px', lineHeight: 1.6 }}>Reuse a role name and page access, then adjust them below if needed. Existing accounts stay unchanged.</p>
    {!loading && !error && templates.length === 1 && <p style={{ margin: '6px 0 0', color: '#8A7A6B', fontSize: '11px' }}>Custom roles will appear here after you create an account with that role.</p>}
    {error && <div role="status" style={{ marginTop: '8px', color: '#8B5E3C', fontSize: '11px', lineHeight: 1.5 }}>{error} <button type="button" onClick={() => setRetry(value => value + 1)} style={{ border: 0, background: 'transparent', color: '#6F4A2F', textDecoration: 'underline', cursor: 'pointer', fontWeight: '700', padding: '4px' }}>Retry</button></div>}
  </div>;
}
