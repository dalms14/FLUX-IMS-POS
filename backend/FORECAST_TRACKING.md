# Saved forecast comparisons

The Sales page saves forecasts when its forecast request succeeds. This is page-triggered, not a background scheduler: keep using the page to generate new predictions. The existing real-sales start-date and minimum-history requirements still apply.

- MongoDB collection: `forecastsnapshots`. Mongoose creates a unique index on dataset + target date. Demo and each real-sales handover start date have separate datasets.
- Only tomorrow onward is saved. The first prediction for a date is preserved with an atomic `$setOnInsert`; refreshing does not replace it. Today's estimate remains visible in the outlook but is not saved as a pre-day prediction.
- Once a Philippine calendar day ends, tracking compares the saved estimate with completed transaction totals (after discounts, before refunds). Cancelled transactions and pre-handover transactions are excluded.
- Missing transaction days remain unconfirmed unless configured as closed. Confirmed closures count as zero. Mean absolute error includes only compared days, with no percentage-accuracy claim.
- Display includes the last 30 completed dates and pending future dates. No historical predictions are invented. On the first day, comparisons will be empty.
- Demo sales are deterministic synthetic values anchored to calendar dates. Demo comparisons never read client transactions and cannot establish client accuracy.
- If snapshot persistence fails, the outlook can still load, with a tracking-unavailable message. Check backend logs and MongoDB access before retrying.
- This collection is not included in the existing eight-group backup export.

Testing: open Sales, select a source, and inspect the saved pending rows. Refresh to verify that the estimates remain unchanged. Return after a saved target day has ended to see its comparison; do not change the device/server clock or alter historical transactions to manufacture accuracy results.
