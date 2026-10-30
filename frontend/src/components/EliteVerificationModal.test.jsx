import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EliteVerificationModal from './EliteVerificationModal';
import { ELITE_MEMBER_HISTORY_KEY } from '../utils/eliteMemberHistory';

const member = { name: 'Daniel Almojera', idNumber: '001234567890' };
const fillMember = (details = member) => {
  fireEvent.change(screen.getByLabelText('Name:'), { target: { value: details.name } });
  fireEvent.change(screen.getByLabelText('ID Number:'), { target: { value: details.idNumber } });
};
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

beforeEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

test('typing or pasting accepts at most 12 digits and retains leading zeroes', () => {
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  const card = screen.getByLabelText('ID Number:');
  expect(card).toHaveAttribute('maxlength', '12');
  expect(card).toHaveAttribute('inputmode', 'numeric');
  fillMember({ ...member, idNumber: '00ab1234-567890123456' });
  expect(card).toHaveValue(member.idNumber);
  confirm();
  expect(onConfirm).toHaveBeenCalledWith(member);
});

test('blank name or a card without digits cannot confirm or create a saved member', () => {
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  fillMember({ name: '   ', idNumber: member.idNumber });
  confirm();
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a member name');
  fillMember({ name: member.name, idNumber: 'abc' });
  confirm();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY)).toBeNull();
});

test('confirmed member details persist and selecting them fills both fields in a new modal', () => {
  const onConfirm = jest.fn();
  const first = render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  fillMember({ ...member, name: `  ${member.name}  ` });
  confirm();
  expect(JSON.parse(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY))).toEqual([member]);
  first.unmount();

  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Saved member'), { target: { value: member.idNumber } });
  expect(screen.getByLabelText('Name:')).toHaveValue(member.name);
  expect(screen.getByLabelText('ID Number:')).toHaveValue(member.idNumber);
  confirm();
  expect(onConfirm).toHaveBeenLastCalledWith(member);
  expect(JSON.parse(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY))).toEqual([member]);
});

test('saving updates the same card while keeping separate cards with the same name', () => {
  const anotherCard = { ...member, idNumber: '112233445566' };
  localStorage.setItem(ELITE_MEMBER_HISTORY_KEY, JSON.stringify([member, anotherCard]));
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Saved member'), { target: { value: member.idNumber } });
  fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'Daniel A.' } });
  confirm();
  expect(JSON.parse(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY))).toEqual([
    { ...member, name: 'Daniel A.' }, anotherCard,
  ]);
});

test('saved members can be removed without applying membership', () => {
  localStorage.setItem(ELITE_MEMBER_HISTORY_KEY, JSON.stringify([member]));
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Saved member'), { target: { value: member.idNumber } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove saved member' }));
  expect(screen.queryByLabelText('Saved member')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Name:')).toHaveValue('');
  expect(screen.getByLabelText('ID Number:')).toHaveValue('');
  expect(JSON.parse(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY))).toEqual([]);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('cancelling or choosing not to remember a member does not save details', () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={onCancel} />);
  fillMember();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY)).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Save member for next time' }));
  confirm();
  expect(onConfirm).toHaveBeenCalledWith(member);
  expect(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY)).toBeNull();
});

test('a storage failure is visible and allows confirmation without saving', () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  fillMember();
  confirm();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save member details.');
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Save member for next time' }));
  confirm();
  expect(onConfirm).toHaveBeenCalledWith(member);
});

test.each([
  'invalid json',
  '{}',
  JSON.stringify([null, { name: 'Old member', idNumber: '1234567890123' }, { name: 'Letters', idNumber: 'abc' }]),
])('invalid saved data is ignored: %s', stored => {
  localStorage.setItem(ELITE_MEMBER_HISTORY_KEY, stored);
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.queryByLabelText('Saved member')).not.toBeInTheDocument();
  fillMember();
  confirm();
  expect(JSON.parse(localStorage.getItem(ELITE_MEMBER_HISTORY_KEY))).toEqual([member]);
});
