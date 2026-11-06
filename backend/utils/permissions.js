const all = ['dashboard', 'items', 'products', 'elite_members', 'sales', 'inventory', 'purchase_orders', 'transactions', 'staff', 'history', 'reports', 'settings', 'users'];
const staff = ['dashboard', 'items', 'transactions', 'history', 'settings'];
const role = user => String(user?.role || '').trim().toLowerCase();
const isOwner = user => Boolean(user && (role(user) === 'owner' || String(user.userId || '').toUpperCase() === 'ELI001' || String(user.email || '').toLowerCase() === 'admin@elicoffee.com'));
const hasPermission = (user, key) => {
    if (!user || user.archived) return false;
    if (isOwner(user)) return true;
    if (key === 'users' && !hasPermission(user, 'staff')) return false;
    if (!['staff', 'admin', 'custom'].includes(role(user))) return false;
    if (key === 'elite_members' && role(user) === 'custom' && !Array.isArray(user.permissions)) return false;
    if (key === 'purchase_orders' && role(user) === 'custom' && ['finance', 'hr'].includes(String(user.jobRole || '').toLowerCase())) return true;
    return (Array.isArray(user.permissions) ? user.permissions : role(user) === 'staff' ? staff : all).includes(key);
};
const canManageAccounts = user => isOwner(user) || (role(user) === 'admin' && hasPermission(user, 'users'));
const canManageEliteMembers = user => hasPermission(user, 'elite_members');
module.exports = { all, role, isOwner, hasPermission, canManageAccounts, canManageEliteMembers };
