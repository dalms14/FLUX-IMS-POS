const backupModels = {
    products: require('../models/Product'),
    categories: require('../models/Category'),
    addons: require('../models/Addon'),
    discounts: require('../models/Discount'),
    inventory: require('../models/Inventory'),
    transactions: require('../models/Transaction'),
    refunds: require('../models/Refund'),
    recipes: require('../models/Recipe'),
    eliteMembers: require('../models/EliteMember'),
};

async function collectBackupRecords() {
    const entries = await Promise.all(Object.entries(backupModels).map(async ([key, model]) => [key, await model.find({}).lean()]));
    const data = Object.fromEntries(entries);
    const counts = Object.fromEntries(entries.map(([key, rows]) => [key, rows.length]));
    return { data, counts };
}

module.exports = { collectBackupRecords };
