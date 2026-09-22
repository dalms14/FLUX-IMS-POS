# Panel Revision Tracker

## Paper Revisions

### 1. Add synthesis
Status: To do

Add a synthesis after the Review of Related Literature/Studies/Systems. The synthesis should connect the reviewed systems to FLUX and explain the gap that FLUX addresses.

Suggested point:
FLUX combines POS, inventory monitoring, ingredient-level tracking, sales reporting, and role-based access into one system customized for Eli Coffee and Tea Cafe.

### 2. Add brief discussion for tables and figures
Status: To do

Every table and figure should have a short explanation before or after it. Do not leave tables and figures standing alone.

Suggested format:
"Table/Figure __ shows ____. This is important because ____. In FLUX, this supports ____."

### 3. Clarify user roles
Status: In progress

Update the paper and diagrams to clearly separate these roles:
- Owner
- Admin
- Staff

Suggested distinction:
- Owner: monitors sales, reports, inventory status, and business performance.
- Admin: custom account created by the owner. Access depends on selected permissions, such as Sales-only for finance users.
- Staff: processes orders, payments, receipts, and daily transactions.

System update:
- Added permission-based access for custom admin accounts.
- Owner has full access by default.
- Existing admin accounts without saved permissions still keep full access for backward compatibility.
- New admin accounts can be created with selected page permissions.
- Added updated Figure 9 use case diagram files that clearly separate Owner, Admin, and Staff.

### 4. Include purchase order
Status: In progress

Add purchase order as part of the inventory/restocking process. This should show how the business records items or ingredients that need to be purchased from suppliers.

Diagram update:
- Added Record Purchase Orders under Inventory and Restocking in the updated use case diagram.

### 5. Include ingredient expiration in inventory
Status: In progress

Add expiration dates for inventory ingredients. This supports food safety, stock monitoring, and waste reduction.

System update:
- Added batch-based expiration tracking to inventory records.
- One inventory item can now have multiple stock batches with different quantities and expiration dates.
- Added batch setup when adding/editing inventory items and when receiving stock.
- Added yellow near-expiry alerts for ingredients expiring within 7 days.
- Added red expired alerts for ingredients past their expiration date.

Diagram update:
- Added Monitor Expiration Batches under Inventory and Restocking in the updated use case diagram.

## System Revisions

### 1. Variant should be broken down
Status: To do

Product variants should be shown or stored clearly instead of being grouped in a confusing way. Example: sizes, flavors, add-ons, or product options should have clear details.

### 2. Add expiration to inventory
Status: In progress

Inventory records should include ingredient expiration dates, and the UI should show or warn about near-expiry/expired items.

Implemented:
- Inventory table now shows nearest expiration date, batch count, and expiry status.
- Near-expiry items appear yellow.
- Expired items appear red.
- Dashboard-style inventory KPI cards include Near Expiry and Expired counts.

### 2a. Replace inventory delete with rename/edit
Status: Done

The inventory table no longer shows a delete button. Users can rename or edit an inventory item through the edit action.

### 3. Remove unnecessary sidebar item
Status: Needs clarification

Panel comment: "Delete yung sa side"

Clarify which sidebar item should be removed. Possible candidates:
- Settings
- History
- Transactions
- Reports
- Profile section

### 4. Do not hide inspect element
Status: Done

The current `frontend/src/App.js` no longer blocks right-click, F12, or browser inspect shortcuts.

Verified search:
- No active `contextmenu` blocking code found.
- No active F12/inspect shortcut blocking code found.

## Suggested Priority

1. Fix paper synthesis and figure/table discussions.
2. Clarify Owner/Admin/Staff in paper and diagrams.
3. Add purchase order and expiration to paper scope/design.
4. Implement inventory expiration in the system.
5. Implement purchase order module or minimum purchase order records.
6. Break down product variants.
7. Remove the sidebar item after clarification.
