# FLUX Data Dictionary

As of 2026-10-30 (Asia/Manila). Generated from the 16 implemented model files; no database connection is made.

See [Database Schema](Database_Schema.md) for diagrams, relationships, and scope notes. The machine-readable snapshot is [database_schema.json](database_schema.json).

## Reading the dictionary

- Required means a Mongoose schema validator. A required child field is validated when its containing subdocument exists; it does not make its parent array mandatory.
- `[]` means an embedded array, not another collection. Dotted paths identify fields inside embedded objects.
- Top-level `_id` identifies a document. Array elements normally receive their own local `_id`.
- Optional fields may be absent; only an explicit `null` default is shown as null.
- ObjectId references are application-level links. MongoDB does not provide SQL foreign-key enforcement for these declarations.
- Indexes below describe source declarations plus the standard identifier index; live deployed index state was not inspected. A unique index is not a Mongoose required-field validator.
- `Number` is the Mongoose Number type; no Decimal128 currency type is declared.
- `Mixed` permits arbitrary change data. `Map<String, String>` holds string-valued variant selections.

## Collection index

| Collection | Model | Purpose |
|---|---|---|
| `categories` | [Category](../backend/models/Category.js) | Menu category names referenced by products. |
| `products` | [Product](../backend/models/Product.js) | Menu configuration, prices, variant groups, embedded add-on choices, availability, and archiving. |
| `addons` | [Addon](../backend/models/Addon.js) | Master add-on names and prices, with active/archive status. |
| `discounts` | [Discount](../backend/models/Discount.js) | Master discount names, percentages, application scope, and active/archive status. |
| `inventory` | [Inventory](../backend/models/Inventory.js) | Ingredient quantities, units, low-stock thresholds, expiration batches, and archiving. |
| `recipes` | [Recipe](../backend/models/Recipe.js) | Product-to-ingredient mapping and the quantities consumed per serving. |
| `transactions` | [Transaction](../backend/models/Transaction.js) | Sales and cancellation records, purchased item snapshots, payment details, and applied discounts. |
| `refunds` | [Refund](../backend/models/Refund.js) | Refund requests/results linked to a transaction, with refunded product snapshots. |
| `waste` | [Waste](../backend/models/Waste.js) | Ingredient waste associated with a refund and its original transaction. |
| `users` | [User](../backend/models/User.js) | Accounts, role and module permissions, credential hashes, login presence, recovery challenges, and archive status. |
| `purchase_orders` | [PurchaseOrder](../backend/models/PurchaseOrder.js) | Supplier order details, receiver assignment, ordered lines, delivery approvals, and receiving records. |
| `notifications` | [Notification](../backend/models/Notification.js) | Operational messages, optional purchase-order references, audiences, and read receipts. |
| `login_activity` | [LoginActivity](../backend/models/LoginActivity.js) | Login, logout, and blocked-login events, with account and client metadata. |
| `system_audit` | [SystemAudit](../backend/models/SystemAudit.js) | Cross-module activity events and flexible change snapshots. |
| `email_verifications` | [EmailVerification](../backend/models/EmailVerification.js) | Email verification challenge hashes, expiry, and attempt counts. |
| `forecastsnapshots` | [ForecastSnapshot](../backend/models/ForecastSnapshot.js) | Saved first forecasts by dataset and target date for later comparison against sales. |

## categories

Menu category names referenced by products.

Source: [backend/models/Category.js](../backend/models/Category.js). Automatic timestamps: **not enabled**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `name` | String | Yes | No declared default | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |

## products

Menu configuration, prices, variant groups, embedded add-on choices, availability, and archiving.

Source: [backend/models/Product.js](../backend/models/Product.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `name` | String | Yes | No declared default | Trim whitespace |
| `price` | Number | No | No declared default | min: 0 |
| `soloPrice` | Number | No | No declared default | min: 0 |
| `platterPrice` | Number | No | null | min: 0 |
| `category` | String | Yes | No declared default | - |
| `categoryId` | ObjectId | No | No declared default | Reference: Category._id |
| `description` | String | No | "" | - |
| `variants` | String[] | No | [] | - |
| `variantGroups` | Document[] | No | [] (implicit Mongoose array default) | - |
| `variantGroups[].name` | String | No | "Variant" | Trim whitespace |
| `variantGroups[].options` | String[] | No | [] | - |
| `variantGroups[].optionPrices` | Number[] | No | [] | - |
| `variantGroups[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `addons` | Document[] | No | [] (implicit Mongoose array default) | - |
| `addons[].name` | String | No | No declared default | Trim whitespace |
| `addons[].price` | Number | No | 0 | min: 0 |
| `addons[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `image` | String | No | null | - |
| `status` | String | No | "available" | Allowed: available, unavailable |
| `available` | Boolean | No | true | - |
| `archived` | Boolean | No | false | - |
| `archivedAt` | Date | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"archived":1}` | `{}` | Mongoose declaration |
| `{"category":1}` | `{}` | Mongoose declaration |
| `{"categoryId":1}` | `{}` | Mongoose declaration |
| `{"status":1}` | `{}` | Mongoose declaration |

## addons

Master add-on names and prices, with active/archive status.

Source: [backend/models/Addon.js](../backend/models/Addon.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `name` | String | Yes | No declared default | Trim whitespace |
| `nameKey` | String | Yes | No declared default | Unique index declared |
| `price` | Number | No | 0 | min: 0 |
| `active` | Boolean | No | true | - |
| `archivedAt` | Date | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"nameKey":1}` | `{"unique":true}` | Mongoose declaration |

## discounts

Master discount names, percentages, application scope, and active/archive status.

Source: [backend/models/Discount.js](../backend/models/Discount.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `name` | String | Yes | No declared default | Trim whitespace |
| `nameKey` | String | Yes | No declared default | Unique index declared |
| `percentage` | Number | Yes | No declared default | min: 0; max: 100 |
| `scope` | String | No | "order" | Allowed: item, order |
| `active` | Boolean | No | true | - |
| `archivedAt` | Date | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"nameKey":1}` | `{"unique":true}` | Mongoose declaration |

## inventory

Ingredient quantities, units, low-stock thresholds, expiration batches, and archiving.

Source: [backend/models/Inventory.js](../backend/models/Inventory.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `name` | String | Yes | No declared default | Unique index declared |
| `unit` | String | Yes | No declared default | - |
| `stock` | Number | Yes | 0 | min: 0 |
| `lowStockAt` | Number | No | 500 | - |
| `category` | String | No | "General" | - |
| `expirationDate` | Date | No | null | - |
| `expirationBatches` | Document[] | No | [] (implicit Mongoose array default) | - |
| `expirationBatches[].quantity` | Number | Yes | No declared default | min: 0 |
| `expirationBatches[].expirationDate` | Date | No | null | - |
| `expirationBatches[].receivedAt` | Date | No | Current date/time (Date.now) | - |
| `expirationBatches[].note` | String | No | "" | - |
| `expirationBatches[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `archived` | Boolean | No | false | - |
| `archivedAt` | Date | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"name":1}` | `{"unique":true}` | Mongoose declaration |
| `{"archived":1}` | `{}` | Mongoose declaration |

## recipes

Product-to-ingredient mapping and the quantities consumed per serving.

Source: [backend/models/Recipe.js](../backend/models/Recipe.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `productId` | ObjectId | Yes | No declared default | Reference: Product._id |
| `productName` | String | Yes | No declared default | - |
| `ingredients` | Document[] | No | [] (implicit Mongoose array default) | - |
| `ingredients[].inventoryId` | ObjectId | No | No declared default | Reference: Inventory._id |
| `ingredients[].name` | String | No | No declared default | - |
| `ingredients[].amountPerServing` | Number | No | No declared default | - |
| `ingredients[].unit` | String | No | No declared default | - |
| `ingredients[].platterMultiplier` | Number | No | 3 | - |
| `ingredients[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |

## transactions

Sales and cancellation records, purchased item snapshots, payment details, and applied discounts.

Source: [backend/models/Transaction.js](../backend/models/Transaction.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `receiptNo` | String | Yes | No declared default | Unique index declared |
| `orderNo` | String | No | "" | - |
| `orderStatus` | String | No | "completed" | Allowed: pending, preparing, ready, completed, cancelled |
| `statusUpdatedAt` | Date | No | Current date/time (Date.now) | - |
| `cancelledAt` | Date | No | null | - |
| `cancelledBy` | String | No | "" | - |
| `cancelReason` | String | No | "" | - |
| `cancellationRefundId` | ObjectId | No | null | Reference: Refund._id |
| `cancelledItems` | Document[] | No | [] (implicit Mongoose array default) | - |
| `cancelledItems[].originalIndex` | Number | No | No declared default | - |
| `cancelledItems[].productId` | ObjectId | No | No declared default | Reference: Product._id |
| `cancelledItems[].name` | String | No | No declared default | - |
| `cancelledItems[].quantity` | Number | No | No declared default | - |
| `cancelledItems[].price` | Number | No | No declared default | - |
| `cancelledItems[].subtotal` | Number | No | No declared default | - |
| `cancelledItems[].reason` | String | No | No declared default | - |
| `cancelledItems[].cancelledBy` | String | No | No declared default | - |
| `cancelledItems[].cancelledByEmail` | String | No | No declared default | - |
| `cancelledItems[].refundId` | ObjectId | No | No declared default | Reference: Refund._id |
| `cancelledItems[].cancelledAt` | Date | No | Current date/time (Date.now) | - |
| `cancelledItems[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `cashier` | String | Yes | No declared default | - |
| `cashierEmail` | String | No | "" | - |
| `customerType` | String | No | "customer" | Allowed: customer, elite, pagibig, pwd_senior, custom_discount |
| `serviceType` | String | No | "Dine In" | Allowed: Dine In, Dine Out |
| `eliteMember.name` | String | No | No declared default | - |
| `eliteMember.idNumber` | String | No | No declared default | - |
| `discountInfo.name` | String | No | No declared default | - |
| `discountInfo.percentage` | Number | No | No declared default | - |
| `discountInfo.code` | String | No | No declared default | - |
| `discountInfo.scope` | String | No | No declared default | - |
| `items` | Document[] | No | [] (implicit Mongoose array default) | - |
| `items[].productId` | ObjectId | No | No declared default | Reference: Product._id |
| `items[].name` | String | No | No declared default | - |
| `items[].category` | String | No | No declared default | - |
| `items[].size` | String | No | No declared default | - |
| `items[].selectedVariant` | String | No | No declared default | - |
| `items[].selectedVariantGroups` | Map<String, String> | No | {} | - |
| `items[].variantPrice` | Number | No | 0 | - |
| `items[].upgrades` | Document[] | No | [] (implicit Mongoose array default) | - |
| `items[].upgrades[].name` | String | No | No declared default | - |
| `items[].upgrades[].price` | Number | No | No declared default | - |
| `items[].upgrades[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `items[].price` | Number | No | No declared default | - |
| `items[].quantity` | Number | No | No declared default | - |
| `items[].subtotal` | Number | No | No declared default | - |
| `items[].discountEligibleQuantity` | Number | No | 0 | - |
| `items[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `subtotal` | Number | Yes | No declared default | - |
| `tax` | Number | No | 0 | - |
| `discount` | Number | No | 0 | - |
| `total` | Number | Yes | No declared default | - |
| `paymentMethod` | String | Yes | No declared default | Allowed: Cash, GCash, Cancelled |
| `amountTendered` | Number | No | 0 | - |
| `change` | Number | No | 0 | - |
| `gcashReference` | String | No | null | - |
| `gcashProofImage` | String | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"receiptNo":1}` | `{"unique":true}` | Mongoose declaration |

## refunds

Refund requests/results linked to a transaction, with refunded product snapshots.

Source: [backend/models/Refund.js](../backend/models/Refund.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `transactionId` | ObjectId | Yes | No declared default | Reference: Transaction._id |
| `receiptNo` | String | Yes | No declared default | - |
| `items` | Document[] | No | [] (implicit Mongoose array default) | - |
| `items[].productId` | ObjectId | No | No declared default | Reference: Product._id |
| `items[].name` | String | No | No declared default | - |
| `items[].quantity` | Number | No | No declared default | - |
| `items[].price` | Number | No | No declared default | - |
| `items[].subtotal` | Number | No | No declared default | - |
| `items[].isMade` | Boolean | No | No declared default | - |
| `items[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `reason` | String | Yes | No declared default | - |
| `subtotal` | Number | Yes | No declared default | - |
| `tax` | Number | No | 0 | - |
| `totalRefunded` | Number | Yes | No declared default | - |
| `refundedBy` | String | Yes | No declared default | - |
| `refundedByEmail` | String | No | "" | - |
| `paymentMethod` | String | Yes | No declared default | Allowed: Cash, GCash |
| `status` | String | No | "pending" | Allowed: pending, approved, completed, rejected |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |

## waste

Ingredient waste associated with a refund and its original transaction.

Source: [backend/models/Waste.js](../backend/models/Waste.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `refundId` | ObjectId | Yes | No declared default | Reference: Refund._id |
| `transactionId` | ObjectId | Yes | No declared default | Reference: Transaction._id |
| `receiptNo` | String | Yes | No declared default | - |
| `items` | Document[] | No | [] (implicit Mongoose array default) | - |
| `items[].inventoryId` | ObjectId | No | No declared default | Reference: Inventory._id |
| `items[].inventoryName` | String | No | No declared default | - |
| `items[].unit` | String | No | No declared default | - |
| `items[].amountWasted` | Number | No | No declared default | - |
| `items[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `reason` | String | No | No declared default | - |
| `disposedBy` | String | Yes | No declared default | - |
| `notes` | String | No | "" | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |

## users

Accounts, role and module permissions, credential hashes, login presence, recovery challenges, and archive status.

Source: [backend/models/User.js](../backend/models/User.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `name` | String | No | No declared default | - |
| `email` | String | No | No declared default | - |
| `password` | String | No | No declared default | - |
| `mustChangePassword` | Boolean | No | false | - |
| `firstLoginTokenHash` | String | No | null | Excluded from default query selection |
| `firstLoginTokenExpiresAt` | Date | No | null | Excluded from default query selection |
| `role` | String | No | No declared default | - |
| `jobRole` | String | No | No declared default | - |
| `permissions` | String[] | No | undefined (not materialized) | - |
| `pin` | String | No | No declared default | - |
| `profileImage` | String | No | No declared default | - |
| `isOnline` | Boolean | No | false | - |
| `lastSeenAt` | Date | No | No declared default | - |
| `archived` | Boolean | No | false | - |
| `archivedAt` | Date | No | null | - |
| `passwordResetOtpHash` | String | No | null | Excluded from default query selection |
| `passwordResetOtpExpiresAt` | Date | No | null | Excluded from default query selection |
| `passwordResetOtpAttempts` | Number | No | 0 | Excluded from default query selection |
| `passwordResetOtpUsedAt` | Date | No | null | Excluded from default query selection |
| `userId` | String | Yes | No declared default | Unique index declared |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"archived":1}` | `{}` | Mongoose declaration |
| `{"userId":1}` | `{"unique":true}` | Mongoose declaration |

## purchase_orders

Supplier order details, receiver assignment, ordered lines, delivery approvals, and receiving records.

Source: [backend/models/PurchaseOrder.js](../backend/models/PurchaseOrder.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `purchaseOrderNo` | String | Yes | No declared default | Trim whitespace; Unique index declared |
| `supplierName` | String | Yes | No declared default | Trim whitespace |
| `supplierContact` | String | No | "" | Trim whitespace |
| `orderDate` | Date | No | Current date/time (Date.now) | - |
| `expectedDeliveryDate` | Date | No | null | - |
| `status` | String | No | "Draft" | Allowed: Draft, Approved, Arrival Pending Approval, Partially Received, Received, Cancelled |
| `notes` | String | No | "" | Trim whitespace |
| `assignedReceiver.userId` | ObjectId | No | null | Reference: User._id |
| `assignedReceiver.name` | String | No | "" | - |
| `assignedReceiver.email` | String | No | "" | - |
| `items` | Document[] | No | [] (implicit Mongoose array default) | Custom validator: non-empty array |
| `items[].inventoryId` | ObjectId | No | null | Reference: Inventory._id |
| `items[].name` | String | Yes | No declared default | Trim whitespace |
| `items[].unit` | String | Yes | No declared default | Trim whitespace |
| `items[].category` | String | No | "General" | Trim whitespace |
| `items[].lowStockAt` | Number | No | 0 | min: 0 |
| `items[].orderedQuantity` | Number | Yes | No declared default | min: 0.000001 |
| `items[].receivedQuantity` | Number | No | 0 | min: 0 |
| `items[].unitCost` | Number | No | 0 | min: 0 |
| `items[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `receipts` | Document[] | No | [] | - |
| `receipts[].receivedAt` | Date | No | Current date/time (Date.now) | - |
| `receipts[].receivedBy` | String | No | "System" | - |
| `receipts[].receivedByEmail` | String | No | "" | - |
| `receipts[].items` | Document[] | No | [] (implicit Mongoose array default) | - |
| `receipts[].items[].itemId` | ObjectId | Yes | No declared default | - |
| `receipts[].items[].inventoryId` | ObjectId | Yes | No declared default | Reference: Inventory._id |
| `receipts[].items[].name` | String | Yes | No declared default | - |
| `receipts[].items[].quantity` | Number | Yes | No declared default | min: 0.000001 |
| `receipts[].items[].expirationDate` | Date | No | null | - |
| `receipts[].items[].note` | String | No | "" | - |
| `receipts[].items[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `receipts[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `pendingReceipts` | Document[] | No | [] | - |
| `pendingReceipts[].arrivedAt` | Date | No | Current date/time (Date.now) | - |
| `pendingReceipts[].reportedBy` | String | No | "System" | - |
| `pendingReceipts[].reportedByEmail` | String | No | "" | - |
| `pendingReceipts[].status` | String | No | "Pending Approval" | Allowed: Pending Approval, Approved, Rejected |
| `pendingReceipts[].reviewedBy` | String | No | "" | - |
| `pendingReceipts[].reviewedByEmail` | String | No | "" | - |
| `pendingReceipts[].reviewedAt` | Date | No | null | - |
| `pendingReceipts[].rejectionReason` | String | No | "" | - |
| `pendingReceipts[].items` | Document[] | No | [] (implicit Mongoose array default) | - |
| `pendingReceipts[].items[].itemId` | ObjectId | Yes | No declared default | - |
| `pendingReceipts[].items[].name` | String | Yes | No declared default | - |
| `pendingReceipts[].items[].quantity` | Number | Yes | No declared default | min: 0.000001 |
| `pendingReceipts[].items[].expirationDate` | Date | No | null | - |
| `pendingReceipts[].items[].note` | String | No | "" | - |
| `pendingReceipts[].items[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `pendingReceipts[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `createdBy` | String | No | "System" | - |
| `createdByEmail` | String | No | "" | - |
| `approvedBy` | String | No | "" | - |
| `approvedAt` | Date | No | null | - |
| `cancelledBy` | String | No | "" | - |
| `cancelledAt` | Date | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"purchaseOrderNo":1}` | `{"unique":true}` | Mongoose declaration |
| `{"status":1,"createdAt":-1}` | `{}` | Mongoose declaration |
| `{"supplierName":1,"createdAt":-1}` | `{}` | Mongoose declaration |

## notifications

Operational messages, optional purchase-order references, audiences, and read receipts.

Source: [backend/models/Notification.js](../backend/models/Notification.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `type` | String | Yes | No declared default | - |
| `title` | String | Yes | No declared default | - |
| `message` | String | Yes | No declared default | - |
| `purchaseOrderId` | ObjectId | No | null | Reference: PurchaseOrder._id |
| `purchaseOrderNo` | String | No | "" | - |
| `audiences` | String[] | No | [] | - |
| `readBy` | Document[] | No | [] (implicit Mongoose array default) | - |
| `readBy[].email` | String | No | No declared default | - |
| `readBy[].readAt` | Date | No | No declared default | - |
| `readBy[]._id` | ObjectId | No | Generated ObjectId | Embedded subdocument identifier; local to parent |
| `resolvedAt` | Date | No | null | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"resolvedAt":1,"createdAt":-1}` | `{}` | Mongoose declaration |

## login_activity

Login, logout, and blocked-login events, with account and client metadata.

Source: [backend/models/LoginActivity.js](../backend/models/LoginActivity.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `userId` | ObjectId | No | No declared default | Reference: User._id |
| `name` | String | Yes | No declared default | - |
| `email` | String | Yes | No declared default | - |
| `role` | String | Yes | No declared default | - |
| `action` | String | No | "login" | Allowed: login, logout, login_blocked_archived |
| `staffId` | String | No | "" | - |
| `ipAddress` | String | No | "" | - |
| `userAgent` | String | No | "" | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"createdAt":-1}` | `{}` | Mongoose declaration |
| `{"email":1,"createdAt":-1}` | `{}` | Mongoose declaration |
| `{"role":1,"createdAt":-1}` | `{}` | Mongoose declaration |

## system_audit

Cross-module activity events and flexible change snapshots.

Source: [backend/models/SystemAudit.js](../backend/models/SystemAudit.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `module` | String | Yes | No declared default | Trim whitespace |
| `action` | String | Yes | No declared default | Trim whitespace |
| `entityId` | String | No | "" | - |
| `entityName` | String | No | "" | - |
| `actor` | String | No | "System" | - |
| `actorEmail` | String | No | "" | - |
| `details` | String | No | "" | - |
| `changes` | Mixed | No | Function: anonymous | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"createdAt":-1}` | `{}` | Mongoose declaration |
| `{"module":1,"createdAt":-1}` | `{}` | Mongoose declaration |

## email_verifications

Email verification challenge hashes, expiry, and attempt counts.

Source: [backend/models/EmailVerification.js](../backend/models/EmailVerification.js). Automatic timestamps: **createdAt and updatedAt**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `email` | String | Yes | No declared default | Trim whitespace; Lowercase; Unique index declared |
| `otpHash` | String | Yes | No declared default | Excluded from default query selection |
| `expiresAt` | Date | Yes | No declared default | TTL expiry: 0 seconds after field date |
| `attempts` | Number | No | 0 | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `createdAt` | Date | No | Managed by Mongoose timestamps | - |
| `updatedAt` | Date | No | Managed by Mongoose timestamps | - |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"email":1}` | `{"unique":true}` | Mongoose declaration |
| `{"expiresAt":1}` | `{"expireAfterSeconds":0}` | Mongoose declaration |

## forecastsnapshots

Saved first forecasts by dataset and target date for later comparison against sales.

Source: [backend/models/ForecastSnapshot.js](../backend/models/ForecastSnapshot.js). Automatic timestamps: **not enabled**.

| Field path | Type | Required | Default | Rules / reference |
|---|---|---|---|---|
| `dataset` | String | Yes | No declared default | - |
| `source` | String | Yes | No declared default | Allowed: demo, real |
| `targetDate` | String | Yes | No declared default | - |
| `predictedSales` | Number | Yes | No declared default | min: 0 |
| `generatedAt` | Date | Yes | No declared default | - |
| `trainedThrough` | String | Yes | No declared default | - |
| `method` | String | No | No declared default | - |
| `_id` | ObjectId | Generated identifier | Generated ObjectId | Document identifier (PK) |
| `__v` | Number | No | 0 (on document creation) | Mongoose version key |

### Indexes

| Key(s) and order | Options | Origin |
|---|---|---|
| `{"_id":1}` | `{"unique":true}` | MongoDB default identifier index |
| `{"dataset":1,"targetDate":1}` | `{"unique":true}` | Mongoose declaration |

## Additional application rules

These rules are outside the field declarations and must not be mistaken for database constraints.

- Addon and Discount pre-validation hooks derive `nameKey` from a trimmed, lowercase `name`.
- User save hooks hash passwords and PINs. The model retains a legacy plaintext PIN comparison fallback.
- The checkout validation middleware requires Elite Member names and card IDs containing 1-12 digits; the Transaction model itself declares these two fields as unconstrained strings. See [validateEliteMember.js](../backend/middleware/validateEliteMember.js).
- Product, Inventory, and User archiving uses `archived` and `archivedAt`. Addon and Discount archiving uses `active: false` and `archivedAt`.
- The application normally edits a recipe by product, but `recipes.productId` has no declared unique index. The schema therefore permits multiple recipe documents for a product.
- `users.email` and `categories.name` have no declared unique indexes in these model files. This dictionary does not add them.
- ForecastSnapshot has no automatic timestamps; `generatedAt` is explicitly stored and the declared compound unique index is `dataset + targetDate`.
- Category has no automatic timestamps.

## Regeneration

From the repository root:

```powershell
node backend/scripts/exportDatabaseSchema.js --as-of 2026-10-30
```

The script updates this dictionary, the JSON snapshot, the relationship register, and the editable Mermaid source. It does not modify model definitions, connect to MongoDB, or apply indexes.
