const isStaffReceiver = user => {
    if (!user || user.archived) return false;
    const isOwner = String(user.email || '').trim().toLowerCase() === 'admin@elicoffee.com' || String(user.userId || '').trim().toUpperCase() === 'ELI001';
    return !isOwner && ['staff', 'custom'].includes(String(user.role || '').trim().toLowerCase());
};

const canReceiveOrder = (order, user) => {
    if (!user || user.archived) return false;
    const assigned = String(order.assignedReceiver?.email || '').trim().toLowerCase();
    if (assigned === '__any_staff__') return isStaffReceiver(user);
    if (assigned === '__anyone__') return true;
    return Boolean(assigned && assigned === String(user.email || '').trim().toLowerCase());
};

const isAssignableReceiver = user => isStaffReceiver(user) || Boolean(user && !user.archived
    && String(user.role || '').trim().toLowerCase() === 'admin'
    && String(user.email || '').trim().toLowerCase() !== 'admin@elicoffee.com'
    && String(user.userId || '').trim().toUpperCase() !== 'ELI001');

module.exports = { isStaffReceiver, isAssignableReceiver, canReceiveOrder };
