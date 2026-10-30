function validateEliteMember(req, res, next) {
    if (req.body.customerType !== 'elite') return next();
    const member = req.body.eliteMember;
    if (typeof member?.name !== 'string' || !member.name.trim()) {
        return res.status(400).json({ code: 'INVALID_ELITE_MEMBER', message: 'Enter the Elite Member name.' });
    }
    if (typeof member.idNumber !== 'string' || !/^[0-9]{1,12}$/.test(member.idNumber)) {
        return res.status(400).json({ code: 'INVALID_ELITE_MEMBER', message: 'Elite Member card ID must contain 1 to 12 digits.' });
    }
    req.body.eliteMember = { name: member.name.trim(), idNumber: member.idNumber };
    return next();
}

module.exports = validateEliteMember;
