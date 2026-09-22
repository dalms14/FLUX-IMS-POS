# Capstone Paper Revision Draft

Use this file as ready-to-paste text for the revised manuscript. The revisions below are based on the panel comments and the current FLUX system direction.

## 1. Add Synthesis After RRL/RRS/RRL Sections

Place this after the final synopsis of the Review of Related Literature/Studies/Systems.

### Synthesis

The reviewed literature and related systems show that Point-of-Sale and Inventory Management Systems help food and beverage businesses improve transaction speed, reduce manual errors, and monitor inventory more accurately. Several studies emphasized the importance of real-time sales recording, inventory monitoring, ingredient usage tracking, and automated reports for small food businesses such as coffee shops. These findings are relevant to Eli Coffee and Tea Cafe because its operations involve fast customer transactions, ingredient-based products, stock monitoring, and sales reporting.

However, the reviewed systems also show gaps that FLUX aims to address. Some POS systems focus mainly on sales transactions but provide limited ingredient-level inventory tracking. Other inventory systems monitor stock quantities but are not directly connected to the cashier workflow. In addition, several systems do not clearly support role-based access, ingredient expiration monitoring, purchase order recording, and product recipe mapping in one centralized platform.

Based on these gaps, FLUX was designed as a centralized Point-of-Sale and Inventory Management System for Eli Coffee and Tea Cafe. It combines POS transactions, recipe-based ingredient deduction, inventory monitoring, batch-based expiration tracking, purchase order support, sales reports, refund and waste records, and role-based access control. Through these features, the system supports both daily cashier operations and management decision-making while reducing manual recording and improving data accuracy.

## 2. Revise Scope and Limitations

Replace the current "Scope of the study" introduction and role sections with this cleaner version.

### Scope of the Study

The system is a role-based Point-of-Sale (POS) and Inventory Management platform designed specifically for Eli Coffee and Tea Cafe, Antipolo branch. It aims to address operational issues in transaction processing, inventory monitoring, ingredient tracking, purchase order recording, sales reporting, and employee access management. The system includes three main user roles: Owner, Admin, and Staff.

### Owner Interface

- Profile - Allows the owner to view and update account information and profile details.
- Dashboard - Displays overall business performance, including daily sales, orders, items sold, recent transactions, inventory alerts, and key summaries.
- Items / POS - Allows access to order processing, cart management, discounts, payments, receipts, service type selection, and active order status management.
- Products - Allows the owner to manage products, categories, add-ons, discounts, variants, and recipe/ingredient mapping.
- Sales - Displays revenue, refunds, payment mix, product performance, sales summaries, and completed sales records.
- Inventory - Allows the owner to monitor stock levels, low-stock alerts, stock-in and stock-out records, ingredient expiration batches, and inventory adjustments.
- Purchase Orders - Allows the owner to record and monitor purchase orders for ingredients or supplies that need restocking.
- Transactions - Displays detailed transaction records with filters for date, time, cashier, and payment method.
- Staff and Admin Accounts - Allows the owner to create, view, edit, and manage user accounts.
- Reports - Generates reports for sales, inventory, finance, login activity, and system activity.
- Settings - Allows access to account settings, password changes, system backup, and general system information.
- Logout - Securely exits the owner from the system.

### Admin Interface

The Admin role is a customizable account created by the Owner. Unlike the Owner, an Admin does not automatically have access to all modules. The Owner can assign specific permissions depending on the Admin’s responsibility. For example, a finance admin may only access Sales and Reports, while an inventory admin may only access Inventory and Purchase Orders.

Possible Admin access includes:

- Dashboard - Displays summaries allowed by the assigned permissions.
- Sales - Allows viewing of sales records, revenue, payment mix, refunds, and finance-related reports.
- Inventory - Allows monitoring of stock levels, stock-in and stock-out records, expiration batches, and inventory alerts.
- Purchase Orders - Allows recording and monitoring of purchase orders for restocking.
- Products - Allows management of products, recipes, add-ons, discounts, and variants if permitted by the Owner.
- Reports - Allows generation and export of reports based on assigned access.
- Staff Accounts - Allows account viewing or management only if permission is granted by the Owner.
- Settings - Allows account-related settings such as password changes and profile options.

### Staff Interface

- Profile - Allows staff to view and update account information and profile details.
- Dashboard - Displays operational summaries available to staff.
- Items / POS - Allows staff to select products, filter by category, manage the cart, apply discounts, process payments, and view or print receipts when orders are ready.
- Transactions - Allows staff to view transaction records and receipt details available to their role.
- History - Allows staff to view activity and transaction logs available to their role.
- Settings - Allows staff to access account-related settings such as password changes and profile options.
- Forgot Password - Allows staff to recover or change their password through a verification process.
- Logout - Securely exits the staff account from the system.

### Revised Limitations

Single-Branch Operation

The system is limited to the operations of the Antipolo branch of Eli Coffee and Tea Cafe. It does not support multi-branch synchronization.

Limited Supplier Management

The system includes purchase order recording for inventory restocking; however, it does not include full supplier relationship management, automated supplier communication, supplier payment processing, or delivery tracking.

No Online Orders

The system is designed for on-premise, over-the-counter transactions only. It does not include an external customer-facing website, mobile ordering application, delivery app integration, or advanced customer reservation module. All sales must be entered manually by the cashier at the physical point-of-sale terminal.

## 3. Add / Revise Functional Requirements

Insert or revise these under Requirements Documentation.

### 1.1 Owner

REQ001. The owner shall be able to log in to the system by providing their email and password.

REQ002. The owner shall be able to access the dashboard to view overall sales, orders, items sold, inventory alerts, expiration alerts, and recent transactions.

REQ003. The owner shall be able to access the inventory management module.

REQ004. The owner shall be able to manually input incoming stock when new supplies are received.

REQ005. The owner shall be able to record Stock Out transactions for damaged, stolen, expired, lost, or count-corrected inventory items.

REQ006. The owner shall be able to record purchase orders for ingredients and supplies that need to be restocked.

REQ007. The system shall automatically deduct ingredient quantities based on configured ingredient mapping when a paid order is created as a Pending active order.

REQ008. The system shall restore deducted inventory when a Pending order or item is cancelled or refunded before preparation.

REQ009. The system shall display a visual low-stock indicator when an ingredient’s stock level falls below the defined threshold.

REQ010. The system shall display yellow alerts for ingredients near expiration and red alerts for expired ingredients.

REQ011. The system shall allow inventory items to have multiple expiration batches because not all stocks of the same ingredient are received or expire at the same time.

REQ012. The owner shall be able to generate and view sales, inventory, finance, and system reports to support business decision-making.

REQ013. The owner shall be able to configure ingredient mapping by linking each menu item to its corresponding ingredients and quantities.

REQ014. The owner shall be able to add new menu items, including name, description, price, category, image, variants, and add-ons.

REQ015. The owner shall be able to edit existing menu items.

REQ016. The owner shall be able to rename or edit inventory items instead of permanently deleting them.

REQ017. The owner shall be able to create Staff and Admin accounts.

REQ018. The owner shall be able to assign selected permissions to Admin accounts using module access options.

### 1.2 Admin

REQ019. The admin shall be able to log in using their assigned email and password.

REQ020. The admin shall only access modules granted by the owner.

REQ021. The system shall support custom admin permissions, such as Sales-only access for finance-related accounts.

REQ022. The admin shall be able to perform actions only within the modules assigned by the owner.

### 1.3 Staff

Renumber the current employee requirements after the new Owner and Admin requirements. Change "Employees" to "Staff" for consistency.

## 4. Add Brief Discussion for Tables and Figures

The panel comment says each table and figure should have a short discussion. Add 2-4 sentences before or after each table/figure.

### For Figure 1.0 Agile Sprint Method

Figure 1.0 shows the Agile Sprint Method used in developing FLUX. The diagram presents the repeated cycle of planning, design, and coding, which allowed the researchers to develop the system gradually. This method was suitable for the project because the system includes several connected modules, such as POS, inventory, reports, and user access, which required testing and improvement during development.

### For Summary Table of Technologies

The summary table presents the technologies used in developing the FLUX system. It identifies the purpose of each tool, framework, and platform in the system architecture. These technologies were selected to support a web-based interface, backend processing, database storage, API testing, and team collaboration.

### For Figure 1.1 and Figure 1.2 Gantt Charts

Figures 1.1 and 1.2 show the planned schedule of activities for Capstone 1 and Capstone 2. These charts organize the project timeline from pre-development, documentation, design, development, testing, debugging, and final submission. The Gantt charts helped the researchers monitor progress and ensure that each phase of the capstone project was completed within the expected period.

### For Figure 3 System Architecture

Figure 3 shows the three-tier architecture of FLUX. The presentation tier handles the user interface, the application tier processes the system logic, and the data tier stores information in the database. This structure helps separate the user interface, backend logic, and database management, making the system easier to maintain and improve.

### For Figure 4.0 Data Flow Diagram Level 0

Figure 4.0 shows the Level 0 Data Flow Diagram of the FLUX system. It presents the whole system as one main process and shows how external users, such as the Owner, Admin, and Staff, interact with it. The diagram helps explain the high-level flow of data, including login details, order details, product updates, reports, receipts, and inventory alerts.

### For Level 1 DFD - Gane-Sarson Notation

The Level 1 DFD provides a more detailed view of the internal processes of FLUX. It breaks down the system into major processes such as user access, order processing, payment and receipt generation, inventory updating, product and recipe management, and report generation. This diagram shows how data moves between users, system processes, and data stores.

### For Figure 6.0 Login Flow

Figure 6.0 shows the login process for system users. It illustrates how the user enters login credentials, how the system verifies the account, and how access is granted or denied based on the user’s role and permissions. This process supports system security by ensuring that only authorized users can access protected modules.

### For Figure 6.1 Forgot Password

Figure 6.1 shows the forgot password process. It explains how a user can recover or change their password through account verification. This feature helps users regain access while still protecting the system from unauthorized password changes.

### For Figure 7 Customer Ordering Process

Figure 7 shows the customer ordering process in FLUX. It presents the steps from product selection, cart review, discount application, payment processing, active order creation, receipt generation, and order completion. This process supports faster transactions and ensures that sales and inventory records are updated accurately.

### For Figure 8 Inventory Management Flowchart

Figure 8 shows how inventory is managed in the system. It includes stock-in, stock-out, ingredient deduction, low-stock alerts, purchase order recording, and expiration monitoring. This flow helps explain how FLUX keeps inventory records accurate and supports better restocking decisions.

### For Figure 9 Use Case Diagram

Figure 9 shows the main interactions between users and the FLUX system. It identifies the system functions available to the Owner, Admin, and Staff. The diagram helps clarify user responsibilities and supports the role-based access design of the system.

### For Figure 10 Entity Relationship Diagram

Figure 10 shows the database structure of the system. It presents the relationships between major records such as users, products, inventory, recipes, transactions, refunds, purchase orders, and logs. This diagram helps explain how data is organized and connected within FLUX.

## 5. Add Purchase Order Description

Add this in Purpose and Description or Scope.

The system also includes purchase order support for inventory restocking. When ingredients or supplies are low, the owner or authorized admin can record purchase order details such as the item needed, quantity, date, and status. This feature helps the business document restocking needs and maintain organized records of supplies that must be purchased. However, the system does not include full supplier payment processing or automated supplier communication.

## 6. Add Ingredient Expiration Description

Add this in Purpose and Description or Inventory Scope.

FLUX also supports expiration monitoring for inventory ingredients. Since some ingredients may be received in different batches, the system allows an inventory item to have multiple expiration dates based on its stock batches. For example, one ingredient may have one batch expiring earlier and another batch expiring later. The system displays yellow alerts for ingredients near expiration and red alerts for expired ingredients. This helps the cafe reduce waste, improve food safety, and prioritize which stocks should be used first.

## 7. Revise Security Requirement

Replace REQ042 with this:

REQ042. The system shall implement role-based and permission-based access control for Owner, Admin, and Staff users.

Add this after REQ044:

REQ044A. The system shall allow the Owner to create custom Admin accounts with selected module permissions, such as Sales-only, Inventory-only, or Reports-only access.

## 8. Suggested Paper-Wide Term Fixes

Use these consistently:

- Use "Owner" for full-access business owner.
- Use "Admin" for custom permission management accounts created by the Owner.
- Use "Staff" instead of "Employees" when referring to cashier or operational users.
- Use "Point-of-Sale" or "POS" consistently.
- Use "Eli Coffee and Tea Cafe" consistently.
- Use "mL" and "g" for measurements.
- Replace "delete inventory item" with "rename or edit inventory item" where the panel requested no delete button in inventory.

## 9. Quick Revision Checklist

- Add Synthesis after the final RRL/RRS synopsis.
- Replace Admin/Staff-only scope with Owner/Admin/Staff scope.
- Change limitation from "No Supplier Management" to "Limited Supplier Management."
- Add purchase order support to scope and requirements.
- Add batch-based expiration tracking to scope and requirements.
- Add brief discussion to every table and figure.
- Update DFD/use case labels to include Owner, Admin, and Staff clearly.
- Update requirements numbering after adding new Owner/Admin requirements.
