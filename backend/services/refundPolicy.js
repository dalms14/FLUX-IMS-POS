const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

// Use the persisted sale timestamp and server time, never a client-supplied date.
function refundWindow(transaction, now = Date.now()) {
    const soldAt = transaction.createdAt == null ? NaN : new Date(transaction.createdAt).getTime();
    if (!Number.isFinite(soldAt) || soldAt > now) {
        return { expiresAt: null, expired: false, unavailableReason: 'This receipt needs review because its sale date is missing or invalid.' };
    }
    const expiresAt = soldAt + REFUND_WINDOW_MS;
    const expired = now >= expiresAt;
    return { expiresAt: new Date(expiresAt).toISOString(), expired,
        unavailableReason: expired ? 'Refund period expired. Refunds are allowed only within 24 hours of the original sale.' : '' };
}

function assertRefundWindow(transaction) {
    const window = refundWindow(transaction);
    if (window.unavailableReason) throw Object.assign(new Error(window.unavailableReason), { status: 409 });
}

module.exports = { refundWindow, assertRefundWindow };
