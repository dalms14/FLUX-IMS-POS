# Figure 9. Use Case Diagram

Figure 9 shows the main interactions between users and the FLUX Point-of-Sale and Inventory Management System for Eli Coffee and Tea Cafe. The updated diagram separates the three roles clearly: Owner, Admin, and Staff. The Owner has full access, Admin access depends on permissions assigned by the Owner, and Staff access focuses on cashier and daily transaction workflows.

Use the SVG version for the manuscript or presentation:

- `docs/use_case_diagram.svg`

The editable PlantUML source is also included:

- `docs/use_case_diagram.puml`

## Role Summary

- Owner: full system access, including business monitoring, product setup, inventory, reports, staff/admin accounts, and permission assignment.
- Admin: permission-based access created by the Owner, such as Sales-only, Inventory-only, Reports-only, or other selected module access.
- Staff: daily POS access for order creation, payment handling, receipt viewing/printing, active order updates, pending order cancellation, and available transaction/history views.

## Updated Use Cases

- Authentication: log in, recover password, manage profile/settings, and log out.
- POS operations: view products, create active order, apply discounts, handle payment, generate/view/print receipt, update active order status, cancel pending order, and remove pending item.
- Product management: manage products, categories, add-ons, discounts, variants, and recipe/ingredient mapping.
- Inventory management: manage inventory items, record stock-in and stock-out, monitor low-stock alerts, monitor expiration batches, and record purchase orders.
- Reports and monitoring: view dashboard, sales reports, inventory reports, finance reports, refund history, transactions/history, login activity, and audit/system activity.
- Account management: manage staff/admin accounts and assign Admin permissions.
