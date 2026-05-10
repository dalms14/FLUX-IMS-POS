import React, { useState, useEffect } from 'react';
import { FiX, FiAlertCircle } from 'react-icons/fi';

const RefundModal = ({ isOpen, transaction, onClose, onSuccess }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (transaction?.items) {
      setSelectedItems(
        transaction.items.map(item => {
          const originalQuantity = Number(item.quantity || 0);
          const remainingQuantity = Math.max(0, originalQuantity - Number(item.refundedQuantity || 0));
          const unitSubtotal = originalQuantity > 0
            ? Number(item.subtotal || 0) / originalQuantity
            : Number(item.price || 0);
          return {
            ...item,
            quantity: remainingQuantity,
            subtotal: unitSubtotal * remainingQuantity,
            selected: false,
          };
        })
      );
    }
  }, [transaction]);

  const handleSelectItem = (index) => {
    const updated = [...selectedItems];
    if ((Number(updated[index].quantity) || 0) <= 0) return;
    updated[index].selected = !updated[index].selected;
    setSelectedItems(updated);
  };

  const calculateRefundAmount = () => {
    const selected = selectedItems.filter(i => i.selected);
    const subtotal = selected.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    // Calculate tax proportionally
    const transactionSubtotal = transaction?.subtotal || 0;
    const transactionTax = transaction?.tax || 0;
    const refundPercentage = transactionSubtotal > 0 ? subtotal / transactionSubtotal : 0;
    const tax = transactionTax * refundPercentage;
    
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async () => {
    if (selectedItems.filter(i => i.selected).length === 0) {
      setError('Please select at least one item to refund');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a refund reason');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const itemsToRefund = selectedItems
        .filter(i => i.selected)
        .map(item => ({
          productId: item.productId?._id || item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal || item.price * item.quantity,
        }));

      const response = await fetch('http://localhost:5000/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction._id,
          receiptNo: transaction.receiptNo,
          items: itemsToRefund,
          reason,
          refundedBy: user.name || 'System',
          refundedByEmail: user.email || '',
          paymentMethod: transaction.paymentMethod,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to process refund');
      }

      onSuccess?.();
      setSelectedItems([]);
      setReason('');
      onClose();
    } catch (err) {
      console.error('Error processing refund:', err);
      setError(err.message || 'Failed to process refund');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  const refundAmount = calculateRefundAmount();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>
            Process Refund
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            title="Close"
            style={{
              width: '28px', height: '28px', borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.1)',
              backgroundColor: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Transaction Info */}
        <div style={{
          backgroundColor: '#F5F0EB',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Slip No:</strong> {transaction.receiptNo}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Original Total:</strong> ₱{transaction.total?.toLocaleString() || '0'}
          </div>
          <div>
            <strong>Payment Method:</strong> {transaction.paymentMethod}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#FEE',
            color: '#C53030',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            border: '1px solid #C53030',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FiAlertCircle size={16} style={{flexShrink: 0}} />
            {error}
          </div>
        )}

        {/* Items Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '700', marginBottom: '12px', fontSize: '13px' }}>
            Select Items to Refund
          </label>
          <div style={{
            backgroundColor: '#F5F0EB',
            borderRadius: '8px',
            maxHeight: '200px',
            overflow: 'auto',
          }}>
            {selectedItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #E0D5C8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => handleSelectItem(idx)}
                  disabled={loading || (Number(item.quantity) || 0) <= 0}
                  style={{ cursor: (Number(item.quantity) || 0) <= 0 ? 'not-allowed' : 'pointer', width: '18px', height: '18px' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '4px' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    Qty: {item.quantity} | ₱{item.price?.toLocaleString() || '0'} each
                    {Number(item.refundedQuantity || 0) > 0 ? ` | Refunded: ${item.refundedQuantity}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#8B5E3C' }}>
                  ₱{(item.subtotal || 0)?.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Refund Reason */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '700', marginBottom: '8px', fontSize: '13px' }}>
            Refund Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1.5px solid #D4B89A',
              fontSize: '13px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          >
            <option value="">Select a reason...</option>
            <option value="Wrong order">Wrong order</option>
            <option value="Damaged product">Damaged product</option>
            <option value="Customer request">Customer request</option>
            <option value="Incorrect price">Incorrect price</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Refund Summary */}
        <div style={{
          backgroundColor: '#FFF9E6',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          borderLeft: '4px solid #F6AD55',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span>Subtotal:</span>
            <span>₱{refundAmount.subtotal?.toLocaleString() || '0'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span>Tax (proportional):</span>
            <span>₱{refundAmount.tax?.toLocaleString() || '0'}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: '700',
            fontSize: '14px',
            paddingTop: '8px',
            borderTop: '1.5px solid #D4B89A',
          }}>
            <span>Total Refund:</span>
            <span style={{ color: '#C53030' }}>₱{refundAmount.total?.toLocaleString() || '0'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1.5px solid #1a1a1a',
              backgroundColor: '#fff',
              color: '#1a1a1a',
              fontWeight: '700',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedItems.filter(i => i.selected).length === 0 || !reason}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#999' : '#C53030',
              color: '#fff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: (loading || selectedItems.filter(i => i.selected).length === 0 || !reason) ? 0.6 : 1,
            }}
          >
            {loading ? 'Processing...' : 'Process Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundModal;
