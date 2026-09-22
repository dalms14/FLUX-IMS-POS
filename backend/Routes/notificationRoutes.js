const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');

function audienceFor(user) {
    const role = String(user?.role || '').trim().toLowerCase();
    const jobRole = String(user?.jobRole || '').trim().toLowerCase();
    const email = String(user?.email || '').trim().toLowerCase();
    const userId = String(user?.userId || '').trim().toUpperCase();
    if (role === 'owner' || email === 'admin@elicoffee.com' || userId === 'ELI001') return 'owner';
    if (role === 'admin') return 'admin';
    if (jobRole === 'finance') return 'finance';
    if (jobRole === 'hr') return 'hr';
    return '';
}

router.get('/', async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        const user = email ? await User.findOne({ email }).lean() : null;
        const audience = audienceFor(user);
        if (!audience) return res.json({ data: [], unreadCount: 0 });
        const notifications = await Notification.find({ audiences: audience, resolvedAt: null }).sort({ createdAt: -1 }).limit(50).lean();
        const unreadCount = notifications.filter(notification => !notification.readBy?.some(entry => entry.email === email)).length;
        res.json({ data: notifications, unreadCount });
    } catch (err) {
        console.error('Error loading notifications:', err);
        res.status(500).json({ message: 'Failed to load notifications' });
    }
});

router.post('/:id/read', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ message: 'Email is required' });
        await Notification.updateOne({ _id: req.params.id, 'readBy.email': { $ne: email } }, { $push: { readBy: { email, readAt: new Date() } } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
});

module.exports = router;
