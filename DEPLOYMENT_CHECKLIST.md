# FLUX-POS Refund System - Deployment & Testing Checklist

## ✅ Pre-Deployment Checklist

### Backend Setup
- [ ] All new model files created:
  - [ ] `backend/models/Refund.js`
  - [ ] `backend/models/Waste.js`
- [ ] Route file created:
  - [ ] `backend/Routes/historyRoutes.js`
- [ ] Server updated:
  - [ ] `backend/server.js` has `const historyRoutes = require('./Routes/historyRoutes');`
  - [ ] `backend/server.js` has `app.use('/api', historyRoutes);`
- [ ] MongoDB connection working
- [ ] Port 5000 is available

### Frontend Setup
- [ ] All new component files created:
  - [ ] `frontend/src/pages/TransactionPage.jsx`
  - [ ] `frontend/src/components/modals/RefundModal.jsx`
- [ ] Files updated:
  - [ ] `frontend/src/components/HistoryPage.jsx` (replaced with functional version)
  - [ ] `frontend/src/App.js` (has TransactionPage import and /transactions route)
- [ ] Port 3000 is available

---

## 🚀 Starting the Application

### Step 1: Start Backend Server
```bash
cd backend
npm install  # If needed
npm start
# Should see: ✅ MongoDB Connected Successfully
# Should see: 🚀 Server running on port 5000
```

### Step 2: Start Frontend Server
```bash
cd frontend
npm install  # If needed
npm start
# Should see: webpack compiled successfully
# Should open http://localhost:3000/login
```

### Step 3: Verify Navigation
- Log in with your credentials
- Click "Transactions" in sidebar
- Should see TransactionPage with table of transactions
- Click "History" in sidebar
- Should see HistoryPage with 4 tabs

---

## 🧪 Testing Procedures

### Test 1: View Transactions
**Steps:**
1. Navigate to `/transactions`
2. Should display table with columns: Date, Receipt No, Items, Total, Cashier, Payment, Action

**Expected Result:**
- ✅ Table populated with transactions
- ✅ No errors in console
- ✅ Filter buttons work

**If Fails:**
- Check browser console for errors
- Verify backend is running on port 5000
- Check MongoDB connection

---

### Test 2: Open Refund Modal
**Steps:**
1. Go to `/transactions`
2. Click any "Refund" button
3. RefundModal should open

**Expected Result:**
- ✅ Modal displays transaction info
- ✅ Can select items
- ✅ Reason dropdown works

**If Fails:**
- Check if RefundModal.jsx exists
- Verify import in TransactionPage.jsx

---

### Test 3: Process a Refund
**Steps:**
1. In RefundModal:
   - Check at least 1 item checkbox
   - Select a reason from dropdown
   - Click "Process Refund"

**Expected Result:**
- ✅ Modal closes
- ✅ Table refreshes
- ✅ Refund appears in History > Refunds tab

**If Fails:**
- Check backend console for errors
- Verify Refund.js model is created
- Check MongoDB collections

---

### Test 4: Check Refund Details
**Steps:**
1. Go to History > Refunds tab
2. Should see newly created refund

**Expected Result:**
- ✅ Refund appears with:
  - Date
  - Receipt No
  - Amount Refunded
  - Reason
  - Status (should be "pending")

**If Fails:**
- Check if historyRoutes.js GET /api/refunds works
- Verify Refund collection in MongoDB

---

### Test 5: Verify Inventory Impact
**Steps:**
1. Refund a **NON-MADE item** (no recipe)
2. Check inventory before and after
3. Quantity should increase

**Expected Result:**
- ✅ Inventory stock increased
- ✅ No waste record created

**If Fails:**
- Verify item doesn't have a recipe in database
- Check Inventory update logic in refund processing

---

### Test 6: Verify Waste Tracking
**Steps:**
1. Refund a **MADE item** (has recipe)
2. Check History > Inventory History tab
3. Should show waste deduction

**Expected Result:**
- ✅ Waste record created
- ✅ Shows "Deducted (Refund Waste)"
- ✅ Lists ingredients wasted

**If Fails:**
- Verify item has recipe in Recipe collection
- Check Waste.js model creation
- Verify Recipe query in historyRoutes.js

---

### Test 7: Test History Page
**Steps:**
1. Navigate to `/history`
2. Click each tab

**Expected Result:**
- ✅ Transaction History: Shows all transactions
- ✅ Inventory History: Shows waste records
- ✅ Sales History: Shows product aggregation
- ✅ Refunds: Shows all refunds with status

**If Fails:**
- Check API endpoints in historyRoutes.js
- Verify HistoryPage component state management
- Check console for fetch errors

---

## 🐛 Troubleshooting

### Problem: "Transaction not found" error
**Solution:**
1. Verify transaction ID is correct
2. Check MongoDB transactions collection
3. Try refreshing page

### Problem: Refund modal not opening
**Solution:**
1. Check browser console for errors
2. Verify RefundModal.jsx exists
3. Check import path in TransactionPage.jsx
4. Verify Transaction state is set correctly

### Problem: Inventory not updating after refund
**Solution:**
1. Check if item has recipe:
   ```bash
   # In MongoDB
   db.recipes.findOne({productId: ObjectId("...")})
   ```
2. If no recipe, verify Inventory.findOne() query
3. Check if inventory item name matches

### Problem: "Waste record not created"
**Solution:**
1. Verify refunded item has recipe
2. Check Recipe collection for ingredients
3. Verify Waste.js model created
4. Check backend console for errors

### Problem: API returns empty array
**Solution:**
1. Check if data exists in MongoDB
2. Verify filter parameters
3. Check MongoDB connection
4. Try without filters first

### Problem: "Failed to load transactions"
**Solution:**
1. Check backend server is running
2. Verify port 5000 is accessible
3. Check CORS settings
4. Look for network errors in browser DevTools

---

## 📊 Database Verification

### Check Collections Exist
```bash
# Connect to MongoDB
# Run these commands
db.collections()

# Should show:
- transactions
- refunds (NEW)
- waste (NEW)
- inventory
- recipes
```

### Verify Sample Data
```bash
# Check a transaction
db.transactions.findOne()

# Check a refund
db.refunds.findOne()

# Check waste records
db.waste.findOne()
```

---

## 🔍 API Testing with Postman

### Test Transaction Endpoint
```
GET http://localhost:5000/api/transactions
```
**Expected:** 200 OK with array of transactions

### Test Refund Endpoint
```
GET http://localhost:5000/api/refunds
```
**Expected:** 200 OK with array of refunds

### Test Create Refund
```
POST http://localhost:5000/api/refunds
Content-Type: application/json

{
  "transactionId": "mongoid",
  "receiptNo": "RCPT-20260429-001",
  "items": [
    {
      "productId": "mongoid",
      "name": "Item Name",
      "quantity": 1,
      "price": 325
    }
  ],
  "reason": "Wrong order",
  "refundedBy": "Daniel Almojera",
  "refundedByEmail": "email@example.com",
  "paymentMethod": "Cash"
}
```
**Expected:** 201 Created with refund object

---

## ✨ Feature Verification

- [ ] Can view transactions sorted by date (newest first)
- [ ] Can filter transactions by cashier
- [ ] Can filter transactions by payment method
- [ ] Can open refund modal from transaction
- [ ] Can select multiple items for refund
- [ ] Can choose refund reason
- [ ] Refund amount calculated correctly
- [ ] Tax calculated proportionally
- [ ] Refund processes successfully
- [ ] History page loads all transactions
- [ ] History page shows inventory waste
- [ ] History page shows sales aggregation
- [ ] History page shows refunds
- [ ] Made products create waste records
- [ ] Non-made products restore to inventory

---

## 📝 Log Locations

**Backend Logs:**
- Server startup messages
- Transaction processing
- Refund creation logs
- Error messages in terminal

**Frontend Logs:**
- Open DevTools (F12) after login
- Console tab shows:
  - API call logs
  - Component rendering
  - Fetch errors

**Browser Network Tab:**
- Shows all API calls
- Response status codes
- Response payloads

---

## 🎯 Success Criteria

Application is working correctly when:
1. ✅ All files created without errors
2. ✅ Backend starts without errors
3. ✅ Frontend starts without errors
4. ✅ Can navigate between pages
5. ✅ Transactions display in table
6. ✅ Refund modal opens and closes
7. ✅ Can create refunds successfully
8. ✅ History page shows data
9. ✅ Inventory updates correctly
10. ✅ Waste records created for made items

---

## 📞 Quick Reference

| Component | File | Purpose |
|-----------|------|---------|
| Transaction Page | `frontend/src/pages/TransactionPage.jsx` | View all transactions, initiate refunds |
| Refund Modal | `frontend/src/components/modals/RefundModal.jsx` | Process individual refunds |
| History Page | `frontend/src/components/HistoryPage.jsx` | View transaction, sales, inventory, refund history |
| Refund Model | `backend/models/Refund.js` | Store refund records in DB |
| Waste Model | `backend/models/Waste.js` | Store waste/disposal records |
| History Routes | `backend/Routes/historyRoutes.js` | All API endpoints for history & refunds |

