import { isOwnerAccount, normalizeRole } from './roles';

export const isReceivingStaff = user => Boolean(user && !user.archived && !isOwnerAccount(user) && ['staff', 'custom'].includes(normalizeRole(user.role)));

export const isAssignableReceiver = user => isReceivingStaff(user) || Boolean(user && !user.archived && !isOwnerAccount(user) && normalizeRole(user.role) === 'admin');

export const canReceivePurchaseOrder = (order, user) => {
  if (!user?.email || user.archived) return false;
  const assigned = String(order.assignedReceiver?.email || '').trim().toLowerCase();
  if (assigned === '__any_staff__') return isReceivingStaff(user);
  return assigned === '__anyone__' || assigned === String(user.email).trim().toLowerCase();
};
