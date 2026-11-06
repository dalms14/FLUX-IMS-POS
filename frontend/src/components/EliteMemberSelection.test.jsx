import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import EliteVerificationModal from './EliteVerificationModal';

jest.mock('axios');
const member = { name: 'Registered Member', idNumber: '001234567890', status: 'active' };
beforeEach(() => { jest.resetAllMocks(); localStorage.clear(); axios.get.mockResolvedValue({ data: { data: [member] } }); });

test('staff select a shared active card and server verification supplies the checkout details', async () => {
  const onConfirm = jest.fn();
  axios.post.mockResolvedValue({ data: { member: { name: member.name, idNumber: member.idNumber } } });
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  await screen.findByRole('option', { name: `${member.name} — ${member.idNumber}` });
  expect(screen.queryByLabelText('Name:')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Registered member'), { target: { value: member.idNumber } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ name: member.name, idNumber: member.idNumber }));
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/elite-members/verify', { idNumber: member.idNumber });
});

test('a card deactivated after listing is rejected without applying the discount', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'This card is inactive.' } } });
  const onConfirm = jest.fn();
  render(<EliteVerificationModal onConfirm={onConfirm} onCancel={jest.fn()} />);
  await screen.findByRole('option', { name: `${member.name} — ${member.idNumber}` });
  fireEvent.change(screen.getByLabelText('Registered member'), { target: { value: member.idNumber } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('inactive');
  expect(onConfirm).not.toHaveBeenCalled();
});

test('search uses the registry and cancels the previous selection', async () => {
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  await screen.findByRole('option', { name: `${member.name} — ${member.idNumber}` });
  fireEvent.change(screen.getByLabelText('Registered member'), { target: { value: member.idNumber } });
  fireEvent.change(screen.getByLabelText('Search name or card ID'), { target: { value: '000' } });
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith('http://localhost:5000/api/elite-members?search=000'));
});

test('unregistered browser-saved entries cannot substitute for registry records', async () => {
  localStorage.setItem('flux.eliteMemberHistory', JSON.stringify([member]));
  axios.get.mockResolvedValue({ data: { data: [] } });
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  expect(await screen.findByRole('status')).toHaveTextContent('No active members found');
  expect(screen.queryByRole('option', { name: `${member.name} — ${member.idNumber}` })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
});

test('an unavailable registry displays an error and blocks confirmation', async () => {
  axios.get.mockRejectedValue(new Error('Offline'));
  render(<EliteVerificationModal onConfirm={jest.fn()} onCancel={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load registered members');
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  axios.get.mockResolvedValue({ data: { data: [member] } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh members' }));
  expect(await screen.findByRole('option', { name: `${member.name} — ${member.idNumber}` })).toBeInTheDocument();
});
