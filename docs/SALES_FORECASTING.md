# Sales forecasting with linear regression

The Sales page estimates sales for today and the next six days. It keeps tomorrow's estimate, the seven-day total, and seven daily bars. Training and test results are inside the collapsed **Model check** section.

## What the model learns

This is supervised machine learning using ordinary least squares linear regression, implemented in JavaScript without an external AI API or additional runtime. Each example contains a date and daily sales. Inputs are the weekday and elapsed days; the target is sales after discounts, before refunds.

The learned formula is `sales = intercept + daily trend * elapsed days + weekday adjustment`. Least squares estimates the trend and weekday intercepts from examples, using Sunday as the reference weekday. These weights are learned from sales rather than fixed prediction rules. Negative predictions are clamped to zero. Known future closures produce zero estimates.

The model is fitted again when the forecast loads or refreshes; no separate model file is saved. The API response includes learned weights, training dates, and validation results. Sales report date filters do not change the forecast.

## Model comparison

At least 42 consecutive completed days are required. The latest 14 days are held out in two seven-day checks. Each check trains only on earlier dates and predicts the following seven days. The second check can use the first week's now-observed sales. Held-out sales never train that check's model.

The original four-week same-weekday average is evaluated on the same dates using only earlier data. Mean absolute error (MAE) is the average absolute difference between predicted and actual sales, in pesos per day. Lower is better. The page reports when the average has lower error; it does not automatically switch models or claim regression always wins.

After validation, the final regression trains on all available recent history, up to 84 days. Forty-two days is a product minimum for this process, not an accuracy guarantee. Fourteen validation days cannot establish dependable long-term performance. Holidays, promotions, and price changes are not model inputs.

## Demonstration data

`GET /api/sales-forecast?source=demo` generates 56 synthetic daily examples in memory, with weekday patterns, an upward trend, and deterministic variation. This intentionally demonstrates what the model can learn. Nothing is inserted into the database, and existing test transactions are never read.

The UI labels this **ML DEMONSTRATION**. These results demonstrate training and testing; they do not establish accuracy for Eli Coffee. Synthetic data is not evidence that the model will improve the client's forecasts.

## Real sales after handover

Real mode stays off until `FORECAST_REAL_SALES_START_DATE=YYYY-MM-DD` is configured on the backend and the backend is restarted. Set it to the first full day of genuine client operations, excluding test sales. Tests entered after that date cannot be distinguished automatically; use a separate test database after handover.

`GET /api/sales-forecast?source=real` reads up to 84 completed calendar days after that date. It includes completed orders only, groups transaction creation dates in Asia/Manila, and sums totals after discounts, before refunds. Today's unfinished sales are excluded. The Sales report may include other non-cancelled statuses, so compare completed orders when reconciling.

Missing dates block forecasting rather than becoming invented zero-sales days. Confirm actual closures with optional `FORECAST_CLOSED_WEEKDAYS` (0=Sunday through 6=Saturday, comma separated) or `FORECAST_CLOSED_DATES` (comma-separated ISO dates). Recorded sales take precedence over closure settings. Historical closures contribute zero training sales; known future closures predict zero. A confirmed zero-sales operating day needs a daily close record in a future version; do not mark an open day closed to bypass missing data.

Neither mode writes sales data or sends customer information to outside services. Server-side API authentication follows the existing application design.

## Brief adviser explanation

Gumamit po kami ng linear regression para matutunan ng system yung sales trend at pattern kada araw ng linggo. Tina-train namin sa earlier sales, tapos tine-test sa later dates at kinukumpara sa simple average. Sample data pa lang po ngayon, kaya hindi pa namin kino-claim yung accuracy sa actual sales ng Eli Coffee.

## Checks

From `backend`: `node --test tests/salesForecast.test.js`.

From `frontend`: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/SalesForecast.test.jsx`, then `npm run build`.
