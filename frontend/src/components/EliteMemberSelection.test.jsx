import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import EliteVerificationModal from './EliteVerificationModal';

jest.mock('axios');
const member = { name: 'Registered Member', idNumber: '001234567890', status: 'active' };
beforeEach(() => { jest.resetAllMocks(); localStorage.clear(); axios.get.mockResolvedValue({ data: { data: [member] } }); });

const openMembers = async () => {
  const trigger = screen.getByRole('combobox', { name: 'Registered member' });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  return trigger;
};
const chooseMember = async () => {
  await openMembers();
  fireEvent.click(screen.getByRole('option', { name: `${member.name} Card ID: ${member.idNumber}` }));
};

test('staff select a shared active card and server verification supplies the checkout details', async () => {
  const onConfirm = jest.fn();
  axios.post.mockResolvedValue({ data: { member: { name: member.name, idNumber: member.idNumber } } });
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  expect(screen.queryByLabelText('Name:')).not.toBeInTheDocument();
  await chooseMember();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ name: member.name, idNumber: member.idNumber }));
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/elite-members/verify', { idNumber: member.idNumber });
});

test('a card deactivated after listing is rejected without applying the discount', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'This card is inactive.' } } });
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  await chooseMember();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('inactive');
  expect(onConfirm).not.toHaveBeenCalled();
});

test('card search limits input to 12 digits and cancels the previous selection', async () => {
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  await chooseMember();
  fireEvent.change(screen.getByLabelText('Search card ID'), { target: { value: '00ab123456789012345' } });
  expect(screen.getByLabelText('Search card ID')).toHaveValue('001234567890');
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith('http://localhost:5000/api/elite-members?search=001234567890'));
});

test('unregistered browser-saved entries cannot substitute for registry records', async () => {
  localStorage.setItem('flux.eliteMemberHistory', JSON.stringify([member]));
  axios.get.mockResolvedValue({ data: { data: [] } });
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  expect(await screen.findByRole('status')).toHaveTextContent('No active members found');
  expect(screen.queryByRole('option', { name: `${member.name} Card ID: ${member.idNumber}` })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
});

test('an unavailable registry displays an error and blocks confirmation', async () => {
  axios.get.mockRejectedValue(new Error('Offline'));
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load registered members');
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  axios.get.mockResolvedValue({ data: { data: [member] } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh members' }));
  await openMembers();
  expect(screen.getByRole('option', { name: `${member.name} Card ID: ${member.idNumber}` })).toBeInTheDocument();
});

test('member menu supports keyboard selection, selected indicators and Escape without cancelling checkout', async () => {
  const secondMember = { ...member, name: 'Second Member', idNumber: '000000000002' };
  axios.get.mockResolvedValue({ data: { data: [member, secondMember] } });
  const onCancel = jest.fn();
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={onCancel} />);
  const trigger = screen.getByRole('combobox', { name: 'Registered member' });
  await waitFor(() => expect(trigger).toBeEnabled());
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'End' });
  expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Second Member/ }).id);
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(trigger).toHaveTextContent(secondMember.idNumber);
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  expect(screen.getByRole('option', { name: /Second Member/ })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(onCancel).not.toHaveBeenCalled();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('member menu closes on outside press and Tab, and is disabled when no members match', async () => {
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  const trigger = await openMembers();
  fireEvent.pointerDown(screen.getByLabelText('Search card ID'));
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  axios.get.mockResolvedValue({ data: { data: [] } });
  fireEvent.click(trigger);
  fireEvent.change(screen.getByLabelText('Search card ID'), { target: { value: '999' } });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('No active members found');
  expect(trigger).toBeDisabled();
});
