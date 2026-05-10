export const isAdminRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ['admin', 'owner'].includes(normalizedRole);
};
