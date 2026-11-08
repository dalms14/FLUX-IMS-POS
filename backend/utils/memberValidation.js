const MEMBER_NAME_ERROR = 'Member name must contain letters and may include spaces, apostrophes, periods or hyphens. Numbers are not allowed.';
const isValidMemberName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120
    && /\p{L}/u.test(value) && /^[\p{L}\p{M} .'’-]+$/u.test(value.trim());

const MEMBER_EMAIL_ERROR = 'Enter a valid email address (up to 254 characters), or leave it blank.';
const isValidMemberEmail = value => value === undefined || (typeof value === 'string'
    && (value === '' || (value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))));

module.exports = { isValidMemberName, MEMBER_NAME_ERROR, isValidMemberEmail, MEMBER_EMAIL_ERROR };
