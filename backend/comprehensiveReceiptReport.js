const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('./models/Transaction');
const Refund = require('./models/Refund');
const Product = require('./models/Product');

dotenv.config();

const generateComprehensiveReport = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const startDate = new Date('2026-04-12T00:00:00Z');
    const endDate = new Date('2026-05-12T23:59:59Z');
    
    console.log(`\n🔍 COMPREHENSIVE BUG REPORT\n📅 Date Range: April 12, 2026 - May 12, 2026\n`);
    
    // Find all problematic receipts
    const allTx = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();
    
    // 1. Zero or negative totals
    console.log('1️⃣  ZERO/NEGATIVE TOTAL RECEIPTS');
    console.log('='.repeat(80));
    const zeroTotalReceipts = allTx.filter(t => (t.total || 0) <= 0);
    if (zeroTotalReceipts.length > 0) {
      zeroTotalReceipts.forEach(t => {
        console.log(`\n📋 ${t.receiptNo}`);
        console.log(`   Date: ${new Date(t.createdAt).toLocaleString()}`);
        console.log(`   Cashier: ${t.cashier}`);
        console.log(`   Status: ${t.orderStatus}`);
        console.log(`   Items: ${t.items?.length || 0}`);
        console.log(`   Subtotal: ₱${t.subtotal}`);
        console.log(`   Discount: ₱${t.discount}`);
        console.log(`   Total: ₱${t.total} ⚠️`);
      });
    } else {
      console.log('✅ No zero/negative total receipts found');
    }
    
    // 2. Undefined order status
    console.log('\n\n2️⃣  UNDEFINED ORDER STATUS');
    console.log('='.repeat(80));
    const undefinedStatus = allTx.filter(t => !t.orderStatus || t.orderStatus === 'undefined');
    console.log(`Found: ${undefinedStatus.length} transactions\n`);
    if (undefinedStatus.length > 0) {
      const samples = undefinedStatus.slice(0, 5);
      samples.forEach(t => {
        console.log(`📋 ${t.receiptNo}`);
        console.log(`   Date: ${new Date(t.createdAt).toLocaleString()}`);
        console.log(`   Total: ₱${t.total}`);
        console.log(`   Status Value: ${t.orderStatus || 'null/undefined'}`);
      });
      if (undefinedStatus.length > 5) {
        console.log(`... and ${undefinedStatus.length - 5} more`);
      }
    }
    
    // 3. 100% discount receipts
    console.log('\n\n3️⃣  100% DISCOUNT RECEIPTS (Custom Discount Type)');
    console.log('='.repeat(80));
    const fullDiscount = allTx.filter(t => t.subtotal > 0 && t.discount >= t.subtotal);
    console.log(`Found: ${fullDiscount.length} transactions\n`);
    fullDiscount.forEach(t => {
      console.log(`📋 ${t.receiptNo}`);
      console.log(`   Date: ${new Date(t.createdAt).toLocaleString()}`);
      console.log(`   Cashier: ${t.cashier}`);
      console.log(`   Subtotal: ₱${t.subtotal}`);
      console.log(`   Discount: ₱${t.discount}`);
      console.log(`   Total: ₱${t.total}`);
      console.log(`   Items: ${t.items?.map(i => `${i.name}(${i.quantity})`).join(', ')}`);
    });
    
    // 4. Missing critical fields
    console.log('\n\n4️⃣  MISSING CRITICAL FIELDS');
    console.log('='.repeat(80));
    const missingFields = {
      noCashier: allTx.filter(t => !t.cashier),
      noPaymentMethod: allTx.filter(t => !t.paymentMethod),
      noItems: allTx.filter(t => !t.items || t.items.length === 0),
    };
    
    console.log(`No cashier: ${missingFields.noCashier.length}`);
    console.log(`No payment method: ${missingFields.noPaymentMethod.length}`);
    console.log(`No items: ${missingFields.noItems.length}`);
    
    // 5. Payment method breakdown
    console.log('\n\n5️⃣  PAYMENT METHOD BREAKDOWN');
    console.log('='.repeat(80));
    const paymentMethods = {};
    allTx.forEach(t => {
      const method = t.paymentMethod || 'undefined';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });
    
    Object.entries(paymentMethods).forEach(([method, count]) => {
      const revenue = allTx
        .filter(t => (t.paymentMethod || 'undefined') === method)
        .reduce((sum, t) => sum + (t.total || 0), 0);
      console.log(`${method}: ${count} transactions | Revenue: ₱${revenue.toLocaleString()}`);
    });
    
    // 6. Top problematic cashiers
    console.log('\n\n6️⃣  CASHIERS WITH MOST DISCREPANCIES');
    console.log('='.repeat(80));
    const cashierIssues = {};
    allTx.filter(t => (t.total || 0) <= 0 || !t.orderStatus).forEach(t => {
      if (!cashierIssues[t.cashier]) {
        cashierIssues[t.cashier] = { count: 0, issues: [] };
      }
      cashierIssues[t.cashier].count++;
      cashierIssues[t.cashier].issues.push(t.receiptNo);
    });
    
    Object.entries(cashierIssues).forEach(([cashier, data]) => {
      console.log(`\n${cashier}: ${data.count} problematic transactions`);
      console.log(`  Receipts: ${data.issues.join(', ')}`);
    });
    
    // 7. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total transactions analyzed: ${allTx.length}`);
    console.log(`Total revenue: ₱${allTx.reduce((s, t) => s + (t.total || 0), 0).toLocaleString()}`);
    console.log(`\nTotal issues found: ${zeroTotalReceipts.length + undefinedStatus.length + fullDiscount.length}`);
    console.log(`  • Zero/negative totals: ${zeroTotalReceipts.length}`);
    console.log(`  • Undefined status: ${undefinedStatus.length}`);
    console.log(`  • Full discounts: ${fullDiscount.length}`);
    console.log('\n✅ Report Complete');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

generateComprehensiveReport();
