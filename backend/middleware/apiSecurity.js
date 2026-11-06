const { authenticate } = require('../services/authSessions');
const { hasPermission, isOwner, canManageAccounts, canManageEliteMembers } = require('../utils/permissions');
const { credentialRateLimit } = require('./credentialRateLimit');

const publicRoutes = new Set(['POST /auth/login', 'GET /auth/lockout-status', 'POST /auth/first-login-password', 'POST /auth/password-reset/request', 'POST /auth/password-reset/confirm']);
const pathOf = req => req.path.toLowerCase().replace(/\/+$/, '') || '/';

function authorizeApi(req, res, next) {
    const path = pathOf(req);
    const method = req.method;
    const read = method === 'GET';
    const user = req.user;
    const any = keys => keys.some(key => hasPermission(user, key));
    let allowed = false;
    if (path.startsWith('/auth/users')) {
        const creating = method === 'POST' && ['/auth/users', '/auth/users/verification/request'].includes(path);
        allowed = read ? any(['staff', 'users', 'purchase_orders']) : creating ? hasPermission(user, 'users') : /\/access$/.test(path) ? isOwner(user) : canManageAccounts(user);
    } else if (path === '/system/backup') allowed = isOwner(user);
    else if (path === '/auth/login-activity') allowed = any(['staff', 'reports']);
    else if (['/auth/heartbeat', '/auth/logout', '/auth/change-password', '/auth/recover-password', '/auth/profile-picture', '/auth/my-activity', '/auth/reset-password', '/auth/verify-identity'].includes(path)) allowed = true;
    else if (path.startsWith('/purchase-orders')) allowed = path === '/purchase-orders/my-deliveries' || /\/record-arrival$/.test(path) || any(['purchase_orders']);
    else if (path.startsWith('/notifications')) allowed = true;
    else if (path.startsWith('/sales-forecast')) allowed = any(['dashboard', 'sales']);
    else if (/^\/elite-members(\/|$)/.test(path)) allowed = read || path === '/elite-members/verify' && method === 'POST'
        ? any(['items']) || canManageEliteMembers(user) : canManageEliteMembers(user);
    else if (/^\/(products|categories|addons|discounts)(\/|$)/.test(path)) allowed = any(read ? ['products', 'items'] : ['products']);
    else if (/^\/inventory(\/|$|-stats$)/.test(path)) allowed = any(read ? ['inventory', 'products', 'purchase_orders', 'reports', 'items'] : ['inventory']);
    else if (/^\/(transactions|orders)(\/|$)/.test(path)) allowed = any(read ? ['dashboard', 'transactions', 'sales', 'history', 'reports', 'items'] : ['items']);
    else if (path.startsWith('/refunds')) allowed = any(read ? ['dashboard', 'transactions', 'sales', 'history', 'reports'] : ['transactions', 'history']);
    else if (/^\/(sales-history|inventory-history)(\/|$)/.test(path)) allowed = any(['history', 'reports']);
    else if (path === '/system-audit') allowed = any(['reports']);
    if (!allowed) return res.status(403).json({ code: 'FORBIDDEN', message: 'Your account does not have permission for this operation.' });

    // Audit actors and self-service targets come from the verified session.
    // Body/query values are retained only for actual target accounts or records.
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        Object.assign(req.body, { actor: user.name || user.email, actorEmail: user.email, cashier: user.name || user.email, cashierEmail: user.email, currentUserEmail: user.email, currentUserId: user.userId, refundedBy: user.name || user.email, refundedByEmail: user.email });
        if (path.startsWith('/notifications/')) req.body.email = user.email;
        if (['/system/backup', '/auth/heartbeat', '/auth/logout', '/auth/change-password', '/auth/recover-password', '/auth/profile-picture'].includes(path)) req.body.email = user.email;
    }
    if (['/purchase-orders/my-deliveries', '/notifications'].includes(path)) {
        // Express 5 query is a getter; replace it with an immutable request-local copy.
        Object.defineProperty(req, 'query', { value: { ...req.query, email: user.email }, configurable: true });
    }
    return credentialRateLimit(req, res, next);
}

function apiSecurity(req, res, next) {
    if (publicRoutes.has(`${req.method} ${pathOf(req)}`)) return credentialRateLimit(req, res, next);
    return authenticate(req, res, () => authorizeApi(req, res, next));
}
module.exports = { apiSecurity, authorizeApi, publicRoutes, pathOf };
