# 🚀 Quick Start - Refund System

## Start Here (2 minutes to see it working)

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
npm start
```
✅ Wait for: `✅ MongoDB Connected Successfully`

### Step 2: Start Frontend (Terminal 2)  
```bash
cd frontend
npm start
```
✅ Wait for: Opens http://localhost:3000/login

### Step 3: Login
Use your existing credentials (already have admin user setup)

### Step 4: Navigate to Transactions
- Click **"Transactions"** in the sidebar (left menu)
- Should see a table of all transactions

### Step 5: Process a Refund
1. Find any transaction in the table
2. Click the **"Refund"** button on the right
3. A modal pops up:
   - ✅ Check any item
   - ✅ Select reason: "Wrong order"
   - ✅ Click "Process Refund"
4. Modal closes → refund created!

### Step 6: View the Refund
1. Click **"History"** in sidebar
2. Click **"Refunds"** tab
3. Should see your refund with status "pending" ✅

---

## What Happened Behind the Scenes

**For Made Products (have recipe):**
- System found recipe
- Calculated ingredients used
- Created Waste record
- Deducted from inventory

**For Non-Made Products:**
- System returned quantity to inventory
- No waste record

**Both:**
- Created Refund record
- Calculated tax proportionally
- Logged who processed it
- Timestamped everything

---

## See All Features

### View Transaction History
- **History** → **Transaction History** tab

### View Sales Analysis
- **History** → **Sales History** tab

### View Inventory Changes
- **History** → **Inventory History** tab
- Shows what ingredients were wasted

### View All Refunds
- **History** → **Refunds** tab
- See status of each refund

### Filter Transactions
- Go to **Transactions**
- Enter cashier name or select payment method
- Click "Apply Filters"

---

## Test Different Scenarios

### Scenario 1: Refund Made Product
1. Find transaction with food item (Chicken Alaking, etc.)
2. Click Refund
3. Check the item
4. Choose reason
5. Click Process
6. Check History → Inventory History tab
7. Should see waste record created ✅

### Scenario 2: Refund Purchased Item  
1. Find transaction with simple item (Water, etc.)
2. Click Refund
3. Check the item
4. Choose reason
5. Click Process
6. Inventory increases (no waste record) ✅

### Scenario 3: Partial Refund
1. Click Refund on multi-item transaction
2. Check ONLY some items
3. Note the calculated total changes
4. Tax is proportional ✅

### Scenario 4: View History
1. Make 2-3 refunds
2. Go to History
3. Each tab shows your data ✅

---

## Quick Commands Reference

```bash
# Start backend
cd backend && npm start

# Start frontend  
cd frontend && npm start

# Stop servers
Ctrl + C (in each terminal)
```

---

## URLs

| Page | URL | Access |
|------|-----|--------|
| Login | http://localhost:3000/login | Direct |
| Dashboard | http://localhost:3000/dashboard | After login |
| Transactions | http://localhost:3000/transactions | Sidebar |
| History | http://localhost:3000/history | Sidebar |
| Refund API | http://localhost:5000/api/refunds | Testing |

---

## Troubleshooting Quick Fixes

### "Can't connect to server"
→ Make sure backend running: `npm start` in `/backend`

### "Transactions not showing"
→ Check MongoDB is connected
→ Or try refreshing page

### "Refund button disabled"
→ Need to select item first
→ Need to select reason first

### "Modal not opening"
→ Try refreshing page
→ Check DevTools console (F12)

---

## Next Steps

- [ ] Test refunding different product types
- [ ] Test partial refunds (select some items)
- [ ] Test all refund reasons
- [ ] Check history shows correct data
- [ ] Verify inventory updates
- [ ] View waste records

---

## ✅ Success Indicators

You'll know it's working when:
- ✅ Transactions page loads (no errors)
- ✅ Can click Refund button
- ✅ Modal opens and closes smoothly
- ✅ Refund appears in History
- ✅ Inventory changes (if non-made item)
- ✅ Waste created (if made item)

---

**That's it! The system is ready to use.** 

For detailed docs, see:
- `REFUND_SYSTEM_GUIDE.md` - Complete explanation
- `DEPLOYMENT_CHECKLIST.md` - Testing guide
- `IMPLEMENTATION_SUMMARY.md` - Full overview

