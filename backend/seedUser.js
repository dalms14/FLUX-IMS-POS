require('dotenv').config();
const { seedAccount } = require('./services/seedAccount');
if (require.main === module) seedAccount(process.env).catch(err => { console.error('Account seed failed:', err.message); process.exitCode = 1; });
