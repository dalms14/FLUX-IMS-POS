const mongoose = require('mongoose');
const { isValidMemberName, MEMBER_NAME_ERROR } = require('../utils/memberValidation');

const EliteMemberSchema = new mongoose.Schema({
    idNumber: { type: String, required: true, unique: true, match: /^[0-9]{1,12}$/ },
    name: { type: String, required: true, trim: true, maxlength: 120, validate: { validator: isValidMemberName, message: MEMBER_NAME_ERROR } },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, default: '' },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
}, { collection: 'elite_members', timestamps: true });

module.exports = mongoose.model('EliteMember', EliteMemberSchema);
