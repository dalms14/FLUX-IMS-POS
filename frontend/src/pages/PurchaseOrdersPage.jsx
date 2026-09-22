import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FiCheck, FiPackage, FiPlus, FiTruck, FiX } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';

const api = 'http://localhost:5000/api';
const units = ['g', 'ml', 'pcs', 'kg', 'L'];
const categories = ['General', 'Batter', 'Bread', 'Coffee', 'Dairy', 'Fruit', 'Grain', 'Meat', 'Oil', 'Packaging', 'Pastry', 'Powder', 'Sauce', 'Seafood', 'Snack', 'Spice', 'Syrup', 'Tea', 'Topping', 'Utility', 'Vegetable', 'Other'];
const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #D8CABB', borderRadius: '8px', padding: '10px 11px', fontSize: '13px', fontFamily: 'Segoe UI, sans-serif', background: '#fff' };
const label = { display: 'block', marginBottom: '6px', fontSize: '10px', fontWeight: 900, color: '#6B5A4C', textTransform: 'uppercase', letterSpacing: '.65px' };
const primary = { border: 'none', borderRadius: '8px', background: '#8B5E3C', color: '#fff', padding: '10px 13px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px' };
const secondary = { ...primary, background: '#fff', color: '#6F4A2F', border: '1px solid #D4B89A' };

const today = () => new Date().toISOString().slice(0, 10);
const date = value => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' }) : '—';
const number = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const actor = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return { actor: user.name || user.email || 'System', actorEmail: user.email || '' };
  } catch { return { actor: 'System', actorEmail: '' }; }
};
const blankLine = () => ({ inventoryId: '', name: '', unit: 'g', category: 'General', lowStockAt: 0, orderedQuantity: '', unitCost: '' });

const Modal = ({ children, onClose, width = '760px' }) => (
  <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(26,18,8,.55)', display: 'flex', padding: '18px', alignItems: 'center', justifyContent: 'center' }}>
    <div onMouseDown={event => event.stopPropagation()} style={{ width: `min(${width}, 100%)`, maxHeight: '92vh', overflow: 'auto', borderRadius: '14px', background: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,.26)', fontFamily: 'Segoe UI, sans-serif' }}>{children}</div>
  </div>
);

function CreateOrderModal({ inventory, receivers, onClose, onSaved }) {
  const [form, setForm] = useState({ supplierName: '', supplierContact: '', assignedReceiverEmail: '', orderDate: today(), expectedDeliveryDate: '', notes: '', items: [blankLine()] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const updateLine = (index, field, value) => setForm(current => ({ ...current, items: current.items.map((line, i) => i === index ? { ...line, [field]: value } : line) }));
  const chooseItem = (index, value) => {
    if (value === '__new__') {
      setForm(current => ({ ...current, items: current.items.map((line, i) => i === index ? blankLine() : line) }));
      return;
    }
    const item = inventory.find(row => row._id === value);
    if (!item) return;
    setForm(current => ({ ...current, items: current.items.map((line, i) => i === index ? {
      ...line, inventoryId: item._id, name: item.name, unit: item.unit, category: item.category || 'General', lowStockAt: item.lowStockAt || 0,
    } : line) }));
  };
  const submit = async event => {
    event.preventDefault();
    if (!form.supplierName.trim() || !form.assignedReceiverEmail || form.items.some(line => !line.name.trim() || !line.unit || Number(line.orderedQuantity) <= 0)) {
      setError('Enter a supplier, assign a receiving staff member, and complete every line item with a quantity greater than zero.');
      return;
    }
    setSaving(true); setError('');
    try {
      const response = await axios.post(`${api}/purchase-orders`, { ...form, ...actor() });
      onSaved(response.data.order);
    } catch (err) { setError(err.response?.data?.message || 'Could not create the purchase order.'); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose}>
    <form onSubmit={submit}>
      <div style={{ padding: '21px 24px', borderBottom: '1px solid #E8DDD0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <div><p style={{ margin: '0 0 4px', color: '#8B5E3C', fontSize: '10px', fontWeight: 900, letterSpacing: '.8px' }}>PROCUREMENT</p><h2 style={{ margin: 0, fontSize: '20px' }}>New Purchase Order</h2><p style={{ margin: '6px 0 0', color: '#777', fontSize: '12px' }}>Stock will not change until this approved order is received.</p></div>
        <button type="button" onClick={onClose} style={{ ...secondary, height: '34px', padding: '0 11px' }}><FiX /></button>
      </div>
      <div style={{ padding: '22px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '12px', marginBottom: '13px' }}>
          <div><label style={label}>Supplier *</label><input required value={form.supplierName} onChange={e => change('supplierName', e.target.value)} style={input} placeholder="e.g. Metro Food Supply" /></div>
          <div><label style={label}>Supplier Contact</label><input value={form.supplierContact} onChange={e => change('supplierContact', e.target.value)} style={input} placeholder="Phone or contact person" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Assigned Receiving Staff *</label><select required value={form.assignedReceiverEmail} onChange={e => change('assignedReceiverEmail', e.target.value)} style={input}><option value="">Select the staff member who will receive this delivery…</option>{receivers.map(receiver => <option key={receiver._id} value={receiver.email}>{receiver.name || receiver.email} — {receiver.jobRole || receiver.role}</option>)}</select><p style={{ margin: '6px 0 0', color: '#777', fontSize: '11px' }}>Only this assigned staff member can record the actual delivery when it arrives.</p></div>
          <div><label style={label}>Order Date</label><input type="date" value={form.orderDate} onChange={e => change('orderDate', e.target.value)} style={input} /></div>
          <div><label style={label}>Expected Delivery</label><input type="date" value={form.expectedDeliveryDate} onChange={e => change('expectedDeliveryDate', e.target.value)} style={input} /></div>
        </div>
        <label style={label}>Order Items *</label>
        <div style={{ display: 'grid', gap: '10px' }}>
          {form.items.map((line, index) => <div key={index} style={{ padding: '12px', background: '#FAF7F4', border: '1px solid #E8DDD0', borderRadius: '9px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.6fr) .55fr .55fr .7fr 34px', gap: '8px', alignItems: 'end' }}>
              <div><label style={label}>Ingredient / material</label><select value={line.inventoryId || '__new__'} onChange={e => chooseItem(index, e.target.value)} style={input}><option value="__new__">New inventory item…</option>{inventory.map(item => <option key={item._id} value={item._id}>{item.name} ({item.unit})</option>)}</select></div>
              <div><label style={label}>Quantity</label><input type="number" min="0.001" step="any" value={line.orderedQuantity} onChange={e => updateLine(index, 'orderedQuantity', e.target.value)} style={input} /></div>
              <div><label style={label}>Unit Cost</label><input type="number" min="0" step="any" value={line.unitCost} onChange={e => updateLine(index, 'unitCost', e.target.value)} style={input} placeholder="Optional" /></div>
              <div><label style={label}>Unit</label><select value={line.unit} onChange={e => updateLine(index, 'unit', e.target.value)} style={input}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></div>
              <button type="button" title="Remove line" disabled={form.items.length === 1} onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, i) => i !== index) }))} style={{ ...secondary, height: '40px', padding: 0, color: '#C53030', borderColor: '#FED7D7', opacity: form.items.length === 1 ? .45 : 1 }}><FiX /></button>
            </div>
            {!line.inventoryId && <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .65fr .8fr', gap: '8px', marginTop: '8px' }}><input value={line.name} onChange={e => updateLine(index, 'name', e.target.value)} style={input} placeholder="New ingredient name" /><select value={line.category} onChange={e => updateLine(index, 'category', e.target.value)} style={input}>{categories.map(category => <option key={category}>{category}</option>)}</select><input type="number" min="0" value={line.lowStockAt} onChange={e => updateLine(index, 'lowStockAt', e.target.value)} style={input} placeholder="Low-stock alert" /></div>}
          </div>)}
        </div>
        <button type="button" onClick={() => setForm(current => ({ ...current, items: [...current.items, blankLine()] }))} style={{ ...secondary, marginTop: '10px' }}><FiPlus /> Add line item</button>
        <div style={{ marginTop: '14px' }}><label style={label}>Notes</label><textarea value={form.notes} onChange={e => change('notes', e.target.value)} style={{ ...input, minHeight: '66px', resize: 'vertical' }} placeholder="Optional delivery or ordering notes" /></div>
        {error && <p style={{ margin: '14px 0 0', padding: '10px 11px', borderRadius: '8px', color: '#C53030', background: '#FFF5F5', fontSize: '12px', fontWeight: 700 }}>{error}</p>}
      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px solid #E8DDD0', display: 'flex', justifyContent: 'flex-end', gap: '9px' }}><button type="button" onClick={onClose} style={secondary}>Cancel</button><button disabled={saving} style={{ ...primary, opacity: saving ? .65 : 1 }}>{saving ? 'Saving…' : 'Create Draft PO'}</button></div>
    </form>
  </Modal>;
}

function RecordArrivalModal({ order, onClose, onSaved }) {
  const [rows, setRows] = useState(() => order.items.map(item => ({ itemId: item._id, quantity: '', expirationDate: '', note: '' })));
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const update = (index, field, value) => setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const submit = async event => {
    event.preventDefault();
    const validRows = rows.filter(row => Number(row.quantity) > 0);
    if (!validRows.length) return setError('Enter the quantity received for at least one item.');
    setSaving(true); setError('');
    try { const response = await axios.post(`${api}/purchase-orders/${order._id}/record-arrival`, { items: validRows, ...actor() }); onSaved(response.data.order); }
    catch (err) { setError(err.response?.data?.message || 'Could not record this delivery.'); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose} width="700px"><form onSubmit={submit}>
    <div style={{ padding: '21px 24px', borderBottom: '1px solid #E8DDD0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}><div><p style={{ margin: '0 0 4px', color: '#8B5E3C', fontSize: '10px', fontWeight: 900, letterSpacing: '.8px' }}>DELIVERY ARRIVAL</p><h2 style={{ margin: 0, fontSize: '20px' }}>{order.purchaseOrderNo}</h2><p style={{ margin: '6px 0 0', color: '#777', fontSize: '12px' }}>Record supplies physically delivered. Inventory will remain unchanged until Finance, HR, or the Owner approves it.</p></div><button type="button" onClick={onClose} style={{ ...secondary, height: '34px', padding: '0 11px' }}><FiX /></button></div>
    <div style={{ padding: '22px 24px', display: 'grid', gap: '10px' }}>{order.items.map((item, index) => { const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity || 0); return <div key={item._id} style={{ padding: '12px', border: '1px solid #E8DDD0', borderRadius: '9px', background: '#FAF7F4' }}><div style={{ display: 'grid', gridTemplateColumns: '1.4fr .65fr .85fr', gap: '8px', alignItems: 'end' }}><div><b style={{ fontSize: '13px' }}>{item.name}</b><p style={{ margin: '3px 0 0', fontSize: '11px', color: '#777' }}>Remaining: {number(remaining)} {item.unit}</p></div><div><label style={label}>Receive now</label><input type="number" min="0" max={remaining} step="any" value={rows[index].quantity} onChange={e => update(index, 'quantity', e.target.value)} style={input} /></div><div><label style={label}>Expiry date</label><input type="date" value={rows[index].expirationDate} onChange={e => update(index, 'expirationDate', e.target.value)} style={input} /></div></div><input value={rows[index].note} onChange={e => update(index, 'note', e.target.value)} style={{ ...input, marginTop: '8px' }} placeholder="Optional receiving note" /></div>; })}{error && <p style={{ margin: 0, padding: '10px 11px', borderRadius: '8px', color: '#C53030', background: '#FFF5F5', fontSize: '12px', fontWeight: 700 }}>{error}</p>}</div>
    <div style={{ padding: '16px 24px', borderTop: '1px solid #E8DDD0', display: 'flex', justifyContent: 'flex-end', gap: '9px' }}><button type="button" onClick={onClose} style={secondary}>Cancel</button><button disabled={saving} style={{ ...primary, background: '#276749', opacity: saving ? .65 : 1 }}><FiTruck /> {saving ? 'Saving…' : 'Report Arrival'}</button></div>
  </form></Modal>;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]); const [inventory, setInventory] = useState([]); const [receivers, setReceivers] = useState([]); const [status, setStatus] = useState(''); const [loading, setLoading] = useState(true); const [createOpen, setCreateOpen] = useState(false); const [receiving, setReceiving] = useState(null); const [message, setMessage] = useState('');
  const load = useCallback(async () => { try { const [po, stock, users] = await Promise.all([axios.get(`${api}/purchase-orders`), axios.get(`${api}/inventory`), axios.get(`${api}/auth/users`)]); setOrders(po.data); setInventory(stock.data); setReceivers(users.data.data || []); } catch (err) { setMessage('Could not load purchase orders.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => status ? orders.filter(order => order.status === status) : orders, [orders, status]);
  const replace = order => setOrders(current => [order, ...current.filter(row => row._id !== order._id)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  const action = async (order, endpoint) => { try { const response = await axios.post(`${api}/purchase-orders/${order._id}/${endpoint}`, actor()); replace(response.data.order); setMessage(`${order.purchaseOrderNo} ${endpoint === 'approve' ? 'approved' : 'cancelled'}.`); } catch (err) { setMessage(err.response?.data?.message || 'Action could not be completed.'); } };
  const approveArrival = async order => { const receipt = order.pendingReceipts?.find(row => row.status === 'Pending Approval'); if (!receipt) return; try { const response = await axios.post(`${api}/purchase-orders/${order._id}/pending-receipts/${receipt._id}/approve`, actor()); replace(response.data.order); setMessage(`${order.purchaseOrderNo} delivery approved and inventory updated.`); load(); } catch (err) { setMessage(err.response?.data?.message || 'Delivery approval could not be completed.'); } };
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canApproveArrival = String(currentUser.role || '').toLowerCase() === 'owner' || ['finance', 'hr'].includes(String(currentUser.jobRole || '').toLowerCase()) || String(currentUser.email || '').toLowerCase() === 'admin@elicoffee.com' || String(currentUser.userId || '').toUpperCase() === 'ELI001';
  const badge = value => ({ Draft: ['#718096', '#F7FAFC'], Approved: ['#2B6CB0', '#EBF8FF'], 'Arrival Pending Approval': ['#805AD5', '#FAF5FF'], 'Partially Received': ['#D97706', '#FFFAF0'], Received: ['#276749', '#F0FFF4'], Cancelled: ['#C53030', '#FFF5F5'] }[value] || ['#555', '#f5f5f5']);
  return <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F5F0EB', fontFamily: 'Segoe UI, sans-serif' }}><Sidebar /><main className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
    <PageHeader title="Purchase Orders" description="Create supplier orders, record actual deliveries, and approve received stock before inventory changes." actions={<button onClick={() => setCreateOpen(true)} style={primary}><FiPlus /> New Purchase Order</button>} />
    {message && <div style={{ marginBottom: '14px', padding: '11px 13px', borderRadius: '8px', background: '#FDF5EE', border: '1px solid #E0D5CB', color: '#6F4A2F', fontSize: '12px', fontWeight: 700 }}>{message}</div>}
    <section style={{ background: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}><div><label style={label}>Status</label><select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, minWidth: '200px' }}><option value="">All purchase orders</option>{['Draft', 'Approved', 'Arrival Pending Approval', 'Partially Received', 'Received', 'Cancelled'].map(value => <option key={value}>{value}</option>)}</select></div><p style={{ margin: 0, alignSelf: 'end', paddingBottom: '10px', color: '#777', fontSize: '12px', fontWeight: 700 }}>{filtered.length} order{filtered.length === 1 ? '' : 's'}</p></section>
    <section style={{ background: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', overflow: 'hidden' }}><div style={{ minWidth: '900px', display: 'grid', gridTemplateColumns: '1.1fr 1.2fr .8fr 1.1fr 1fr 1.25fr', background: '#1A1208', gap: '12px', padding: '13px 17px', color: '#C4894A', fontSize: '10px', fontWeight: 900, letterSpacing: '.65px' }}>{['PO NUMBER', 'SUPPLIER', 'ORDER DATE', 'EXPECTED', 'STATUS', 'ACTIONS'].map(header => <span key={header}>{header}</span>)}</div><div style={{ overflow: 'auto', minWidth: '900px' }}>{loading ? <p style={{ padding: '35px', textAlign: 'center', color: '#777' }}>Loading purchase orders…</p> : filtered.length === 0 ? <div style={{ padding: '45px', textAlign: 'center', color: '#777' }}><FiPackage size={28} style={{ marginBottom: '8px' }} /><p style={{ margin: 0, fontWeight: 700 }}>No purchase orders found.</p></div> : filtered.map((order, index) => { const [color, background] = badge(order.status); return <div key={order._id} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr .8fr 1.1fr 1fr 1.25fr', gap: '12px', padding: '14px 17px', alignItems: 'center', borderBottom: index === filtered.length - 1 ? 'none' : '1px solid #F0E8E0', background: index % 2 ? '#FAFAF8' : '#fff' }}><div><b style={{ fontSize: '13px' }}>{order.purchaseOrderNo}</b><p style={{ margin: '3px 0 0', fontSize: '10px', color: '#8A7A6B' }}>{order.items.length} item{order.items.length === 1 ? '' : 's'} · Receiver: {order.assignedReceiver?.name || 'Not assigned'}</p></div><span style={{ fontSize: '13px', fontWeight: 700 }}>{order.supplierName}</span><span style={{ fontSize: '12px', color: '#555' }}>{date(order.orderDate)}</span><span style={{ fontSize: '12px', color: '#555' }}>{date(order.expectedDeliveryDate)}</span><span style={{ justifySelf: 'start', padding: '5px 8px', borderRadius: '999px', color, background, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{order.status}</span><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{order.status === 'Draft' && <button onClick={() => action(order, 'approve')} style={{ ...primary, background: '#2B6CB0', padding: '7px 9px' }}><FiCheck /> Approve</button>}{['Approved', 'Partially Received'].includes(order.status) && <button onClick={() => setReceiving(order)} style={{ ...primary, background: '#276749', padding: '7px 9px' }}><FiTruck /> Report Arrival</button>}{order.status === 'Arrival Pending Approval' && canApproveArrival && <button onClick={() => approveArrival(order)} style={{ ...primary, background: '#805AD5', padding: '7px 9px' }}><FiCheck /> Approve Delivery</button>}{['Draft', 'Approved'].includes(order.status) && <button onClick={() => action(order, 'cancel')} style={{ ...secondary, padding: '7px 9px', color: '#C53030', borderColor: '#FED7D7' }}>Cancel</button>}</div></div>; })}</div></section>
  </main>{createOpen && <CreateOrderModal inventory={inventory} receivers={receivers} onClose={() => setCreateOpen(false)} onSaved={order => { replace(order); setCreateOpen(false); setMessage(`${order.purchaseOrderNo} created as a draft.`); }} />}{receiving && <RecordArrivalModal order={receiving} onClose={() => setReceiving(null)} onSaved={order => { replace(order); setReceiving(null); setMessage(`${order.purchaseOrderNo} arrival recorded. Approval is required before inventory changes.`); }} />}</div>;
}
