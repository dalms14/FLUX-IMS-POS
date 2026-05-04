const mongoose = require('mongoose');

const SystemAuditSchema = new mongoose.Schema({
    module: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    entityId: { type: String, default: '' },
    entityName: { type: String, default: '' },
    actor: { type: String, default: 'System' },
    actorEmail: { type: String, default: '' },
    details: { type: String, default: '' },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
    collection: 'system_audit',
    timestamps: true,
});

SystemAuditSchema.index({ createdAt: -1 });
SystemAuditSchema.index({ module: 1, createdAt: -1 });

module.exports = mongoose.model('SystemAudit', SystemAuditSchema);
