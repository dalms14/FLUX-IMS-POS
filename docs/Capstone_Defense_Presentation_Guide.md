# FLUX-POS Capstone Defense Presentation Guide

## Core Message

FLUX-POS is a custom point-of-sale and inventory management system for Eli Coffee Antipolo. Its main value is that it does not only record sales. It connects each sale to inventory movement, recipe-based ingredient usage, refund handling, waste tracking, reports, and staff accountability.

One-sentence pitch:

> FLUX-POS helps Eli Coffee process orders faster while keeping inventory, refunds, waste, and sales records accurate in one connected system.

## Recommended Slide Flow

### 1. Title Slide

Title: FLUX-POS: Point-of-Sale and Inventory Management System for Eli Coffee Antipolo

Say:

Good day, panelists. We are presenting FLUX-POS, a customized POS and inventory management system developed for Eli Coffee Antipolo. The system was built to support daily cashier operations, sales monitoring, inventory tracking, refunds, and administrative control.

### 2. Background of the Study

Key points:
- Coffee shops handle fast-moving orders and ingredient-based products.
- Manual tracking can cause stock discrepancies, delayed reports, and difficulty tracing refunds.
- Standard POS systems often track finished products but not the ingredients consumed per item.

Say:

The problem we observed is that sales and inventory are often handled separately. When a cashier sells a product, the business also consumes ingredients such as coffee beans, milk, syrups, cups, and other materials. If these are not connected, the owner may know the sales total but not the real inventory impact.

### 3. Problem Statement

Use these as bullets:
- Difficulty monitoring daily sales and transactions in real time.
- Manual or disconnected inventory updates.
- Limited traceability for refunds, cancelled orders, and waste.
- Need for role-based access so sensitive pages are limited to authorized users.

Say:

Our study addresses the need for a system that can process transactions, update related records, and provide management visibility without relying on separate manual logs.

### 4. Objectives

General objective:

To develop a POS and inventory management system that improves transaction processing, inventory monitoring, refund handling, and sales reporting for Eli Coffee Antipolo.

Specific objectives:
- Provide a cashier-friendly ordering and transaction module.
- Track products, ingredients, inventory, and recipes.
- Generate dashboard metrics and sales reports.
- Implement refund and waste tracking with audit records.
- Provide secure login and role-based access control.

### 5. Scope and Limitations

Scope:
- User authentication and staff management.
- POS ordering and transaction recording.
- Cash and GCash payment support.
- Product, category, discount, add-on, and inventory management.
- Dashboard, reports, history, and refund records.
- Recipe-based ingredient tracking.

Limitations:
- The system is designed for the current operational workflow of Eli Coffee Antipolo.
- It runs with a local frontend/backend setup connected to MongoDB Atlas.
- Payment verification for GCash is recorded in the system but still depends on staff validation.

### 6. Methodology / Development Approach

Say:

We followed an iterative development approach. We identified the store workflow, built the core POS functions, connected the backend API and database models, then expanded the system with inventory, reports, refunds, and access control. Testing was done by checking common workflows such as login, order processing, transaction history, refund processing, and dashboard updates.

### 7. System Architecture

Architecture:
- Frontend: React
- Backend: Node.js and Express.js
- Database: MongoDB Atlas with Mongoose
- API communication: REST endpoints using Axios
- Architecture pattern: three-tier architecture

Say:

The frontend handles the user interface, the backend manages business logic and API routes, and MongoDB Atlas stores records such as users, products, inventory, recipes, transactions, refunds, and audit logs.

### 8. Main Modules

Modules to present:
- Login and role-based access
- Dashboard
- POS/order page
- Transactions
- Inventory
- Products and settings
- History
- Reports
- Refund management
- Staff management

Say:

These modules were designed around the actual workflow of the business: staff log in, process orders, payments are recorded, inventory-related records are updated, and administrators can review reports and history.

### 9. Dashboard Module

Show:
- Today's revenue
- Total orders
- Items sold
- Completed transactions
- Recent transaction list
- Auto-refresh behavior

Say:

The dashboard gives the administrator a quick operational view. It calculates today’s revenue, order count, sold items, completed orders, and refund-related status from transaction and refund records. The dashboard refreshes periodically so the display remains updated during store operations.

### 10. POS and Transaction Flow

Flow:
1. Staff selects products.
2. System computes subtotal, discount, tax, and total.
3. Payment is recorded as Cash or GCash.
4. Transaction is saved with receipt number, cashier, items, totals, and payment method.
5. Transaction appears in history, reports, and dashboard.

Say:

Each transaction is stored with detailed item information, cashier identity, customer type, payment method, and order status. This allows the system to produce reliable reports and trace records later.

### 11. Inventory and Recipe Tracking

Say:

The important feature of FLUX-POS is recipe-based inventory tracking. Products can be connected to recipes, and recipes define how much ingredient is needed per serving. This helps the business understand the ingredient impact of sales and refunds instead of only tracking finished products.

### 12. Refund and Waste Management

Flow:
1. User selects a transaction.
2. User opens the refund modal.
3. User selects items and reason.
4. Backend checks if the product has a recipe.
5. Made products create waste records.
6. Purchased products are returned to inventory.
7. Refund record is saved with status and audit details.

Say:

The refund system distinguishes between made products and purchased products. If a made product is refunded, the system records the wasted ingredients. If a purchased product is refunded and can be returned to stock, it updates inventory. This gives the business better accountability and more accurate records.

### 13. Security and Access Control

Key points:
- Email/password login.
- PIN login support.
- Failed login lockout after repeated attempts.
- Private routes for authenticated users.
- Admin-only routes for sensitive pages such as sales, reports, staff, inventory, and product settings.
- User heartbeat for online status.

Say:

Security was considered by protecting routes, separating regular user and admin access, and adding login attempt controls. This limits sensitive business data to authorized users.

### 14. Database Design

Important collections:
- Users
- Products
- Categories
- Inventory
- Recipes
- Transactions
- Refunds
- Waste
- System audit
- Discounts
- Add-ons

Say:

The database design separates operational records into collections. Transactions store sales records, recipes connect products to ingredients, refunds store return details, and waste records document ingredient loss.

### 15. Testing and Validation

Suggested test cases:
- Valid and invalid login.
- Admin route access.
- Create a transaction with Cash payment.
- Create a transaction with GCash payment.
- View dashboard metrics.
- Filter transactions.
- Process a partial refund.
- Process a refund for a made product.
- Process a refund for a purchased product.
- Check history and reports after transaction/refund.

Say:

We validated the system by testing major workflows from login to transaction processing, reports, and refunds. We also checked that refund activity appears in history and dashboard records.

### 16. Results

Say:

The completed system centralizes POS operations, sales monitoring, inventory management, refunds, and reports. It reduces reliance on separate manual records and provides a clearer view of daily operations.

### 17. Conclusion

Say:

In conclusion, FLUX-POS provides Eli Coffee Antipolo with a system that supports faster transaction handling and more reliable business records. Its main contribution is connecting sales with inventory, recipes, refunds, and waste tracking.

### 18. Recommendations

Future improvements:
- Cloud deployment for wider access.
- Barcode scanner or receipt printer integration.
- More advanced analytics and forecasting.
- Automated GCash/payment gateway verification.
- Backup and restore module.
- Multi-branch support.

## Live Demo Script

Use this order to avoid jumping around:

1. Login page
   - Show authentication.
   - Mention admin/user access.

2. Dashboard
   - Show revenue, orders, items sold, completed orders.
   - Mention auto-refresh and recent transactions.

3. POS / Items page
   - Add a product to an order.
   - Show quantity, discount/add-ons if available.
   - Complete payment.

4. Transactions page
   - Show the newly created transaction.
   - Show filters by cashier or payment method.

5. Refund modal
   - Open refund for a transaction.
   - Select item and reason.
   - Explain made product vs purchased product logic.

6. History page
   - Show transaction history.
   - Show refund history.
   - Show inventory/waste history.

7. Inventory or Reports
   - Show admin-only management view.
   - Explain decision support for owner.

## Strong Lines To Memorize

- "The system does not stop at recording sales. It connects sales to inventory, recipes, waste, and refunds."
- "Our main design decision was to track ingredient movement, not just finished products."
- "Refunds are handled differently depending on the product type: made items become waste records, while returnable purchased items go back to inventory."
- "Role-based access protects sensitive business information such as reports, staff management, and inventory settings."
- "The dashboard summarizes daily operations using actual transaction and refund data."

## Likely Panel Questions and Suggested Answers

### Why did you choose React, Node.js, Express, and MongoDB?

We chose React because it supports a responsive and component-based user interface. Node.js and Express allow us to create REST APIs efficiently. MongoDB is flexible for storing transaction records, product details, recipes, and refund documents, which can have nested item details.

### What makes your system different from a normal POS?

The system connects POS transactions to inventory and recipe tracking. A normal POS may only record that a product was sold, but FLUX-POS can also support ingredient-level tracking, waste records, refunds, and reporting.

### How does the refund system work?

The user selects a transaction and the item to refund. The backend checks whether the product has a recipe. If it has a recipe, the refunded item is treated as waste and the ingredient usage is recorded. If it is a purchased product without a recipe, the quantity can be returned to inventory. A refund record is then saved for auditing.

### How do you prevent unauthorized access?

The system uses login authentication and protected routes. Some pages are available to logged-in users, while admin-only pages require an administrator role. The backend also includes login attempt tracking and lockout for repeated failed attempts.

### What are the main database entities?

The main entities are User, Product, Category, Inventory, Recipe, Transaction, Refund, Waste, Discount, Add-on, and System Audit. These collections separate responsibilities while still allowing records to reference each other.

### What happens if there is no internet connection?

The current system uses MongoDB Atlas, so database access requires connectivity. For future improvement, offline caching or local database synchronization can be added.

### How did you test the system?

We tested major workflows: login, transaction creation, payment recording, dashboard updates, transaction filtering, refund processing, history display, and admin route access. For refunds, we tested both made products and purchased products because they affect inventory differently.

### What are the limitations of the system?

The system is customized for Eli Coffee Antipolo and currently uses a local app setup with a cloud database. GCash proof or reference can be recorded, but final verification still depends on staff confirmation. Future versions can integrate official payment gateway verification.

### What is the most complex feature?

The refund and inventory logic is one of the most complex features because it needs to decide whether a product should create waste records or return stock to inventory. It also needs to keep transaction history and refund status traceable.

## 5-Minute Presentation Version

Good day, panelists. We are presenting FLUX-POS, a point-of-sale and inventory management system developed for Eli Coffee Antipolo.

The problem we addressed is that many small businesses can record sales, but their sales, inventory, refunds, and waste records are often disconnected. For a coffee shop, every sale also consumes ingredients, and every refund may affect inventory or waste. Without a connected system, the owner may experience stock discrepancies and delayed reports.

Our objective was to build a system that supports cashier transactions, inventory management, sales monitoring, refunds, staff access, and reports in one platform.

The system uses React for the frontend, Node.js and Express for the backend API, and MongoDB Atlas with Mongoose for the database. It follows a three-tier architecture: user interface, server-side business logic, and database storage.

The main modules are login, dashboard, POS ordering, transactions, inventory, products, history, reports, refunds, and staff management. The dashboard displays today’s revenue, order count, items sold, completed transactions, and recent transactions using real data from the backend.

One of the most important features is recipe-based inventory tracking. Products can be connected to recipes, and each recipe defines the ingredients used per serving. This allows the business to understand the inventory impact of sales.

Another important feature is the refund system. When a refund is processed, the backend checks whether the item is a made product or a purchased product. If it is a made product, the system records ingredient waste. If it is a purchased product, the system can return the item to inventory. This creates better accountability and a clear audit trail.

The system also includes role-based access control. Regular users can access operational pages, while admin pages such as reports, inventory, staff, and product settings are protected.

In conclusion, FLUX-POS improves Eli Coffee’s daily operations by connecting sales, inventory, refunds, waste tracking, and reports. It reduces manual tracking and provides more reliable records for decision-making.

## Final Defense Tips

- Start with the business problem, not the technology.
- In the demo, follow one complete transaction from login to report/history.
- When asked a hard question, answer using the workflow: input, process, output.
- If a feature is a limitation, say it clearly and connect it to future improvement.
- Do not over-explain code unless asked. Explain the business purpose first.
