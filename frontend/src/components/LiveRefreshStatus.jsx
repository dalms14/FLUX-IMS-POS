import React from 'react';

export default function LiveRefreshStatus({ status }) {
    const { error, lastUpdated, refreshing, loading, refresh, paused, enabled } = status;
    return <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '-6px 0 18px', fontSize: '12px', color: '#8A7A6B' }}>
        <span>{paused ? 'Updates paused while this form is open.' : !enabled ? 'Correct the date range to resume updates.' : refreshing ? (loading ? 'Loading data...' : 'Updating...') : 'Updates automatically every 15 seconds.'}</span>
        {lastUpdated && <span>Last updated {lastUpdated.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
        {!paused && enabled && <button type="button" onClick={refresh} disabled={refreshing} style={{ border: '1px solid #D4B89A', borderRadius: '6px', padding: '5px 9px', color: '#805737', background: '#fff', cursor: 'pointer' }}>{error ? 'Retry' : 'Refresh'}</button>}
        {error && <span role="alert" style={{ flexBasis: '100%', color: '#A32C2C' }}>{error}</span>}
    </div>;
}
