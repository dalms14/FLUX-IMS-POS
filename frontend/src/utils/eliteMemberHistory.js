export const ELITE_MEMBER_HISTORY_KEY = 'flux.eliteMemberHistory';
export const ELITE_CARD_ID_MAX_LENGTH = 12;

export const isValidEliteMember = member => (
  typeof member?.name === 'string' && Boolean(member.name.trim()) &&
  typeof member?.idNumber === 'string' && /^[0-9]{1,12}$/.test(member.idNumber)
);

export const getEliteMemberHistory = () => {
  try {
    const history = JSON.parse(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY) || '[]');
    if (!Array.isArray(history)) return [];
    const seen = new Set();
    return history.filter(member => {
      if (!isValidEliteMember(member) || seen.has(member.idNumber)) return false;
      seen.add(member.idNumber);
      return true;
    }).map(member => ({ name: member.name.trim(), idNumber: member.idNumber }));
  } catch {
    return [];
  }
};

export const saveEliteMember = member => {
  if (!isValidEliteMember(member)) throw new Error('Enter a name and a card ID of up to 12 digits.');
  const next = [
    { name: member.name.trim(), idNumber: member.idNumber },
    ...getEliteMemberHistory().filter(item => item.idNumber !== member.idNumber),
  ];
  localStorage.setItem(ELITE_MEMBER_HISTORY_KEY, JSON.stringify(next));
  return next;
};

export const removeEliteMember = idNumber => {
  const next = getEliteMemberHistory().filter(member => member.idNumber !== idNumber);
  localStorage.setItem(ELITE_MEMBER_HISTORY_KEY, JSON.stringify(next));
  return next;
};
