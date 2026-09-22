const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('./models/Transaction');

dotenv.config();

const fixZeroTotalReceipt = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find the zero-total receipt
    const zeroTotalTx = await Transaction.findOne({
      receiptNo: 'FLX-20260510-0008'
    });
    
    if (!zeroTotalTx) {
      console.log('⚠️  Receipt FLX-20260510-0008 not found');
      process.exit(0);
    }
    
    console.log('\n📋 ZERO-TOTAL RECEIPT: FLX-20260510-0008');
    console.log('='.repeat(70));
    console.log(`Status: ${zeroTotalTx.orderStatus}`);
    console.log(`Cashier: ${zeroTotalTx.cashier}`);
    console.log(`Items: ${zeroTotalTx.items?.length || 0}`);
    console.log(`Subtotal: ₱${zeroTotalTx.subtotal}`);
    console.log(`Discount: ₱${zeroTotalTx.discount}`);
    console.log(`Total: ₱${zeroTotalTx.total}`);
    
    // Calculate what it should be
    const shouldBeTotal = zeroTotalTx.subtotal - (zeroTotalTx.discount || 0);
    console.log(`\n🔧 Fix Options:`);
    console.log(`1. Remove discount (Total: ₱${zeroTotalTx.subtotal})`);
    console.log(`2. Reduce discount to ₱1 (Total: ₱${zeroTotalTx.subtotal - 1})`);
    console.log(`3. Keep as-is (legacy dummy data)`);
    
    console.log(`\n⚠️  This appears to be a test/cancelled transaction.`);
    console.log(`   It's already marked as 'cancelled', so leaving it as-is.`);
    console.log(`   Consider cleaning up test data later.`);
    
    console.log('\n' + '='.repeat(70));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

fixZeroTotalReceipt();
