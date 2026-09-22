# Transaction Saving Debugging Guide

## Problem
Transactions are not saving on the transaction page when confirming an order.

## Root Causes Analysis

### 1. **Check Transaction Model Required Fields**
- `receiptNo`: Generated automatically ✓
- `cashier`: Required - sent from frontend ✓
- `subtotal`: Required - sent from frontend ✓
- `total`: Required - sent from frontend ✓
- `paymentMethod`: Required - must be 'Cash', 'GCash', or 'Cancelled' ✓

### 2. **Potential Issues in handleConfirmOrder (Items.jsx:1753-1797)**

#### Issue A: Async/Await Flow
```javascript
// Line 1772 - fetchActiveOrders() is NOT awaited
fetchActiveOrders();  // ❌ This should be: await fetchActiveOrders();
```
**Impact**: Transaction may be saved but UI doesn't properly refresh

#### Issue B: Missing Error Response Handling
```javascript
// The endpoint returns { success: true, receiptNo, orderNo, ... }
// But the frontend doesn't check for response.data.success
```

#### Issue C: No Network Validation
The axios call doesn't validate:
- If response is null/undefined
- If response.data contains errors
- If response status is not 200

### 3. **Potential Issues in Backend POST /api/transactions (server.js:1070)**

The endpoint returns error only if:
1. Items array is empty → Status 400
2. Insufficient stock → Status 409
3. Generic error → Status 500

### 4. **Inventory Lookup Issue**
The `buildInventoryRequirements()` function:
- Looks for recipes matching productIds
- If NO recipe found for a product → that product is SKIPPED
- This might cause inventory checking to be incomplete

### 5. **Recipe Not Found**
If a product has no recipe:
```javascript
const recipe = await Recipe.findOne({ productId: item.productId }).lean();
if (!recipe) continue;  // ❌ Product is silently skipped!
```
**Result**: Products without recipes won't have inventory deducted

## Debugging Steps

### Step 1: Check Browser Console
- Open DevTools (F12) → Console
- Try to place an order
- Look for error messages (red text)
- Check Network tab → POST /api/transactions
  - Status code?
  - Response body?
  - Error message?

### Step 2: Check Backend Logs
- Terminal running backend should show:
  - `Transaction saved: FLX-20260512-0001...` (success)
  - `Transaction error: ...` (failure)

### Step 3: Check if Recipes Exist
Run in MongoDB:
```
db.recipes.find({}).count()  // Should show count > 0
```

### Step 4: Check Frontend Response Handling
The line after axios.post should check:
```javascript
// Current code just calls the endpoint
// Should add validation:
const response = await axios.post(...)
if (!response.data.success) {
  throw new Error('Transaction failed: ' + response.data.message)
}
```

## Likely Fix Needed

In `frontend/src/pages/Items.jsx`, line ~1772:
```javascript
// BEFORE:
fetchActiveOrders();

// AFTER:
await fetchActiveOrders();
```

And add response validation after axios.post call.
