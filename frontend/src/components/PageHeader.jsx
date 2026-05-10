import React from 'react';

const PageHeader = ({ title, description, actions }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '20px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  }}>
    <div style={{ minWidth: 0 }}>
      <h1 style={{
        margin: '0 0 6px',
        fontSize: '28px',
        lineHeight: 1.15,
        color: '#1a1a1a',
        fontWeight: '900',
        letterSpacing: '-0.4px',
      }}>
        {title}
      </h1>
      {description && (
        <p style={{ margin: 0, fontSize: '13px', color: '#8A7A6B', lineHeight: 1.45 }}>
          {description}
        </p>
      )}
    </div>

    {actions && (
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
        {actions}
      </div>
    )}
  </div>
);

export default PageHeader;
