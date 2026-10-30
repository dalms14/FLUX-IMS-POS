# FLUX Relationship Register

Only ObjectId fields with an explicit Mongoose `ref` are listed. `[]` is an embedded array. References are not database-enforced foreign keys.

| ID | Source collection / field | Target | Required path | Storage |
|---|---|---|---|---|
| R01 | `products.categoryId` | `categories._id` | No | Single reference |
| R02 | `recipes.productId` | `products._id` | Yes | Single reference |
| R03 | `recipes.ingredients[].inventoryId` | `inventory._id` | No | Inside embedded array |
| R04 | `transactions.cancellationRefundId` | `refunds._id` | No | Single reference |
| R05 | `transactions.cancelledItems[].productId` | `products._id` | No | Inside embedded array |
| R06 | `transactions.cancelledItems[].refundId` | `refunds._id` | No | Inside embedded array |
| R07 | `transactions.items[].productId` | `products._id` | No | Inside embedded array |
| R08 | `refunds.transactionId` | `transactions._id` | Yes | Single reference |
| R09 | `refunds.items[].productId` | `products._id` | No | Inside embedded array |
| R10 | `waste.refundId` | `refunds._id` | Yes | Single reference |
| R11 | `waste.transactionId` | `transactions._id` | Yes | Single reference |
| R12 | `waste.items[].inventoryId` | `inventory._id` | No | Inside embedded array |
| R13 | `purchase_orders.assignedReceiver.userId` | `users._id` | No | Single reference |
| R14 | `purchase_orders.items[].inventoryId` | `inventory._id` | No | Inside embedded array |
| R15 | `purchase_orders.receipts[].items[].inventoryId` | `inventory._id` | Yes | Inside embedded array |
| R16 | `notifications.purchaseOrderId` | `purchase_orders._id` | No | Single reference |
| R17 | `login_activity.userId` | `users._id` | No | Single reference |

Additional links inside purchase-order documents:

- `receipts[].items[].itemId` and `pendingReceipts[].items[].itemId` identify `items[]._id` in the same purchase order. They are required ObjectIds without a Mongoose `ref`.
- Item names, cashier/actor emails, supplier details, and notification read-by emails are text snapshots, not ObjectId relationships.
