export const OWNER_ROLE = 'owner';
export const ADMIN_ROLE = 'admin';
export const CUSTOM_ROLE = 'custom';
export const STAFF_ROLE = 'staff';

export const PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'items', label: 'Items and POS' },
  { key: 'products', label: 'Products, Add-ons, Discounts' },
  { key: 'elite_members', label: 'Elite Membership' },
  { key: 'sales', label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'staff', label: 'Users' },
  { key: 'history', label: 'History' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'users', label: 'Create Accounts' },
];

export const DEFAULT_STAFF_PERMISSIONS = ['dashboard', 'items', 'transactions', 'history', 'settings'];
export const DEFAULT_ADMIN_PERMISSIONS = PERMISSIONS.map(permission => permission.key);

export const normalizePermissionDependencies = (permissions = []) => {
  const selected = [...new Set(permissions)];
  return selected.includes('staff') ? selected : selected.filter(key => key !== 'users');
};

export const togglePermissionSelection = (permissions, permission) => normalizePermissionDependencies(
  permissions.includes(permission)
    ? permissions.filter(key => key !== permission)
    : [...permissions, permission]
);

export const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const isOwnerRole = (role) => normalizeRole(role) === OWNER_ROLE;

export const isOwnerAccount = (user = {}) => (
  isOwnerRole(user.role) ||
  String(user.userId || '').trim().toUpperCase() === 'ELI001' ||
  String(user.email || '').trim().toLowerCase() === 'admin@elicoffee.com'
);

export const isAdminRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return [ADMIN_ROLE, OWNER_ROLE].includes(normalizedRole);
};

export const getDefaultPermissions = (role) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === OWNER_ROLE) return DEFAULT_ADMIN_PERMISSIONS;
  if (normalizedRole === ADMIN_ROLE) return DEFAULT_ADMIN_PERMISSIONS;
  return DEFAULT_STAFF_PERMISSIONS;
};

export const hasPermission = (user = {}, permission) => {
  if (!permission) return true;
  if (isOwnerAccount(user)) return true;
  if (permission === 'users' && !hasPermission(user, 'staff')) return false;

  const normalizedRole = normalizeRole(user.role);
  if (normalizedRole === STAFF_ROLE) {
    if (!Array.isArray(user.permissions)) {
      return DEFAULT_STAFF_PERMISSIONS.includes(permission);
    }

    return user.permissions.includes(permission);
  }

  if ([ADMIN_ROLE, CUSTOM_ROLE].includes(normalizedRole)) {
    if (permission === 'elite_members' && normalizedRole === CUSTOM_ROLE && !Array.isArray(user.permissions)) return false;
    const jobRole = String(user.jobRole || '').trim().toLowerCase();
    if (permission === 'purchase_orders' && normalizedRole === CUSTOM_ROLE && ['finance', 'hr'].includes(jobRole)) {
      return true;
    }
    if (!Array.isArray(user.permissions)) {
      return DEFAULT_ADMIN_PERMISSIONS.includes(permission);
    }

    return user.permissions.includes(permission);
  }

  return false;
};

export const getLandingPath = (user = {}) => {
  const landingOptions = [
    ['dashboard', '/dashboard'],
    ['items', '/items'],
    ['sales', '/sales'],
    ['reports', '/reports'],
    ['inventory', '/inventory'],
    ['purchase_orders', '/purchase-orders'],
    ['products', '/products'],
    ['elite_members', '/elite-members'],
    ['transactions', '/transactions'],
    ['staff', '/staff'],
    ['history', '/history'],
    ['settings', '/settings'],
  ];

  return landingOptions.find(([permission]) => hasPermission(user, permission))?.[1] || '/profile';
};

export const canManageEliteMembers = (user = {}) => Boolean(!user.archived && hasPermission(user, 'elite_members'));
