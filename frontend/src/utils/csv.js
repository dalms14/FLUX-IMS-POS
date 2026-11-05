export const csvEscape = value => {
  let text = String(value ?? '');
  // Preserve numeric cells, but force potentially executable text to be literal.
  const firstVisible = [...text].find(char => !/\s/u.test(char) && char.charCodeAt(0) > 31 && !(char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159));
  if (typeof value !== 'number' && ['=', '+', '-', '@'].includes(firstVisible)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export const rowsToCsv = rows => rows.map(row => row.map(csvEscape).join(',')).join('\n');
