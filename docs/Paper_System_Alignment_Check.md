# Paper and System Alignment Check

PDF reviewed: `Coffee_Almojera,Escaraman,Nercua,Saroca_1  (4).pdf`  
Review date: May 10, 2026

## Current System Behavior to Match

- Login uses email/username and password with failed-attempt lockout.
- POS supports item selection, variants/add-ons, category filtering, discounts, Cash, and GCash.
- Checkout asks for **Dine In** or **Dine Out**.
- GCash requires a reference number and payment proof image.
- After payment, the order enters **Active Orders** as **Pending**.
- Active Orders use the flow: **Pending → Preparing → Ready → Completed**.
- Customer receipt is printed/viewed when the order is **Ready**, not immediately after payment.
- Transaction History only shows finalized records: **Completed** and **Cancelled**.
- Whole-order cancellation and item removal/refund are allowed only while the order is **Pending**.
- Once an order is **Preparing**, **Ready**, or **Completed**, it is final and unrefundable.
- Inventory is deducted when checkout creates the Pending active order. If a Pending order/item is cancelled, the deducted inventory is restored.
- Inventory supports **Stock In** and **Stock Out** for damage, theft, expiry, loss, and count corrections.
- History page includes Transaction History, Inventory History, Sales History, and Refunds.
- Live counts checked from the running system: **46 products** and **62 inventory items**.

## Must Update in the Paper

| Paper Location | Current Paper Text / Idea | Why It Does Not Match | Recommended Update |
| --- | --- | --- | --- |
| Page 6, Project Context | Says the cafe offers **52 products**. | The running system currently has **46 products**. | Update the count to 46, or avoid a fixed number if the menu can change. |
| Page 8, Purpose and Description | Says staff process orders and generate receipts; says inventory updates once a transaction is completed. | The system creates a Pending active order after payment. Receipt is issued when Ready. Inventory deducts at checkout/Pending order creation, not after completion. | Explain that paid orders move to Active Orders, stock is deducted after checkout, receipt is printed when Ready, and transaction history is finalized after completion. |
| Page 10, Admin Items/POS scope | Says Items/POS handles order processing, cart, discounts, payments, and receipt generation. | Missing Dine In/Dine Out and Active Orders workflow. | Add service type selection and Active Orders status management. |
| Page 10, Sales scope | Says Sales displays revenue, refunds, payment mix, product performance, and summaries. | Mostly matches, but should clarify cancelled orders/refunds are excluded from completed sales totals where appropriate. | Add “completed sales only, with cancelled/refunded pending items excluded from revenue counts.” |
| Page 10, Inventory scope | Says inventory monitors stock, alert levels, and adjustments. | Missing manual Stock Out reasons now implemented. | Add Stock In and Stock Out for received supplies, damage, theft, expiry, loss, and count corrections. |
| Page 10-11, History scope | Says History displays sales activity, stock adjustments, and system changes. | History page now has specific tabs. | State: Transaction History, Inventory History, Sales History, and Refunds. |
| Page 11, Staff Items/POS scope | Says staff can generate receipts. | Receipt timing changed. | Say staff can view/print customer receipt when order is Ready. |
| Page 33, Requirements Analysis - How | Describes pay-first policy and POS printing receipts before preparation. | This describes the existing process, but the proposed system now adds Active Orders before receipt/final history. | Add a sentence: FLUX keeps paid orders in Active Orders until preparation is completed. |
| Page 35-36, REQ015-REQ021 | Requirements jump from placing orders/payment to receipt after completed transaction. | Missing service type, Active Orders, status changes, Pending-only cancellation/refund, and Ready-only receipt. | Add new requirements listed below. |
| Page 36, REQ020 | Says payments include cash, gcash, and **card**. | The implemented system supports Cash and GCash only. | Remove card unless card payment will be implemented. |
| Page 36, REQ021 | “Generate and issue receipts after each completed transaction.” | Receipt is printed/viewed when order is Ready; transaction history finalizes after Completed. | Change to: “generate and issue customer receipts when an active order is marked Ready.” |
| Page 36, REQ026 | Says employees can log damaged items. | System supports broader Stock Out reasons. | Change to Stock Out for damaged, lost, stolen, expired, or count-corrected inventory. |
| Page 37, REQ033 | Says users authenticate with email, password, and PIN before accessing POS. | Frontend currently uses email/username and password with attempt lockout. PIN exists in backend/user setup but is not part of the current POS login UI. | Either implement PIN login in the UI, or revise this requirement to email/password authentication with failed-attempt protection. |
| Page 37, REQ036 | Says inventory updates after each completed transaction. | Stock deducts when the paid order is created as Pending. Pending cancellations restore stock. | Change to: inventory updates after checkout creates the active order, and restores stock for Pending cancellations/refunds. |
| Page 44, Customer Ordering Process flowchart | Old flowchart saves transaction and generates slip immediately after payment/stock check. | System now routes through Active Orders and prints receipt at Ready. | Replace with `docs/Ordering_Process_Flowchart.md`. |

## Suggested Requirements to Add or Revise

Add these near the Employee functional requirements:

- The employees shall be able to select the order service type as **Dine In** or **Dine Out** before payment confirmation.
- The employees shall be able to process Cash and GCash payments. For GCash payments, the system shall require a reference number and payment proof.
- The system shall create a paid order as an **Active Order** with **Pending** status after successful checkout.
- The system shall allow staff to update active order status from **Pending** to **Preparing**, **Ready**, and **Completed**.
- The system shall allow whole-order cancellation and item removal/refund only while the order is still **Pending**.
- The system shall record a reason whenever a Pending order or item is cancelled/refunded.
- The system shall prevent cancellation or refund once an order is **Preparing**, **Ready**, or **Completed**.
- The system shall display and print the customer receipt when an order is marked **Ready**.
- The system shall save the order to Transaction History only when it is marked **Completed**, while Pending cancellations are stored as cancelled/refunded records.
- The system shall deduct ingredient inventory when checkout creates the Pending active order and restore deducted inventory when a Pending order or item is cancelled.
- The employees or authorized users shall be able to record Stock Out transactions for damaged, stolen, expired, lost, or count-corrected inventory.

## Suggested Purpose and Description Revision

Replace or revise the POS paragraph on Page 8 with this idea:

> The proposed system allows staff to process customer orders, select whether the order is for Dine In or Dine Out, apply eligible discounts, and accept Cash or GCash payments. After payment, the order is recorded as a Pending active order and monitored through the Active Orders workflow. Staff may update the order from Pending to Preparing, Ready, and Completed. Customer receipts are issued when the order is marked Ready, while final transaction records are stored after the order is completed. This improves accountability, reduces order errors, and keeps sales, refunds, and inventory records synchronized.

## Suggested Flowchart Replacement

Use the updated flowchart in:

- `docs/Ordering_Process_Flowchart.md`

It should replace the Customer Ordering Process flowchart on Page 44.

## Smaller Wording Fixes

- Change “millimeters” to **milliliters** where the paper discusses liquid ingredient measurements.
- Page 35 has `REQ0`; rename it to the correct sequence number.
- Page 35 has repeated wording: “adjust item quantities and item quantities.”
- Page 32 says “payroll processing,” but the current system does not have payroll. Replace with staff account/activity monitoring unless payroll will be added.
- If the paper mentions AI forecasting as an implemented module, keep it only in future work unless it is already present in the system.
