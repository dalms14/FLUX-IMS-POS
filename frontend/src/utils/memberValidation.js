export const MEMBER_NAME_ERROR = 'Member name must contain letters and may include spaces, apostrophes, periods or hyphens. Numbers are not allowed.';
export const isAllowedMemberNameInput = value => /^[\p{L}\p{M} .'’-]*$/u.test(value);
export const isValidMemberName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120
  && /\p{L}/u.test(value) && isAllowedMemberNameInput(value.trim());
