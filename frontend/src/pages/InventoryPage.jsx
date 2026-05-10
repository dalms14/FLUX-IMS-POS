import React, { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import {
  FiAlertTriangle,
  FiEdit2,
  FiMinus,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';

const cardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E0D5CB',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1.5px solid #D8CABB',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Segoe UI, sans-serif',
  backgroundColor: '#fff',
};

const labelStyle = {
  display: 'block',
  marginBottom: '7px',
  fontSize: '11px',
  color: '#6B5A4C',
  fontWeight: '900',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
};

const tableHeaderStyle = {
  margin: 0,
  fontSize: '11px',
  color: '#C4894A',
  fontWeight: '900',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
};

const primaryButtonStyle = {
  padding: '11px 14px',
  backgroundColor: '#8B5E3C',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '900',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
};

const secondaryButtonStyle = {
  padding: '11px 14px',
  backgroundColor: '#fff',
  color: '#6F4A2F',
  border: '1px solid #D4B89A',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '900',
  cursor: 'pointer',
};

const KPICard = ({ title, value, detail, icon, color }) => (
  <div style={{ ...cardStyle, padding: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 7px', fontSize: '10px', color: '#777', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.7px' }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: '26px', color, fontWeight: '900', lineHeight: 1.05 }}>
          {value}
        </p>
      </div>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
    </div>
    {detail && <p style={{ margin: '9px 0 0', fontSize: '11px', color: '#999', lineHeight: 1.35 }}>{detail}</p>}
  </div>
);

const ModalShell = ({ children, width = '420px', zIndex = 1000 }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(26,18,8,0.52)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex,
    padding: '20px',
  }}>
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '28px',
      width,
      maxWidth: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      fontFamily: 'Segoe UI, sans-serif',
    }}>
      {children}
    </div>
  </div>
);

const ItemModal = ({ item, onConfirm, onClose }) => {
  const [formData, setFormData] = useState(item || {
    name: '',
    unit: 'g',
    stock: 0,
    lowStockAt: 500,
    category: 'General',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'stock' || name === 'lowStockAt' ? parseFloat(value) || 0 : value,
    }));
    setError('');
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }
    if (!formData.unit.trim()) {
      setError('Unit is required');
      return;
    }
    if (!item && Number(formData.stock) < 0) {
      setError('Opening stock cannot be negative');
      return;
    }
    onConfirm(formData);
  };

  return (
    <ModalShell width="460px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#1a1a1a' }}>
            {item ? 'Edit Inventory Item' : 'Add Inventory Item'}
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#8A7A6B' }}>
            {item
              ? 'Update item details and alert threshold. Stock is changed through Stock In or sales deductions.'
              : 'Register a new ingredient and its opening stock quantity.'}
          </p>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiX size={16} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Item Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Chicken Breast" style={inputStyle} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Unit</label>
          <select name="unit" value={formData.unit} onChange={handleChange} style={inputStyle}>
            <option value="g">Grams (g)</option>
            <option value="ml">Milliliters (ml)</option>
            <option value="pcs">Pieces (pcs)</option>
            <option value="kg">Kilograms (kg)</option>
            <option value="L">Liters (L)</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>{item ? 'Current Stock (Read Only)' : 'Opening Stock'}</label>
          <input
            type="number"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            disabled={Boolean(item)}
            style={{
              ...inputStyle,
              backgroundColor: item ? '#F7F3EF' : '#fff',
              color: item ? '#8A7A6B' : '#1a1a1a',
              cursor: item ? 'not-allowed' : 'text',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Low Stock At</label>
          <input type="number" name="lowStockAt" value={formData.lowStockAt} onChange={handleChange} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <input type="text" name="category" value={formData.category} onChange={handleChange} placeholder="e.g. Meat, Sauce" style={inputStyle} />
        </div>
      </div>

      {error && (
        <div style={{ color: '#C53030', fontSize: '13px', marginBottom: '16px', padding: '11px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '700' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
        <button onClick={handleSubmit} style={{ ...primaryButtonStyle, flex: 1 }}>{item ? 'Update Item' : 'Add Item'}</button>
      </div>
    </ModalShell>
  );
};

const StockInModal = ({ item, onConfirm, onClose }) => {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const adjustmentValue = parseFloat(adjustment) || 0;

  const handleConfirm = () => {
    if (adjustmentValue <= 0) {
      setError('Stock-in quantity must be greater than 0');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a stock-in reason');
      return;
    }
    onConfirm({ quantity: adjustmentValue, adjustment: adjustmentValue, reason });
  };

  return (
    <ModalShell width="400px" zIndex={1001}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#1a1a1a' }}>Stock In</h2>
          <p style={{ fontSize: '12px', color: '#8A7A6B', margin: '5px 0 0' }}>
            Add newly received supplies for {item.name}. Sales transactions deduct stock automatically.
          </p>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiX size={16} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Quantity Received</label>
        <input type="number" value={adjustment} onChange={e => { setAdjustment(e.target.value); setError(''); }} placeholder={`Enter received ${item.unit}`} min="0" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Stock-In Reason</label>
        <select value={reason} onChange={e => { setReason(e.target.value); setError(''); }} style={inputStyle}>
          <option value="">Select a reason...</option>
          <option value="New supplies received">New Supplies Received</option>
          <option value="Supplier delivery">Supplier Delivery</option>
          <option value="Restock">Restock</option>
        </select>
      </div>

      {error && (
        <div style={{ color: '#C53030', fontSize: '13px', marginBottom: '16px', padding: '11px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '700' }}>
          {error}
        </div>
      )}

      {adjustmentValue > 0 && (
        <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', fontWeight: '800', color: '#276749' }}>
          New stock: {item.stock + adjustmentValue} {item.unit}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
        <button onClick={handleConfirm} style={{ ...primaryButtonStyle, flex: 1 }}>Add Stock</button>
      </div>
    </ModalShell>
  );
};

const StockOutModal = ({ item, onConfirm, onClose }) => {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const adjustmentValue = parseFloat(adjustment) || 0;
  const finalReason = reason === 'Other' ? customReason.trim() : reason;

  const handleConfirm = () => {
    if (adjustmentValue <= 0) {
      setError('Stock-out quantity must be greater than 0');
      return;
    }
    if (adjustmentValue > Number(item.stock || 0)) {
      setError(`Cannot deduct more than current stock (${item.stock} ${item.unit})`);
      return;
    }
    if (!finalReason) {
      setError('Please provide a stock-out reason');
      return;
    }
    onConfirm({ quantity: adjustmentValue, adjustment: adjustmentValue, reason: finalReason });
  };

  return (
    <ModalShell width="400px" zIndex={1001}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#1a1a1a' }}>Stock Out</h2>
          <p style={{ fontSize: '12px', color: '#8A7A6B', margin: '5px 0 0' }}>
            Deduct damaged, lost, expired, or counted-down stock for {item.name}.
          </p>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiX size={16} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Quantity To Deduct</label>
        <input type="number" value={adjustment} onChange={e => { setAdjustment(e.target.value); setError(''); }} placeholder={`Max ${item.stock} ${item.unit}`} min="0" max={item.stock} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Stock-Out Reason</label>
        <select value={reason} onChange={e => { setReason(e.target.value); setError(''); }} style={inputStyle}>
          <option value="">Select a reason...</option>
          <option value="Damaged stock">Damaged Stock</option>
          <option value="Expired stock">Expired Stock</option>
          <option value="Theft or loss">Theft or Loss</option>
          <option value="Inventory count correction">Inventory Count Correction</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {reason === 'Other' && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Custom Reason</label>
          <input type="text" value={customReason} onChange={e => { setCustomReason(e.target.value); setError(''); }} placeholder="Enter reason" style={inputStyle} />
        </div>
      )}

      {error && (
        <div style={{ color: '#C53030', fontSize: '13px', marginBottom: '16px', padding: '11px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '700' }}>
          {error}
        </div>
      )}

      {adjustmentValue > 0 && adjustmentValue <= Number(item.stock || 0) && (
        <div style={{ backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', fontWeight: '800', color: '#9B2C2C' }}>
          New stock: {item.stock - adjustmentValue} {item.unit}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
        <button onClick={handleConfirm} style={{ ...primaryButtonStyle, flex: 1, backgroundColor: '#C53030' }}>Deduct Stock</button>
      </div>
    </ModalShell>
  );
};

const buildStats = (inventoryItems) => ({
  totalItems: inventoryItems.length,
  lowStockCount: inventoryItems.filter(item => item.stock > 0 && item.stock <= item.lowStockAt).length,
  outOfStockCount: inventoryItems.filter(item => item.stock === 0).length,
  totalInventoryValue: inventoryItems.reduce((sum, item) => sum + (Number(item.stock) || 0), 0),
});

const getAuditActor = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      actor: user.name || user.email || 'System',
      actorEmail: user.email || '',
    };
  } catch {
    return { actor: 'System', actorEmail: '' };
  }
};

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalInventoryValue: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const updateInventoryState = useCallback((inventoryItems, inventoryStats) => {
    setItems(inventoryItems);
    setStats(inventoryStats || buildStats(inventoryItems));

    const uniqueCategories = [...new Set(inventoryItems.map(item => item.category).filter(Boolean))];
    setCategories(uniqueCategories);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inventoryRes, statsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/inventory'),
          axios.get('http://localhost:5000/api/inventory-stats'),
        ]);

        updateInventoryState(inventoryRes.data, statsRes.data);
      } catch (err) {
        console.error('Error fetching inventory:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [updateInventoryState]);

  useEffect(() => {
    let filtered = items;

    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (statusFilter === 'low') {
      filtered = filtered.filter(item => item.stock > 0 && item.stock <= item.lowStockAt);
    } else if (statusFilter === 'out') {
      filtered = filtered.filter(item => item.stock === 0);
    } else if (statusFilter === 'ok') {
      filtered = filtered.filter(item => item.stock > item.lowStockAt);
    }

    setFilteredItems(filtered);
  }, [items, searchQuery, categoryFilter, statusFilter]);

  const handleAddItem = async (formData) => {
    try {
      const response = await axios.post('http://localhost:5000/api/inventory', {
        ...formData,
        ...getAuditActor(),
      });
      updateInventoryState([...items, response.data.item]);
      setShowModal(false);
    } catch (err) {
      console.error('Error adding item:', err);
      alert(err.response?.data?.message || 'Failed to add item');
    }
  };

  const handleUpdateItem = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        unit: formData.unit,
        lowStockAt: formData.lowStockAt,
        category: formData.category,
        ...getAuditActor(),
      };
      const response = await axios.put(`http://localhost:5000/api/inventory/${selectedItem._id}`, payload);
      updateInventoryState(items.map(item => item._id === selectedItem._id ? response.data.item : item));
      setShowModal(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Error updating item:', err);
      alert(err.response?.data?.message || 'Failed to update item');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this inventory item?')) return;

    try {
      await axios.delete(`http://localhost:5000/api/inventory/${id}`, {
        data: getAuditActor(),
      });
      updateInventoryState(items.filter(item => item._id !== id));
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item');
    }
  };

  const handleAdjustStock = async (adjustment) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/inventory/${adjustItem._id}/stock-in`, {
        ...adjustment,
        ...getAuditActor(),
      });
      updateInventoryState(items.map(item => item._id === adjustItem._id ? response.data.item : item));
      setShowAdjustModal(false);
      setAdjustItem(null);
    } catch (err) {
      console.error('Error adding stock:', err);
      alert(err.response?.data?.message || 'Failed to add stock');
    }
  };

  const handleStockOut = async (adjustment) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/inventory/${adjustItem._id}/stock-out`, {
        ...adjustment,
        ...getAuditActor(),
      });
      updateInventoryState(items.map(item => item._id === adjustItem._id ? response.data.item : item));
      setShowStockOutModal(false);
      setAdjustItem(null);
    } catch (err) {
      console.error('Error deducting stock:', err);
      alert(err.response?.data?.message || 'Failed to deduct stock');
    }
  };

  const getStockStatus = (item) => {
    if (item.stock === 0) return { label: 'Out of Stock', color: '#C53030', bg: '#FFF5F5', border: '#FED7D7' };
    if (item.stock <= item.lowStockAt) return { label: 'Low Stock', color: '#D97706', bg: '#FFFAF0', border: '#FEEBC8' };
    return { label: 'In Stock', color: '#276749', bg: '#F0FFF4', border: '#C6F6D5' };
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <main className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <PageHeader
          title="Inventory"
          description="Monitor ingredient stock. Add received supplies through Stock In; record damage, theft, loss, or count corrections through Stock Out."
          actions={
          <button onClick={() => { setSelectedItem(null); setShowModal(true); }} style={primaryButtonStyle}>
            <FiPlus size={15} /> Add Item
          </button>
          }
        />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <KPICard title="Total Items" value={stats.totalItems} detail="Inventory ingredients tracked" icon={<FiPackage size={21} />} color="#8B5E3C" />
          <KPICard title="Low Stock" value={stats.lowStockCount} detail="Above zero but below threshold" icon={<FiAlertTriangle size={21} />} color="#D97706" />
          <KPICard title="Out Of Stock" value={stats.outOfStockCount} detail="Ingredients needing restock" icon={<FiX size={21} />} color="#C53030" />
          <KPICard title="Total Stock Units" value={stats.totalInventoryValue} detail="Combined on-hand quantity" icon={<FiTrendingUp size={21} />} color="#276749" />
        </section>

        <section style={{ ...cardStyle, padding: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) repeat(2, minmax(170px, 220px))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Search</label>
              <div style={{ position: 'relative' }}>
                <FiSearch size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A7A6B' }} />
                <input type="text" placeholder="Search item name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, paddingLeft: '36px' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={inputStyle}>
                <option value="">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
                <option value="">All Status</option>
                <option value="ok">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#999' }}>
            Showing {filteredItems.length} of {items.length}
          </p>
        </section>

        <section style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr 1.1fr 174px', gap: '12px', padding: '14px 18px', backgroundColor: '#1A1208', minWidth: '820px' }}>
            {['Item', 'Category', 'Stock', 'Unit', 'Status', 'Actions'].map(header => (
              <p key={header} style={{ ...tableHeaderStyle, textAlign: header === 'Actions' ? 'center' : 'left' }}>{header}</p>
            ))}
          </div>

          <div style={{ overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '42px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>Loading inventory...</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '42px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No inventory items found.</div>
            ) : (
              <div style={{ minWidth: '820px' }}>
                {filteredItems.map((item, index) => {
                  const status = getStockStatus(item);
                  return (
                    <div
                      key={item._id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr 1.1fr 174px',
                        gap: '12px',
                        padding: '14px 18px',
                        alignItems: 'center',
                        backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8',
                        borderBottom: index === filteredItems.length - 1 ? 'none' : '1px solid #F0E8E0',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '900', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#8B5E3C', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                          Alert at {item.lowStockAt} {item.unit}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#555', fontWeight: '700' }}>{item.category || 'General'}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '900' }}>{item.stock?.toLocaleString?.() || item.stock}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#777', fontWeight: '700' }}>{item.unit}</p>
                      <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '5px 9px', borderRadius: '999px', backgroundColor: status.bg, color: status.color, border: `1px solid ${status.border}`, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
                        {status.label}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => { setAdjustItem(item); setShowAdjustModal(true); }} title="Stock In" style={{ width: '32px', height: '32px', borderRadius: '7px', backgroundColor: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiPlus size={14} />
                        </button>
                        <button onClick={() => { setAdjustItem(item); setShowStockOutModal(true); }} title="Stock Out" style={{ width: '32px', height: '32px', borderRadius: '7px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiMinus size={14} />
                        </button>
                        <button onClick={() => { setSelectedItem(item); setShowModal(true); }} title="Edit" style={{ width: '32px', height: '32px', borderRadius: '7px', backgroundColor: '#FFFAF0', color: '#D97706', border: '1px solid #FEEBC8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiEdit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteItem(item._id)} title="Delete" style={{ width: '32px', height: '32px', borderRadius: '7px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {showModal && (
        <ItemModal
          item={selectedItem}
          onConfirm={selectedItem ? handleUpdateItem : handleAddItem}
          onClose={() => { setShowModal(false); setSelectedItem(null); }}
        />
      )}

      {showAdjustModal && adjustItem && (
        <StockInModal
          item={adjustItem}
          onConfirm={handleAdjustStock}
          onClose={() => { setShowAdjustModal(false); setAdjustItem(null); }}
        />
      )}

      {showStockOutModal && adjustItem && (
        <StockOutModal
          item={adjustItem}
          onConfirm={handleStockOut}
          onClose={() => { setShowStockOutModal(false); setAdjustItem(null); }}
        />
      )}
    </div>
  );
};

export default InventoryPage;
