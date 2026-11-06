const EliteMember = require('../models/EliteMember');

async function validateEliteMember(req, res, next) {
    if (req.body.customerType !== 'elite') { req.body.eliteMember = null; return next(); }
    const member = req.body.eliteMember;
    if (typeof member?.idNumber !== 'string' || !/^[0-9]{1,12}$/.test(member.idNumber)) {
        return res.status(400).json({ code: 'INVALID_ELITE_MEMBER', message: 'Elite Member card ID must contain 1 to 12 digits.' });
    }
    try {
        const saved = await EliteMember.findOne({ idNumber: member.idNumber, status: 'active', archived: { $ne: true } }).lean();
        if (!saved) return res.status(409).json({ code: 'INVALID_ELITE_MEMBER', message: 'This Elite Member card is unregistered, inactive or archived. Select an active registered member before checkout.' });
        req.body.eliteMember = { name: saved.name, idNumber: saved.idNumber };
        return next();
    } catch (error) {
        console.error('Elite Member verification failed:', error.message);
        return res.status(503).json({ message: 'Unable to verify membership. Please try again before completing payment.' });
    }
}

module.exports = validateEliteMember;
