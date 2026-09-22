const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('./models/Transaction');

dotenv.config();

const fixUndefinedOrderStatus = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const startDate = new Date('2026-04-12T00:00:00Z');
    const endDate = new Date('2026-05-12T23:59:59Z');
    
    // Find all transactions with undefined orderStatus
    const undefinedStatusTransactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [
        { orderStatus: null },
        { orderStatus: undefined },
        { orderStatus: { $exists: false } }
      ]
    });
    
    console.log(`\n📋 Found ${undefinedStatusTransactions.length} transactions with undefined orderStatus\n`);
    
    if (undefinedStatusTransactions.length === 0) {
      console.log('✅ No transactions to fix!');
      process.exit(0);
    }
    
    // Group by cashier for logging
    const byReceiptPrefix = {};
    undefinedStatusTransactions.forEach(t => {
      const prefix = t.receiptNo.split('-')[0];
      if (!byReceiptPrefix[prefix]) {
        byReceiptPrefix[prefix] = [];
      }
      byReceiptPrefix[prefix].push(t.receiptNo);
    });
    
    console.log('Breakdown by receipt prefix:');
    Object.entries(byReceiptPrefix).forEach(([prefix, receipts]) => {
      console.log(`  ${prefix}: ${receipts.length} receipts`);
    });
    
    // Update all to 'completed' status
    console.log(`\n🔄 Setting all to orderStatus: 'completed'...\n`);
    
    const result = await Transaction.updateMany(
      {
        createdAt: { $gte: startDate, $lte: endDate },
        $or: [
          { orderStatus: null },
          { orderStatus: undefined },
          { orderStatus: { $exists: false } }
        ]
      },
      { $set: { orderStatus: 'completed' } }
    );
    
    console.log(`✅ Update Results:`);
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}`);
    
    // Verify the fix
    console.log(`\n✓ Verifying fix...`);
    const stillUndefined = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [
        { orderStatus: null },
        { orderStatus: undefined },
        { orderStatus: { $exists: false } }
      ]
    });
    
    if (stillUndefined.length === 0) {
      console.log('✅ All transactions now have valid orderStatus!');
    } else {
      console.log(`⚠️  ${stillUndefined.length} transactions still have undefined status`);
    }
    
    // Show updated stats
    const allTx = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();
    
    const byStatus = {};
    allTx.forEach(t => {
      byStatus[t.orderStatus || 'undefined'] = (byStatus[t.orderStatus || 'undefined'] || 0) + 1;
    });
    
    console.log(`\n📊 Updated transaction status distribution:`);
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 Fix Complete! Dashboard should now show all transactions.');
    console.log('='.repeat(70));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

fixUndefinedOrderStatus();
