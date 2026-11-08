import React from 'react';

export default function PurchaseOrderDetailsModal({ order, onClose }) {
  const formatDate = value => value ? new Date(value).toLocaleDateString('en-PH') : 'Not set';
  const quantity = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const cell = { padding: '10px', textAlign: 'left', borderBottom: '1px solid #E8DDD0' };
  return <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(26,18,8,.55)', padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <section role="dialog" aria-modal="true" aria-label="Purchase order details" onMouseDown={event => event.stopPropagation()} style={{ width: 'min(740px, 100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: '12px', padding: '24px', fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}><div><h2 style={{ margin: '0 0 6px', fontSize: '20px' }}>{order.purchaseOrderNo}</h2><span style={{ color: '#777', fontSize: '13px' }}>{order.status} · View only</span></div><button onClick={onClose} aria-label="Close details" style={{ border: '1px solid #D8CABB', borderRadius: '6px', background: '#fff', padding: '7px 10px', cursor: 'pointer' }}>Close</button></div>
      <div style={{ fontSize: '13px', lineHeight: 1.7, margin: '18px 0' }}>
        <div><strong>Supplier:</strong> {order.supplierName}{order.supplierContact ? ` · ${order.supplierContact}` : ''}</div>
        {order.supplierEmail && <div><strong>Supplier email:</strong> {order.supplierEmail}</div>}
        <div><strong>Order date:</strong> {formatDate(order.orderDate)}</div>
        <div><strong>Expected delivery:</strong> {formatDate(order.expectedDeliveryDate)}</div>
        <div><strong>Assigned receiver:</strong> {order.assignedReceiver?.name || 'Not assigned'}</div>
      </div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: '460px', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: '#F5F0EB' }}><tr>{['Expected item', 'Ordered', 'Received', 'Remaining'].map(title => <th key={title} style={cell}>{title}</th>)}</tr></thead>
        <tbody>{order.items.map((item, index) => <tr key={item._id || index}><td style={cell}>{item.name}</td><td style={cell}>{quantity(item.orderedQuantity)} {item.unit}</td><td style={cell}>{quantity(item.receivedQuantity)} {item.unit}</td><td style={cell}>{quantity(Math.max(0, item.orderedQuantity - (item.receivedQuantity || 0)))} {item.unit}</td></tr>)}</tbody>
      </table></div>
      {order.items.some(item => Number(item.unitCost) > 0) && <p style={{ fontSize: '13px' }}><strong>Order total:</strong> ₱{quantity(order.items.reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.orderedQuantity || 0), 0))}</p>}
      {(order.pendingReceipts || []).filter(receipt => receipt.status === 'Pending Approval').map((receipt, index) => <div key={receipt._id || index} style={{ marginTop: '18px', fontSize: '13px' }}>
        <strong>Delivery awaiting approval</strong>
        <p style={{ margin: '6px 0' }}>Reported by {receipt.reportedBy || 'Staff'}</p>
        <ul style={{ paddingLeft: '20px' }}>{receipt.items.map((item, itemIndex) => <li key={item._id || itemIndex}>{item.name}: {quantity(item.quantity)} {order.items.find(line => String(line._id) === String(item.itemId))?.unit}{item.expirationDate ? ` · Expiry: ${formatDate(item.expirationDate)}` : ''}</li>)}</ul>
      </div>)}
      {order.notes && <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}><strong>Notes:</strong> {order.notes}</p>}
    </section>
  </div>;
}
