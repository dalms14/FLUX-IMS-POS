const express = require('express');
const mongoose = require('mongoose');
const EliteMember = require('../models/EliteMember');
const SystemAudit = require('../models/SystemAudit');
const { canManageEliteMembers } = require('../utils/permissions');
const { isValidMemberName, MEMBER_NAME_ERROR } = require('../utils/memberValidation');

const router = express.Router();
const validCard = value => typeof value === 'string' && /^[0-9]{1,12}$/.test(value);
const publicMember = member => ({ name: member.name, idNumber: member.idNumber });
const fields = body => ({ name: typeof body.name === 'string' ? body.name.trim() : '',
    idNumber: body.idNumber, status: body.status ?? 'active', notes: typeof body.notes === 'string' ? body.notes.trim() : '' });
const invalidFields = member => !isValidMemberName(member.name) || !validCard(member.idNumber)
    || !['active', 'inactive'].includes(member.status) || member.notes.length > 500;

function failure(res, error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That card ID is already registered. Edit, restore or reactivate its existing record.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check the member name, card ID and status.' });
    console.error('Elite Member operation failed:', error.message);
    return res.status(503).json({ message: 'Unable to access Elite Member records. Please try again.' });
}

async function audit(req, member, action) {
    await SystemAudit.create({ module: 'Elite Members', action, entityId: String(member._id), entityName: member.name,
        actor: req.user.name || req.user.email, actorEmail: req.user.email,
        details: `Member card ${member.idNumber}: ${member.archived ? 'archived' : member.status}`, changes: { idNumber: member.idNumber, status: member.status, archived: Boolean(member.archived) } });
}

router.get('/', async (req, res) => {
    try {
        const managing = canManageEliteMembers(req.user) && req.query.includeInactive === 'true';
        const filter = { archived: managing && req.query.archived === 'true' ? true : { $ne: true }, ...(managing ? {} : { status: 'active' }) };
        const search = String(req.query.search || '').trim().slice(0, 120);
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { idNumber: { $regex: escaped } }];
        }
        const data = await EliteMember.find(filter).select(managing ? 'name idNumber status notes archived archivedAt archivedBy createdAt updatedAt' : 'name idNumber status')
            .sort({ name: 1, idNumber: 1 }).limit(100).lean();
        res.json({ data, limit: 100 });
    } catch (error) { failure(res, error); }
});

router.post('/verify', async (req, res) => {
    if (!validCard(req.body.idNumber)) return res.status(400).json({ message: 'Select a card ID containing 1 to 12 digits.' });
    try {
        const member = await EliteMember.findOne({ idNumber: req.body.idNumber, status: 'active', archived: { $ne: true } }).lean();
        if (!member) return res.status(409).json({ code: 'INVALID_ELITE_MEMBER', message: 'This card is unregistered, inactive or archived. Ask the owner or an authorized membership manager to review it.' });
        res.json({ member: publicMember(member) });
    } catch (error) { failure(res, error); }
});

router.post('/', async (req, res) => {
    if (!canManageEliteMembers(req.user)) return res.status(403).json({ message: 'Elite Membership access is required to manage members.' });
    const member = fields(req.body);
    if (!isValidMemberName(member.name)) return res.status(400).json({ message: MEMBER_NAME_ERROR });
    if (invalidFields(member)) return res.status(400).json({ message: 'Enter a name (up to 120 characters), a card ID of 1 to 12 digits, and a valid status. Notes may contain up to 500 characters.' });
    try {
        const created = await EliteMember.create(member);
        await audit(req, created, 'Registered');
        res.status(201).json({ member: created });
    } catch (error) { failure(res, error); }
});

router.patch('/:id', async (req, res) => {
    if (!canManageEliteMembers(req.user)) return res.status(403).json({ message: 'Elite Membership access is required to manage members.' });
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: 'Select a valid member record.' });
    const member = fields(req.body);
    if (!isValidMemberName(member.name)) return res.status(400).json({ message: MEMBER_NAME_ERROR });
    if (invalidFields(member)) return res.status(400).json({ message: 'Check the member name, card ID, status and notes.' });
    try {
        const updated = await EliteMember.findOneAndUpdate({ _id: req.params.id, archived: { $ne: true } }, { $set: member }, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: 'This member record is missing or archived. Refresh the registered member list.' });
        await audit(req, updated, 'Updated');
        res.json({ member: updated });
    } catch (error) { failure(res, error); }
});

async function changeArchive(req, res, archived) {
    if (!canManageEliteMembers(req.user)) return res.status(403).json({ message: 'Elite Membership access is required to archive or restore members.' });
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: 'Select a valid member record.' });
    try {
        const member = await EliteMember.findOneAndUpdate(
            { _id: req.params.id, archived: archived ? { $ne: true } : true },
            { $set: { archived, archivedAt: archived ? new Date() : null, archivedBy: archived ? req.user.email : '' } },
            { new: true, runValidators: true },
        );
        if (!member) return res.status(404).json({ message: `This member record is missing or already ${archived ? 'archived' : 'restored'}. Refresh the list.` });
        await audit(req, member, archived ? 'Archived' : 'Restored');
        return res.json({ member });
    } catch (error) { return failure(res, error); }
}

router.post('/:id/archive', (req, res) => changeArchive(req, res, true));
router.post('/:id/restore', (req, res) => changeArchive(req, res, false));

module.exports = router;
