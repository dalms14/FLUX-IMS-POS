import React from 'react';

// ── RECEIPT VIEW MODAL ──
// Shows after a successful transaction
// Add this component to Items.jsx and replace the SuccessModal

const WIFI_NAME = 'Eli Coffee - Antipolo';
const WIFI_PASSWORD = 'EliAntipolo2026';
const STORE_ADDRESS = '2F-07 Pobel Building, M.L. Quezon Ave. Ext\nAntipolo City, Rizal';
const STORE_CONTACT = '0969 086 1860';
const STORE_NAME = 'Eli Coffee Antipolo - Events + Cafe';
const TERMINAL = 'POS-01';

const LEGACY_DISCOUNTS = {
    elite: { name: 'Elite Member', percentage: 20, code: 'elite' },
    pagibig: { name: 'Pag-IBIG', percentage: 20, code: 'pagibig' },
    pwd_senior: { name: 'PWD/Senior Citizen', percentage: 20, code: 'pwd_senior' },
};

const formatDiscountLabel = (discount) => (
    discount ? `${discount.name} ${Number(discount.percentage || 0).toLocaleString()}%` : ''
);

const ReceiptViewModal = ({ receiptNo, orderNo, serviceType, cart, subtotal, discount, total, paymentMethod, amountTendered, change, gcashReference, cashier, customerType, eliteMember, selectedDiscount, discountInfo, createdAt, closeLabel = 'New Order', onClose }) => {
    const now = createdAt ? new Date(createdAt) : new Date();
    const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });

    // VAT-inclusive prices are displayed as subtotal before VAT + VAT.
    const vatAmount = Math.round((subtotal * 12) / 112);
    const subtotalBeforeVat = Math.max(0, subtotal - vatAmount);
    const eligibleDiscountSubtotal = cart.reduce((sum, item) => (
        sum + ((item.price || 0) * Math.min(item.discountEligibleQuantity || 0, item.quantity || 0))
    ), 0);
    const discountMeta = selectedDiscount || discountInfo || LEGACY_DISCOUNTS[customerType] || null;
    const discountLabel = formatDiscountLabel(discountMeta);
    const isPwdSeniorDiscount = discountMeta?.code === 'pwd_senior' || customerType === 'pwd_senior';

    const divider = (dashed = false) => (
        <div style={{
            borderTop: dashed ? '1px dashed #ccc' : '1px solid #ccc',
            margin: '10px 0',
        }} />
    );

    const row = (label, value, bold = false) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px', fontWeight: bold ? '700' : '400' }}>
            <span style={{ color: bold ? '#1a1a1a' : '#333' }}>{label}</span>
            <span style={{ color: bold ? '#1a1a1a' : '#333' }}>{value}</span>
        </div>
    );

    return (
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 4000, padding: '20px',
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                width: '360px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                fontFamily: "'Courier New', Courier, monospace",
            }}>
                {/* Receipt Content */}
                <div style={{ padding: '28px 24px' }}>

                    {/* Logo & Store Info */}
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                            <img
                                src="/eli-coffee-logo.png"
                                alt="Eli Coffee Logo"
                                style={{ width: '128px', height: '128px', objectFit: 'contain', display: 'block' }}
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 4px', color: '#1a1a1a' }}>{STORE_NAME}</p>
                        <p style={{ fontSize: '11px', color: '#555', margin: '0 0 2px', whiteSpace: 'pre-line', lineHeight: '1.5' }}>{STORE_ADDRESS}</p>
                        <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>Contact: {STORE_CONTACT}</p>
                    </div>

                    {divider(true)}

                    {/* Transaction Info */}
                    <div style={{ fontSize: '11px', color: '#333', lineHeight: '1.8' }}>
                        {orderNo && <p style={{ margin: '0 0 2px' }}><strong>Order No:</strong> {orderNo}</p>}
                        <p style={{ margin: '0 0 2px' }}><strong>Slip No:</strong> {receiptNo}</p>
                        <p style={{ margin: '0 0 2px' }}><strong>Service:</strong> {serviceType || 'Dine In'}</p>
                        <p style={{ margin: '0 0 2px' }}><strong>Date:</strong> {dateStr} | <strong>Time:</strong> {timeStr}</p>
                        <p style={{ margin: '0 0 2px' }}><strong>Cashier:</strong> {cashier || '[ Staff Name ]'}</p>
                        <p style={{ margin: '0 0 2px' }}><strong>Terminal:</strong> {TERMINAL}</p>
                        {customerType === 'elite' && eliteMember && (
                            <p style={{ margin: '0 0 2px', color: '#276749' }}><strong>Elite Member:</strong> {eliteMember.name} ({eliteMember.idNumber})</p>
                        )}
                        {customerType !== 'elite' && discountLabel && (
                            <p style={{ margin: '0 0 2px', color: '#276749' }}><strong>Discount Type:</strong> {discountLabel}</p>
                        )}
                    </div>

                    {divider(true)}

                    {/* Items */}
                    <div style={{ marginBottom: '4px' }}>
                        {cart.map((item, i) => {
                            const label = `${item.name}${item.selectedVariant ? ` (${item.selectedVariant})` : ''} | ${item.size === 'platter' ? 'Platter' : 'Solo'}`;
                            const refundedQuantity = Number(item.refundedQuantity || 0);
                            return (
                                <div key={i} style={{ marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ flex: 1, paddingRight: '8px', color: '#1a1a1a' }}>{label}</span>
                                        <span style={{ fontWeight: '600', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                                            ₱{(item.price * item.quantity).toLocaleString()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#888', paddingLeft: '8px' }}>
                                        {item.quantity}x ₱{item.price.toLocaleString()}
                                        {isPwdSeniorDiscount && item.discountEligibleQuantity > 0 && (
                                            <>
                                                <br />
                                                PWD/Senior discount qty: {item.discountEligibleQuantity}
                                            </>
                                        )}
                                        {refundedQuantity > 0 && (
                                            <>
                                                <br />
                                                Refunded qty: {refundedQuantity}
                                            </>
                                        )}
                                        {item.upgrades?.length > 0 && (
                                            <>
                                                <br />
                                                + {item.upgrades.map(u => u.name).join(', ')}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {divider(true)}

                    {/* Totals */}
                    {row('Subtotal:', `₱${subtotalBeforeVat.toLocaleString()}`)}
                    {row(`VAT (12%):`, `₱${vatAmount.toLocaleString()}`)}
                    {isPwdSeniorDiscount && row('PWD/Senior eligible:', `₱${eligibleDiscountSubtotal.toLocaleString()}`)}
                    {row(`Discount${discountLabel ? ` (${discountLabel})` : ' (None)'}:`, discount > 0 ? `-₱${discount.toLocaleString()}` : '₱0.00')}

                    {divider()}

                    {/* Total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#1a1a1a', margin: '8px 0' }}>
                        <span>TOTAL AMOUNT:</span>
                        <span>₱{total.toLocaleString()}</span>
                    </div>

                    {divider()}

                    {/* Payment */}
                    <div style={{ fontSize: '11px', color: '#333', lineHeight: '1.8' }}>
                        <p style={{ margin: '0 0 2px' }}><strong>Mode of Payment:</strong> {paymentMethod}</p>
                        {paymentMethod === 'GCash' && gcashReference && (
                            <p style={{ margin: '0 0 2px' }}><strong>Reference No:</strong> {gcashReference}</p>
                        )}
                        {paymentMethod === 'Cash' && (
                            <>
                                <p style={{ margin: '0 0 2px' }}><strong>Amount Tendered:</strong> ₱{amountTendered?.toLocaleString()}</p>
                                <p style={{ margin: '0 0 2px' }}><strong>Change:</strong> ₱{change?.toLocaleString()}</p>
                            </>
                        )}
                    </div>

                    {divider(true)}

                    {/* WiFi Info */}
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#555', lineHeight: '1.8', marginBottom: '8px' }}>
                        <p style={{ margin: '0 0 2px' }}><strong>WiFi Name:</strong> {WIFI_NAME}</p>
                        <p style={{ margin: '0 0 2px' }}><strong>WiFi Password:</strong> {WIFI_PASSWORD}</p>
                        <p style={{ margin: '0 0 2px' }}>System Powered by: <strong>FLUX POS</strong></p>
                        <p style={{ margin: 0 }}>Facebook: <strong>ELI Coffee - Antipolo</strong></p>
                    </div>

                    {divider(true)}

                    {/* Thank you */}
                    <p style={{ textAlign: 'center', fontSize: '12px', fontStyle: 'italic', color: '#555', margin: '8px 0 0' }}>
                        "Thank you! Come again."
                    </p>
                </div>

                {/* Action Buttons */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #eee',
                    display: 'flex', gap: '10px',
                    backgroundColor: '#fafafa',
                    borderRadius: '0 0 12px 12px',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '12px',
                            backgroundColor: '#8B5E3C', color: '#fff',
                            border: 'none', borderRadius: '8px',
                            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                        }}
                    >
                        {closeLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptViewModal;
