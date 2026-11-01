const isStaffReceiver = user => Boolean(user && !user.archived && String(user.role || '').trim().toLowerCase() === 'staff');

const canReceiveOrder = (order, user) => {
    if (!user || user.archived) return false;
    const assigned = String(order.assignedReceiver?.email || '').trim().toLowerCase();
    if (assigned === '__any_staff__') return isStaffReceiver(user);
    if (assigned === '__anyone__') return true;
    return Boolean(assigned && assigned === String(user.email || '').trim().toLowerCase());
};

module.exports = { isStaffReceiver, canReceiveOrder };
