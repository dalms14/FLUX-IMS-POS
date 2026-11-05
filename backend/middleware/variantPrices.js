const validVariantPrice = value => {
    if (value == null || value === '') return true; // An omitted add-on costs zero.
    if (!['number', 'string'].includes(typeof value)) return false;
    const text = String(value).trim();
    return /^\d+(?:\.\d{1,2})?$/.test(text) && Number.isFinite(Number(text)) && Number(text) <= 9999.99;
};

function validateVariantPrices(req, res, next) {
    const groups = req.body.variantGroups;
    if (groups === undefined) return next();
    if (!Array.isArray(groups) || groups.some(group => !group || (group.optionPrices !== undefined
        && (!Array.isArray(group.optionPrices) || group.optionPrices.some(value => !validVariantPrice(value)))))) {
        return res.status(400).json({ code: 'INVALID_VARIANT_PRICE', message: 'Variant price add-ons must be from 0 to 9,999.99, with at most two decimal places.' });
    }
    return next();
}

module.exports = { validVariantPrice, validateVariantPrices };
