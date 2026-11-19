# Refund period

Refunds are available for 24 elapsed hours from the original sale's saved `createdAt` timestamp. The period expires at exactly sale time plus 24 hours; it does not reset at midnight, after a partial refund, or when a record is updated.

The backend uses its own clock and the saved transaction date for both eligibility responses and refund submissions. An expired sale shows **Refund period expired** in Transactions. Missing, invalid, or future sale dates require receipt review rather than allowing a refund.

The same deadline applies to legacy refund approval/completion and order-cancellation endpoints that record refunds. There is no role-based exception to this period. Existing sale and refund records remain available as history. Retrying a previously saved refund with the same request identifier returns that existing result without issuing another refund.

Defense explanation: “A completed sale can be refunded within 24 hours of the original transaction, subject to permissions and the remaining refundable items and amount. The server enforces the deadline even if an old screen or a direct API request is used.”
