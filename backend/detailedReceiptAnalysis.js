const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('./models/Transaction');
const Refund = require('./models/Refund');
const Product = require('./models/Product');
const Category = require('./models/Category');

dotenv.config();

const getDetailedAnalysis = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const startDate = new Date('2026-04-12T00:00:00Z');
    const endDate = new Date('2026-05-12T23:59:59Z');
    
    console.log(`\n📅 Detailed Analysis: ${startDate.toDateString()} to ${endDate.toDateString()}\n`);
    
    // Get the zero total receipt
    const zeroTotalTx = await Transaction.findOne({
      receiptNo: 'FLX-20260510-0008',
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('items.productId');
    
    if (zeroTotalTx) {
      console.log('='.repeat(80));
      console.log('🚨 PROBLEMATIC RECEIPT: FLX-20260510-0008');
      console.log('='.repeat(80));
      console.log(`Receipt Number: ${zeroTotalTx.receiptNo}`);
      console.log(`Order Number: ${zeroTotalTx.orderNo || 'N/A'}`);
      console.log(`Created At: ${zeroTotalTx.createdAt}`);
      console.log(`Order Status: ${zeroTotalTx.orderStatus}`);
      console.log(`Cashier: ${zeroTotalTx.cashier} (${zeroTotalTx.cashierEmail || 'N/A'})`);
      console.log(`Customer Type: ${zeroTotalTx.customerType}`);
      console.log(`Service Type: ${zeroTotalTx.serviceType}`);
      console.log(`Payment Method: ${zeroTotalTx.paymentMethod}`);
      console.log(`\nFinancial Summary:`);
      console.log(`  Subtotal: ₱${zeroTotalTx.subtotal || 0}`);
      console.log(`  Discount: ₱${zeroTotalTx.discount || 0}`);
      console.log(`  Tax: ₱${zeroTotalTx.tax || 0}`);
      console.log(`  TOTAL: ₱${zeroTotalTx.total || 0} ⚠️  ZERO TOTAL!`);
      console.log(`\nItems (${zeroTotalTx.items?.length || 0}):`);
      zeroTotalTx.items?.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name}`);
        console.log(`     - Quantity: ${item.quantity}`);
        console.log(`     - Price: ₱${item.price}`);
        console.log(`     - Subtotal: ₱${item.subtotal}`);
      });
      
      if (zeroTotalTx.cancelledItems?.length > 0) {
        console.log(`\nCancelled Items (${zeroTotalTx.cancelledItems.length}):`);
        zeroTotalTx.cancelledItems.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.name} (${item.quantity}x)`);
          console.log(`     - Reason: ${item.reason}`);
          console.log(`     - Cancelled At: ${item.cancelledAt}`);
        });
      }
      
      console.log('\n' + '='.repeat(80));
    }
    
    // Check for other potential issues
    console.log('\n📊 ADDITIONAL DATA QUALITY CHECKS\n');
    
    // Check for transactions with large discounts
    const largeDiscount = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      $expr: { $gt: [{ $divide: ['$discount', '$subtotal'] }, 0.5] }
    }).select('receiptNo subtotal discount total createdAt').sort({ discount: -1 }).limit(5);
    
    if (largeDiscount.length > 0) {
      console.log('💰 Transactions with >50% discount:');
      largeDiscount.forEach(t => {
        const discountPct = ((t.discount / t.subtotal) * 100).toFixed(1);
        console.log(`  • ${t.receiptNo}: ${discountPct}% off (₱${t.discount} from ₱${t.subtotal})`);
      });
    }
    
    // Check for refund anomalies
    const refundIssues = await Refund.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'rejected' }
    }).lean();
    
    console.log(`\n🔄 Refund Summary:`);
    console.log(`  Total refunds: ${refundIssues.length}`);
    
    const refundsByStatus = {};
    refundIssues.forEach(r => {
      refundsByStatus[r.status] = (refundsByStatus[r.status] || 0) + 1;
    });
    console.log(`  By Status:`);
    Object.entries(refundsByStatus).forEach(([status, count]) => {
      console.log(`    - ${status}: ${count}`);
    });
    
    // Check for potentially problematic refunds
    const suspiciousRefunds = refundIssues.filter(r => r.totalRefunded > 10000);
    if (suspiciousRefunds.length > 0) {
      console.log(`\n⚠️  Large refunds (>₱10,000):`);
      suspiciousRefunds.forEach(r => {
        console.log(`  • ${r.receiptNo}: ₱${r.totalRefunded} - Status: ${r.status}`);
      });
    }
    
    // Summary statistics
    console.log('\n📈 Transaction Statistics:');
    const allTx = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();
    
    const totalRevenue = allTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalItems = allTx.reduce((sum, t) => sum + (t.items?.length || 0), 0);
    const byStatus = {};
    allTx.forEach(t => {
      byStatus[t.orderStatus] = (byStatus[t.orderStatus] || 0) + 1;
    });
    
    console.log(`  Total Revenue: ₱${totalRevenue.toLocaleString()}`);
    console.log(`  Total Items Sold: ${totalItems}`);
    console.log(`  By Order Status:`);
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`    - ${status}: ${count}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis Complete');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

getDetailedAnalysis();
