require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const count = await Product.countDocuments();
    console.log('Total Products in MongoDB:', count);

    const byCategory = await Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    console.log('\nProducts by Category:');
    byCategory.forEach(cat => console.log(`  ${cat._id}: ${cat.count}`));

    console.log('\n--- Details ---');
    const allProducts = await Product.find({});
    console.log('Detailed List:');
    allProducts.forEach(p => console.log(`  - ${p.name} (${p.category})`));

    process.exit();
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
