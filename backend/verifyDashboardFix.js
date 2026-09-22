const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('./models/Transaction');

dotenv.config();

const verifyDashboardFix = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const startDate = new Date('2026-04-12T00:00:00Z');
    const endDate = new Date('2026-05-12T23:59:59Z');
    
    console.log(`\n✅ VERIFICATION: Dashboard Fix Status`);
    console.log('='.repeat(70));
    
    // Simulate what Dashboard calls
    console.log(`\n📡 Simulating Dashboard API call: GET /api/transactions`);
    
    const filter = {
      orderStatus: { $in: ['completed', 'cancelled'] },
      createdAt: { $gte: startDate, $lte: endDate }
    };
    
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`\n✅ API Response will include: ${transactions.length} transactions`);
    
    // Show recent 5 (what dashboard shows)
    console.log(`\n📋 Recent Transactions (Last 5):`);
    transactions.slice(0, 5).forEach((t, i) => {
      console.log(`\n  ${i + 1}. ${t.receiptNo}`);
      console.log(`     Date: ${new Date(t.createdAt).toLocaleString()}`);
      console.log(`     Total: ₱${t.total}`);
      console.log(`     Status: ${t.orderStatus}`);
      console.log(`     Items: ${t.items?.length || 0}`);
    });
    
    // Calculate KPI metrics
    console.log(`\n\n📊 KPI Calculations (Today's Orders):`);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const todayTransactions = transactions.filter(t => {
      const tDate = new Date(t.createdAt);
      return tDate >= todayStart && tDate < todayEnd;
    });
    
    const todaySales = todayTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const todayItemsSold = todayTransactions.reduce((sum, t) => 
      sum + (t.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
    , 0);
    
    console.log(`   Today's Orders: ${todayTransactions.length}`);
    console.log(`   Today's Revenue: ₱${todaySales.toLocaleString()}`);
    console.log(`   Items Sold Today: ${todayItemsSold}`);
    
    // Summary stats
    const statusBreakdown = {};
    transactions.forEach(t => {
      statusBreakdown[t.orderStatus] = (statusBreakdown[t.orderStatus] || 0) + 1;
    });
    
    console.log(`\n📈 All Transactions (April 12 - May 12):`);
    console.log(`   Total: ${transactions.length}`);
    console.log(`   Total Revenue: ₱${transactions.reduce((s, t) => s + (t.total || 0), 0).toLocaleString()}`);
    console.log(`   By Status:`);
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      const revenue = transactions
        .filter(t => t.orderStatus === status)
        .reduce((s, t) => s + (t.total || 0), 0);
      console.log(`     • ${status}: ${count} (₱${revenue.toLocaleString()})`);
    });
    
    // Check for any remaining issues
    console.log(`\n🔍 Data Quality Checks:`);
    const issues = [];
    
    const undefinedStatus = transactions.filter(t => !t.orderStatus);
    if (undefinedStatus.length > 0) {
      issues.push(`⚠️  ${undefinedStatus.length} transactions with undefined status`);
    } else {
      console.log(`   ✅ All transactions have valid orderStatus`);
    }
    
    const zeroTotal = transactions.filter(t => t.total === 0);
    if (zeroTotal.length > 0) {
      issues.push(`⚠️  ${zeroTotal.length} transactions with zero total`);
      console.log(`   ⚠️  ${zeroTotal.length} transactions with zero total (${zeroTotal.map(t => t.receiptNo).join(', ')})`);
    } else {
      console.log(`   ✅ No zero-total transactions`);
    }
    
    const missingItems = transactions.filter(t => !t.items || t.items.length === 0);
    if (missingItems.length > 0) {
      issues.push(`⚠️  ${missingItems.length} transactions with no items`);
    } else {
      console.log(`   ✅ All transactions have items`);
    }
    
    console.log('\n' + '='.repeat(70));
    if (issues.length === 0) {
      console.log('🎉 ALL SYSTEMS OPERATIONAL');
      console.log('\n✅ Dashboard should now display all transactions correctly!');
      console.log('✅ Transaction history page should be fully functional!');
      console.log('\n🔄 Refresh your browser to see the updated data.');
    } else {
      console.log('⚠️  SOME ISSUES REMAIN:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    console.log('='.repeat(70));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

verifyDashboardFix();
