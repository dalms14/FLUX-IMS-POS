import { DEFAULT_STAFF_PERMISSIONS, PERMISSIONS, hasPermission } from './roles';

export function buildAccountRoleTemplates(users = []) {
  const templates = new Map();
  for (const user of users) {
    if (user.archived || String(user.role || '').toLowerCase() !== 'custom') continue;
    const jobRole = String(user.jobRole || '').trim();
    if (!jobRole || jobRole.length > 40) continue;
    // Copy effective access, including the existing Finance/HR purchase-order access.
    const permissions = PERMISSIONS.filter(permission => hasPermission(user, permission.key)).map(permission => permission.key);
    const id = JSON.stringify([jobRole.toLowerCase(), [...permissions].sort()]);
    if (!templates.has(id)) templates.set(id, { id, role: 'custom', jobRole, permissions });
  }
  const custom = [...templates.values()].sort((a, b) => a.jobRole.localeCompare(b.jobRole));
  const counts = new Map();
  const positions = new Map();
  custom.forEach(template => counts.set(template.jobRole.toLowerCase(), (counts.get(template.jobRole.toLowerCase()) || 0) + 1));
  custom.forEach(template => {
    const key = template.jobRole.toLowerCase();
    const position = (positions.get(key) || 0) + 1;
    positions.set(key, position);
    template.label = counts.get(key) > 1
      ? `${template.jobRole} - access set ${position} (${template.permissions.length} pages)`
      : `${template.jobRole} (${template.permissions.length} pages)`;
  });
  return [{ id: 'standard-staff', label: 'Staff - standard POS access', role: 'staff', jobRole: '', permissions: [...DEFAULT_STAFF_PERMISSIONS] }, ...custom];
}
