import { csvEscape, rowsToCsv } from './csv';

test.each(['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', ' \t=HYPERLINK("https://example.com")', '\r\n=1', '\u0000=1'])('neutralizes formula-like text: %s', value => {
  expect(csvEscape(value).startsWith('"\'')).toBe(true);
});
test('keeps ordinary text, numeric negative values, quotes and multiple rows usable', () => {
  expect(rowsToCsv([['Coffee "Large"', -20], ['Drinks', 100]])).toBe('"Coffee ""Large""","-20"\n"Drinks","100"');
});
