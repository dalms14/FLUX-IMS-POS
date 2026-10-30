// Read model definitions without connecting to MongoDB or changing application data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../..');
const docs = path.join(root, 'docs');
const dateIndex = process.argv.indexOf('--as-of');
const asOf = dateIndex >= 0 ? process.argv[dateIndex + 1] : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('Use --as-of YYYY-MM-DD.');

const purposes = {
    User: 'Accounts, role and module permissions, credential hashes, login presence, recovery challenges, and archive status.',
    Category: 'Menu category names referenced by products.',
    Product: 'Menu configuration, prices, variant groups, embedded add-on choices, availability, and archiving.',
    Addon: 'Master add-on names and prices, with active/archive status.',
    Discount: 'Master discount names, percentages, application scope, and active/archive status.',
    Inventory: 'Ingredient quantities, units, low-stock thresholds, expiration batches, and archiving.',
    Recipe: 'Product-to-ingredient mapping and the quantities consumed per serving.',
    Transaction: 'Sales and cancellation records, purchased item snapshots, payment details, and applied discounts.',
    Refund: 'Refund requests/results linked to a transaction, with refunded product snapshots.',
    Waste: 'Ingredient waste associated with a refund and its original transaction.',
    PurchaseOrder: 'Supplier order details, receiver assignment, ordered lines, delivery approvals, and receiving records.',
    Notification: 'Operational messages, optional purchase-order references, audiences, and read receipts.',
    LoginActivity: 'Login, logout, and blocked-login events, with account and client metadata.',
    SystemAudit: 'Cross-module activity events and flexible change snapshots.',
    EmailVerification: 'Email verification challenge hashes, expiry, and attempt counts.',
    ForecastSnapshot: 'Saved first forecasts by dataset and target date for later comparison against sales.',
};
const order = ['Category', 'Product', 'Addon', 'Discount', 'Inventory', 'Recipe', 'Transaction', 'Refund', 'Waste', 'User', 'PurchaseOrder', 'Notification', 'LoginActivity', 'SystemAudit', 'EmailVerification', 'ForecastSnapshot'];
const models = fs.readdirSync(path.join(root, 'backend/models')).filter(file => file.endsWith('.js')).map(file => {
    const model = require(path.join(root, 'backend/models', file));
    if (!purposes[model.modelName]) throw new Error(`Document the new model: ${model.modelName}`);
    return { model, file };
}).sort((a, b) => order.indexOf(a.model.modelName) - order.indexOf(b.model.modelName));

const references = [];
function collectFields(schema, modelName, prefix = '', top = true) {
    const fields = [];
    schema.eachPath((name, type) => {
        if (name.endsWith('.$*')) return; // Map values are described on the Map field.
        const fieldPath = prefix + name;
        const opts = type.options;
        const isDocumentArray = Boolean(type.schema && type.instance === 'Array');
        const itemType = type.embeddedSchemaType?.instance || type.caster?.instance || type.$embeddedSchemaType?.instance;
        const field = {
            path: fieldPath,
            type: isDocumentArray ? 'Document[]' : type.instance === 'Array' ? `${itemType || 'Mixed'}[]` : type.instance === 'Map' ? `Map<String, ${type.$__schemaType?.instance || 'Mixed'}>` : type.instance,
            required: Boolean(type.isRequired),
            rules: [],
        };
        if (name === '_id') {
            field.default = 'Generated ObjectId';
            field.rules.push(top ? 'Document identifier (PK)' : 'Embedded subdocument identifier; local to parent');
        } else if (name === '__v') {
            field.default = '0 (on document creation)';
            field.rules.push('Mongoose version key');
        } else if (top && schema.options.timestamps && ['createdAt', 'updatedAt'].includes(name)) {
            field.default = 'Managed by Mongoose timestamps';
        } else if (Object.prototype.hasOwnProperty.call(opts, 'default')) {
            field.default = opts.default === undefined ? 'undefined (not materialized)' : typeof opts.default === 'function'
                ? (opts.default === Date.now ? 'Current date/time (Date.now)' : `Function: ${opts.default.name || 'anonymous'}`)
                : JSON.stringify(opts.default);
        } else if (type.instance === 'Array') {
            field.default = '[] (implicit Mongoose array default)';
        } else {
            field.default = 'No declared default';
        }
        for (const key of ['min', 'max', 'minlength', 'maxlength']) if (opts[key] !== undefined) field.rules.push(`${key}: ${opts[key]}`);
        if (opts.enum) field.rules.push(`Allowed: ${opts.enum.join(', ')}`);
        if (opts.trim) field.rules.push('Trim whitespace');
        if (opts.lowercase) field.rules.push('Lowercase');
        if (opts.select === false) field.rules.push('Excluded from default query selection');
        if (opts.unique) field.rules.push('Unique index declared');
        if (opts.validate) field.rules.push('Custom validator: non-empty array');
        if (opts.expires !== undefined) field.rules.push(`TTL expiry: ${opts.expires} seconds after field date`);
        if (opts.ref) {
            field.ref = opts.ref;
            field.rules.push(`Reference: ${opts.ref}._id`);
            references.push({ from: modelName, path: fieldPath, to: opts.ref, required: field.required, insideArray: fieldPath.includes('[]') });
        }
        fields.push(field);
        if (isDocumentArray) fields.push(...collectFields(type.schema, modelName, `${fieldPath}[].`, false));
    });
    return fields;
}

const collections = models.map(({ model, file }) => ({
    model: model.modelName,
    collection: model.collection.name,
    source: `backend/models/${file}`,
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'backend/models', file))).digest('hex'),
    purpose: purposes[model.modelName],
    timestamps: Boolean(model.schema.options.timestamps),
    fields: collectFields(model.schema, model.modelName),
    indexes: [{ keys: { _id: 1 }, options: { unique: true }, origin: 'MongoDB default identifier index' },
        ...model.schema.indexes().map(([keys, options]) => ({ keys, options, origin: 'Mongoose declaration' }))],
}));
references.forEach((ref, i) => { ref.id = `R${String(i + 1).padStart(2, '0')}`; });
const metadata = { title: 'FLUX implemented database schema', asOf, storage: 'MongoDB / Mongoose', collections, references };
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, 'database_schema.json'), JSON.stringify(metadata, null, 2) + '\n');

const esc = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
let dictionary = `# FLUX Data Dictionary\n\nAs of ${asOf} (Asia/Manila). Generated from the 16 implemented model files; no database connection is made.\n\n`;
dictionary += `See [Database Schema](Database_Schema.md) for diagrams, relationships, and scope notes. The machine-readable snapshot is [database_schema.json](database_schema.json).\n\n`;
dictionary += `## Reading the dictionary\n\n- Required means a Mongoose schema validator. A required child field is validated when its containing subdocument exists; it does not make its parent array mandatory.\n- \`[]\` means an embedded array, not another collection. Dotted paths identify fields inside embedded objects.\n- Top-level \`_id\` identifies a document. Array elements normally receive their own local \`_id\`.\n- Optional fields may be absent; only an explicit \`null\` default is shown as null.\n- ObjectId references are application-level links. MongoDB does not provide SQL foreign-key enforcement for these declarations.\n- Indexes below describe source declarations plus the standard identifier index; live deployed index state was not inspected. A unique index is not a Mongoose required-field validator.\n- \`Number\` is the Mongoose Number type; no Decimal128 currency type is declared.\n- \`Mixed\` permits arbitrary change data. \`Map<String, String>\` holds string-valued variant selections.\n\n`;
dictionary += `## Collection index\n\n| Collection | Model | Purpose |\n|---|---|---|\n`;
for (const c of collections) dictionary += `| \`${c.collection}\` | [${c.model}](../${c.source}) | ${c.purpose} |\n`;
for (const c of collections) {
    dictionary += `\n## ${c.collection}\n\n${c.purpose}\n\nSource: [${c.source}](../${c.source}). Automatic timestamps: **${c.timestamps ? 'createdAt and updatedAt' : 'not enabled'}**.\n\n`;
    dictionary += `| Field path | Type | Required | Default | Rules / reference |\n|---|---|---|---|---|\n`;
    for (const f of c.fields) dictionary += `| \`${f.path}\` | ${esc(f.type)} | ${f.required ? 'Yes' : f.path === '_id' ? 'Generated identifier' : 'No'} | ${esc(f.default)} | ${esc(f.rules.join('; ') || '-')} |\n`;
    dictionary += `\n### Indexes\n\n| Key(s) and order | Options | Origin |\n|---|---|---|\n`;
    for (const index of c.indexes) dictionary += `| \`${JSON.stringify(index.keys)}\` | \`${JSON.stringify(index.options)}\` | ${index.origin} |\n`;
}
dictionary += `\n## Additional application rules\n\nThese rules are outside the field declarations and must not be mistaken for database constraints.\n\n- Addon and Discount pre-validation hooks derive \`nameKey\` from a trimmed, lowercase \`name\`.\n- User save hooks hash passwords and PINs. The model retains a legacy plaintext PIN comparison fallback.\n- The checkout validation middleware requires Elite Member names and card IDs containing 1-12 digits; the Transaction model itself declares these two fields as unconstrained strings. See [validateEliteMember.js](../backend/middleware/validateEliteMember.js).\n- Product, Inventory, and User archiving uses \`archived\` and \`archivedAt\`. Addon and Discount archiving uses \`active: false\` and \`archivedAt\`.\n- The application normally edits a recipe by product, but \`recipes.productId\` has no declared unique index. The schema therefore permits multiple recipe documents for a product.\n- \`users.email\` and \`categories.name\` have no declared unique indexes in these model files. This dictionary does not add them.\n- ForecastSnapshot has no automatic timestamps; \`generatedAt\` is explicitly stored and the declared compound unique index is \`dataset + targetDate\`.\n- Category has no automatic timestamps.\n\n## Regeneration\n\nFrom the repository root:\n\n\`\`\`powershell\nnode backend/scripts/exportDatabaseSchema.js --as-of ${asOf}\n\`\`\`\n\nThe script updates this dictionary, the JSON snapshot, the relationship register, and the editable Mermaid source. It does not modify model definitions, connect to MongoDB, or apply indexes.\n`;
fs.writeFileSync(path.join(docs, 'Data_Dictionary.md'), dictionary);

let mermaid = 'erDiagram\n';
for (const c of collections) {
    mermaid += `    ${c.model} {\n        ObjectId _id PK\n`;
    for (const f of c.fields.filter(field => !['__v', '_id'].includes(field.path) && !field.path.includes('[]'))) {
        const type = f.type.endsWith('[]') ? f.type.slice(0, -2) + 'Array'
            : f.type.startsWith('Map<') ? 'StringMap' : f.type;
        mermaid += `        ${type} ${f.path.replace(/\./g, '_')}${f.ref ? ' FK' : ''} "${f.ref ? 'ref to ' + f.ref + '; ' : ''}${f.required ? 'required' : 'optional'}"\n`;
    }
    mermaid += '    }\n';
}
for (const ref of references) {
    const targetEnd = ref.insideArray ? 'o{' : ref.required ? '||' : 'o|';
    mermaid += `    ${ref.from} }o..${targetEnd} ${ref.to} : "${ref.path}"\n`;
}
fs.writeFileSync(path.join(docs, 'database_schema.mmd'), mermaid);

let register = '# FLUX Relationship Register\n\nOnly ObjectId fields with an explicit Mongoose `ref` are listed. `[]` is an embedded array. References are not database-enforced foreign keys.\n\n';
register += '| ID | Source collection / field | Target | Required path | Storage |\n|---|---|---|---|---|\n';
for (const ref of references) {
    const from = collections.find(c => c.model === ref.from).collection;
    const to = collections.find(c => c.model === ref.to).collection;
    register += `| ${ref.id} | \`${from}.${ref.path}\` | \`${to}._id\` | ${ref.required ? 'Yes' : 'No'} | ${ref.insideArray ? 'Inside embedded array' : 'Single reference'} |\n`;
}
register += '\nAdditional links inside purchase-order documents:\n\n- `receipts[].items[].itemId` and `pendingReceipts[].items[].itemId` identify `items[]._id` in the same purchase order. They are required ObjectIds without a Mongoose `ref`.\n- Item names, cashier/actor emails, supplier details, and notification read-by emails are text snapshots, not ObjectId relationships.\n';
fs.writeFileSync(path.join(docs, 'Database_Relationships.md'), register);
console.log(`Exported ${collections.length} collections, ${collections.reduce((n, c) => n + c.fields.length, 0)} field paths, and ${references.length} declared ObjectId references. No database connection made.`);
