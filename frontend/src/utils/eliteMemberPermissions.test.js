import { canManageEliteMembers, getLandingPath, hasPermission } from './roles';
import { buildAccountRoleTemplates } from './accountRoleTemplates';

test('membership permission is independent of product access and routes a membership-only account to its page', () => {
  const clerk = { role: 'custom', jobRole: 'Membership Clerk', permissions: ['elite_members'] };
  expect(canManageEliteMembers(clerk)).toBe(true);
  expect(hasPermission(clerk, 'products')).toBe(false);
  expect(getLandingPath(clerk)).toBe('/elite-members');
  expect(canManageEliteMembers({ role: 'admin', permissions: ['products'] })).toBe(false);
  expect(canManageEliteMembers({ role: 'custom', permissions: [] })).toBe(false);
  expect(canManageEliteMembers({ role: 'custom' })).toBe(false);
  expect(canManageEliteMembers({ ...clerk, archived: true })).toBe(false);
  expect(canManageEliteMembers({ role: 'owner' })).toBe(true);
  expect(canManageEliteMembers({ role: 'admin' })).toBe(true);
});
test('role templates preserve explicit membership access for reuse', () => {
  const templates = buildAccountRoleTemplates([{ role: 'custom', jobRole: 'Membership Clerk', permissions: ['elite_members'] }]);
  expect(templates[1].permissions).toEqual(['elite_members']);
});
