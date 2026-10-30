import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReceiptViewModal from './ReceiptViewModal';
import { printReceipt } from '../utils/printReceipt';

jest.mock('../utils/printReceipt', () => ({ printReceipt: jest.fn() }));

const props = {
    receiptNo: 'FLX-TEST-001', cart: [{ name: 'Coffee', price: 100, quantity: 2 }],
    subtotal: 200, discount: 0, total: 200, paymentMethod: 'Cash',
    amountTendered: 250, change: 50, onClose: jest.fn(),
};

test('prints saved receipt content without controls or closing the order', async () => {
    printReceipt.mockResolvedValue(undefined);
    render(<ReceiptViewModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Print Receipt' }));
    const receipt = printReceipt.mock.calls[0][0];
    expect(receipt).toHaveTextContent('FLX-TEST-001');
    expect(receipt).toHaveTextContent('Coffee');
    expect(receipt.querySelector('button')).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print Receipt' })).toBeEnabled());
});

test('allows retry when printing fails', async () => {
    printReceipt.mockRejectedValueOnce(new Error('Printing unavailable'));
    render(<ReceiptViewModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Print Receipt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
    expect(screen.getByRole('button', { name: 'Print Receipt' })).toBeEnabled();
});
