import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import SettingsPage from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
    axios.get.mockResolvedValue({ data: { data: [] } });
    axios.post.mockResolvedValue({ data: { success: true } });
});

test('an add-on accepts centavos, while blank and over-precise prices show the shared error', async () => {
    render(<SettingsPage mode="products" initialSection="addons" />);
    await screen.findByText('No add-ons yet.');
    fireEvent.change(screen.getByLabelText('Add-on name'), { target: { value: 'Extra Shot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Add-on' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter add-on price.');
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Add-on price'), { target: { value: '30.505' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Add-on' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use up to 2 decimal places for add-on price.');
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Add-on price'), { target: { value: '30.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Add-on' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/addons', { name: 'Extra Shot', price: 30.5 }));
    await screen.findByText('Add-on added.');
});

test('discount percentages show the same error design and prevent invalid writes', async () => {
    render(<SettingsPage mode="products" initialSection="discounts" />);
    await screen.findByText('No discounts yet.');
    fireEvent.change(screen.getByLabelText('Discount name'), { target: { value: 'Student' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Discount' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter discount percentage.');
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Discount' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Discount percentage must be 100 or less.');
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Discount' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/discounts', { name: 'Student', percentage: 20, scope: 'item' }));
    await screen.findByText('Discount added.');
});
