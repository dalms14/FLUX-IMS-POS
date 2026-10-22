# Simple sales forecasting

The Sales page estimates sales for today and the next six days. It shows tomorrow's estimate, the seven-day total, and one amount per day with a small comparison bar.

## How to explain it

For each day, take the sales from the same weekday in the previous four weeks and calculate their average.

Example: The last four Mondays had sales of PHP 4,000, PHP 5,000, PHP 4,500, and PHP 6,500. The next Monday's estimate is (4000 + 5000 + 4500 + 6500) / 4 = PHP 5,000.

This is a basic statistical forecasting method (a same-weekday moving average). It is not a trained machine-learning model. There are no regression models, confidence ranges, accuracy claims, or external AI APIs.

## Demo data

`GET /api/sales-forecast?source=demo` creates 28 sample days in memory. Nothing is inserted into the database. The UI labels these as sample estimates, not Eli Coffee sales. Existing test transactions are never used.

## Real sales after handover

Real mode remains off until `FORECAST_REAL_SALES_START_DATE=YYYY-MM-DD` is configured on the backend and the backend is restarted. Set it to the first full day of genuine client operations, excluding test sales. Tests entered after that date cannot be distinguished automatically; use a separate test database after handover.

`GET /api/sales-forecast?source=real` uses the latest 28 completed calendar days after that start date. It includes completed orders only, groups transaction creation dates in Asia/Manila, and sums transaction totals after discounts, before refunds. Today's unfinished sales are excluded. The existing Sales report may include other non-cancelled order statuses, so compare completed orders when reconciling.

The reader requires all 28 dates. Missing dates are not automatically treated as zero. Confirm actual closures using optional `FORECAST_CLOSED_WEEKDAYS` (0=Sunday through 6=Saturday, comma separated) or `FORECAST_CLOSED_DATES` (comma-separated ISO dates). Recorded sales take precedence over a closure setting. Historical closures contribute zero to their weekday average; known future closures predict zero. A confirmed zero-sales operating day needs a daily close record in a future version; do not mark an open day as closed to bypass missing data.

The forecast is recalculated when loaded or refreshed and is independent of the Sales page date filters. Four weeks is the minimum for this calculation, not a guarantee of accuracy. Holidays, promotions, price changes, and unusual events can make estimates inaccurate.

Neither mode writes sales data or sends customer information to outside services. Server-side API authentication follows the existing application design.

## Checks

From `backend`: `node --test tests/salesForecast.test.js`.
From `frontend`: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/SalesForecast.test.jsx`, then `npm run build`.
