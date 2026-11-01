module.exports = function validateGcashReference(req, res, next) {
    if (req.body.paymentMethod === 'GCash' &&
        (typeof req.body.gcashReference !== 'string' || !/^\d{10,13}$/.test(req.body.gcashReference))) {
        return res.status(400).json({ message: 'GCash reference number must contain 10 to 13 digits only.' });
    }
    next();
};
