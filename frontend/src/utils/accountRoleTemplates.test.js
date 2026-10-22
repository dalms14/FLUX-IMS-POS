import { buildAccountRoleTemplates } from './accountRoleTemplates';
import { DEFAULT_STAFF_PERMISSIONS, PERMISSIONS } from './roles';

test('always offers the standard staff role', () => {
  expect(buildAccountRoleTemplates()).toEqual([expect.objectContaining({ role: 'staff', jobRole: '', permissions: DEFAULT_STAFF_PERMISSIONS })]);
});

test('reuses only active custom roles without copying personal information', () => {
  const templates = buildAccountRoleTemplates([
    { role: 'owner', jobRole: 'Owner' }, { role: 'admin', jobRole: 'Admin' },
    { role: 'custom', jobRole: 'Archived', archived: true },
    { role: 'custom', jobRole: 'Inventory Clerk', permissions: ['inventory'], name: 'Private name', email: 'private@example.com', password: 'secret', pin: '123456' },
  ]);
  expect(templates).toHaveLength(2);
  expect(templates[1]).toEqual(expect.objectContaining({ role: 'custom', jobRole: 'Inventory Clerk', permissions: ['inventory'] }));
  expect(templates[1].email).toBeUndefined();
  expect(templates[1].name).toBeUndefined();
  expect(templates[1].password).toBeUndefined();
  expect(templates[1].pin).toBeUndefined();
});

test('deduplicates matching roles and keeps different access sets distinct', () => {
  const templates = buildAccountRoleTemplates([
    { role: 'custom', jobRole: 'Supervisor', permissions: ['sales', 'dashboard'] },
    { role: 'custom', jobRole: ' supervisor ', permissions: ['dashboard', 'sales'] },
    { role: 'custom', jobRole: 'Supervisor', permissions: ['inventory', 'dashboard'] },
  ]);
  expect(templates).toHaveLength(3);
  expect(templates[1].label).toContain('access set 1');
  expect(templates[2].label).toContain('access set 2');
  expect(templates[1].id).not.toBe(templates[2].id);
});

test('matches effective Finance/HR permissions and legacy custom access defaults', () => {
  const templates = buildAccountRoleTemplates([
    { role: 'custom', jobRole: 'Finance', permissions: ['sales', 'not-a-real-page'] },
    { role: 'custom', jobRole: 'Legacy Supervisor' },
  ]);
  expect(templates.find(item => item.jobRole === 'Finance').permissions).toEqual(['sales', 'purchase_orders']);
  expect(templates.find(item => item.jobRole === 'Legacy Supervisor').permissions).toHaveLength(PERMISSIONS.length);
});
