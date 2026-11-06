const MEMBER_NAME_ERROR = 'Member name must contain letters and may include spaces, apostrophes, periods or hyphens. Numbers are not allowed.';
const isValidMemberName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120
    && /\p{L}/u.test(value) && /^[\p{L}\p{M} .'’-]+$/u.test(value.trim());

module.exports = { isValidMemberName, MEMBER_NAME_ERROR };
