# Refund System & History Implementation Guide

## ✅ What Was Implemented

### 1. **Functional History Page** (`/history`)
- **Transaction History Tab**: View all orders with receipt numbers, amounts, cashiers, and payment methods
- **Inventory History Tab**: Track inventory changes (waste from refunds)
- **Sales History Tab**: Aggregated product sales data
- **Refunds Tab**: View all refunds with their status and amounts
- Real API integration with loading states and error handling

### 2. **Transaction Page** (`/transactions`)
- Central hub for managing transactions
- View all transactions in a sortable table
- Filter by cashier name and payment method
- **"Refund" button** on each transaction to start refund process
- Shows transaction details: receipt no, item count, total, payment method

### 3. **Refund System**
Complete refund processing with intelligent logic:

#### **For Made Products (with Recipe):**
- ✅ Calculates ingredient amounts used
- ✅ Creates "Waste" record tracking ingredients discarded
- ✅ Deducts ingredients from inventory automatically
- 📋 Maintains waste history for auditing

#### **For Purchased Products (no Recipe):**
- ✅ Returns quantity directly back to inventory stock
- ✅ Maintains separate tracking
- ✅ No waste record created

#### **Refund Details Tracked:**
- Transaction reference
- Items refunded (with quantities & prices)
- Refund reason (Wrong order, Damaged, Customer request, Incorrect price, Other)
- Tax calculated proportionally
- Cashier/admin who processed refund
- Status: pending → approved → completed (or rejected)

---

## 🗂️ Files Created/Modified

### Backend Files

**Models Created:**
```
backend/models/Refund.js          (NEW) - Tracks all refunds
backend/models/Waste.js           (NEW) - Tracks wasted ingredients
```

**Routes Created:**
```
backend/Routes/historyRoutes.js   (NEW) - All history & refund endpoints
```

**Server Updated:**
```
backend/server.js                 (UPDATED) - Added historyRoutes import & middleware
```

### Frontend Files

**Components Created:**
```
frontend/src/components/modals/RefundModal.jsx    (NEW) - Refund processing modal
frontend/src/pages/TransactionPage.jsx            (NEW) - Transaction management page
```

**Components Updated:**
```
frontend/src/components/HistoryPage.jsx           (UPDATED) - Now uses real API
frontend/src/App.js                               (UPDATED) - Added routes
```

---

## 🚀 How to Use

### **Processing a Refund:**

1. **Navigate to Transactions** → Click "Transactions" in sidebar
2. **Find the transaction** → Browse or filter by cashier/payment method
3. **Click "Refund" button** → Opens RefundModal
4. **Select items** → Check items you want to refund
5. **Choose reason** → Select from dropdown (Wrong order, etc.)
6. **Review calculation** → See tax calculation in real-time
7. **Process refund** → Click "Process Refund"

### **Viewing History:**

1. **Click "History"** in sidebar
2. **Select tab**:
   - **Transaction History** → All orders placed
   - **Inventory History** → Ingredients wasted from refunds
   - **Sales History** → Products sold (aggregated)
   - **Refunds** → All refunds processed

---

## 📊 Backend Endpoints

### Transaction Endpoints
```
GET  /api/transactions           - Get all transactions
GET  /api/transactions/:id       - Get single transaction
GET  /api/sales-history          - Get product sales aggregation
GET  /api/inventory-history      - Get inventory changes
```

### Refund Endpoints
```
GET  /api/refunds                - Get all refunds
GET  /api/refunds/:id            - Get single refund
POST /api/refunds                - Create new refund
PATCH /api/refunds/:id/approve   - Approve pending refund
PATCH /api/refunds/:id/reject    - Reject pending refund
```

---

## 🔧 Refund Processing Logic

### Step-by-Step Process:

1. **Validate Input**
   - Transaction exists
   - At least one item selected
   - Reason provided

2. **Check Product Type**
   ```
   For each item:
     → Does it have a recipe?
     → YES → Mark as "made"
     → NO  → Mark as "not made"
   ```

3. **Process Made Items**
   ```
   If item is made:
     → Get recipe
     → Calculate ingredient amounts:
        amount = ingredient.amountPerServing × qty × size_multiplier
     → Add to Waste record
     → Deduct from Inventory
   ```

4. **Process Non-Made Items**
   ```
   If item is NOT made:
     → Find inventory item
     → Add quantity back to stock
   ```

5. **Calculate Financials**
   ```
   Subtotal = sum of all item prices
   Tax = (transaction.tax) × (subtotal / transaction.subtotal)
   Total Refund = subtotal + tax
   ```

6. **Create Records**
   - Refund document (status: "pending")
   - Waste document (if made items exist)

---

## 📝 Example Refund Scenarios

### Scenario 1: Refund Made Product
```
Item: Chicken Alaking (Solo) - ₱325
Has Recipe: YES

Recipe Uses:
- Chicken: 150g
- Oil: 30ml  
- Sauce: 100ml

Result:
- 150g Chicken → Waste record
- 30ml Oil → Waste record
- 100ml Sauce → Waste record
- Inventory deducted automatically
- Refund: ₱325 + (tax)
```

### Scenario 2: Refund Purchased Item
```
Item: Bottled Water - ₱50
Has Recipe: NO

Result:
- 1 unit → Back to Inventory
- No waste record
- Refund: ₱50 + (tax)
```

---

## ✨ Features

✅ **Automatic Refund Calculation** - Tax calculated proportionally
✅ **Smart Product Detection** - Made vs purchased items handled differently
✅ **Waste Tracking** - Complete audit trail of wasted ingredients
✅ **Inventory Management** - Automatic restoration or waste logging
✅ **Status Tracking** - Refunds have states: pending/approved/rejected
✅ **Real-time History** - All changes logged and viewable
✅ **User Attribution** - Tracks who processed each refund
✅ **Filtering** - Find transactions and refunds easily

---

## 🔍 Testing the System

### To Test Transactions Tab:
1. Start backend server: `npm start` (in `/backend`)
2. Start frontend: `npm start` (in `/frontend`)
3. Navigate to `/transactions` (Transactions in sidebar)
4. Should see all existing transactions in table format

### To Test Refund Processing:
1. Click "Refund" on any transaction
2. Select items to refund
3. Choose a reason
4. Verify calculated amount shows in summary
5. Click "Process Refund"
6. Check `/api/refunds` endpoint to verify record created

### To Test History Page:
1. Navigate to `/history` (History in sidebar)
2. Click each tab to verify:
   - Transaction History loads transactions
   - Inventory History shows waste records
   - Sales History shows aggregated sales
   - Refunds tab shows processed refunds

---

## 💡 Key Design Decisions

### Why separate Waste Model?
- **Audit Trail** - Complete history of wasted ingredients
- **Inventory Accuracy** - Made product refunds don't just add to inventory
- **Reporting** - Can calculate waste costs separately
- **Quality Control** - Track waste patterns

### Why proportional tax calculation?
- **Fairness** - Partial refunds don't refund full tax
- **Accuracy** - Matches accounting standards
- **Transparency** - Clearly shown in refund summary

### Why isMade field in Refund?
- **History** - Track how item was handled during refund
- **Auditing** - Know if waste was created or inventory restored
- **Analysis** - Identify patterns in made vs purchased refunds

---

## ⚙️ Configuration

**Backend Port**: 5000 (default)
**Frontend Port**: 3000 (default)

Update API URLs in components if using different ports:
```javascript
// Change this if backend is on different port
const res = await fetch('http://localhost:5000/api/...');
```

---

## 🎯 Next Steps (Optional Enhancements)

- [ ] Refund approval workflow (approval required by admin)
- [ ] Automated email notifications for refunds
- [ ] Refund analytics dashboard
- [ ] Bulk refund processing
- [ ] Refund return shipping tracking
- [ ] Refund reversal capability
- [ ] Partial vs full refund distinction in history

---

## 📞 Support

For questions about:
- **Backend Logic**: Check `historyRoutes.js`
- **Frontend UI**: Check `TransactionPage.jsx` and `RefundModal.jsx`
- **Data Models**: Check `Refund.js` and `Waste.js`
- **API Endpoints**: Review historyRoutes.js implementation

