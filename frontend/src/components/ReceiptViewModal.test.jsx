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

beforeEach(() => {
    jest.clearAllMocks();
    printReceipt.mockResolvedValue(undefined);
});

test('prints saved receipt content without controls or closing the order', async () => {
    printReceipt.mockResolvedValue(undefined);
    render(<ReceiptViewModal {...props} />);
    expect(printReceipt).not.toHaveBeenCalled();
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

test('VAT removal and the percentage discount are separate on a saved receipt', () => {
    render(<ReceiptViewModal {...props}
        cart={[{ name: 'Coffee', price: 112, quantity: 2, discountEligibleQuantity: 1 }]}
        subtotal={224} discount={32} total={192}
        discountInfo={{ name: 'Senior offer', percentage: 20, scope: 'item', vatExempt: true, vatRemoved: 12, percentageDiscount: 20 }}
    />);
    expect(screen.getByText('VAT removed (12%):')).toBeInTheDocument();
    expect(screen.getByText('-₱12')).toBeInTheDocument();
    expect(screen.getByText('-₱20')).toBeInTheDocument();
    expect(screen.getByText('₱192')).toBeInTheDocument();
});

test('automatic checkout printing runs once in Strict Mode and leaves only New Order', async () => {
    const page = render(<React.StrictMode><ReceiptViewModal {...props} autoPrint /></React.StrictMode>);
    await waitFor(() => expect(printReceipt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'New Order' })).toBeEnabled());
    page.rerender(<React.StrictMode><ReceiptViewModal {...props} autoPrint cashier="Updated name" /></React.StrictMode>);
    expect(printReceipt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Print Receipt' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/Print setup/)).not.toBeInTheDocument();
    expect(printReceipt.mock.calls[0][0]).toHaveTextContent(props.receiptNo);
    fireEvent.click(screen.getByRole('button', { name: 'New Order' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('automatic print failure preserves the saved receipt and directs reprinting to Transactions', async () => {
    printReceipt.mockRejectedValueOnce(new Error('Printer unavailable'));
    const page = render(<ReceiptViewModal {...props} autoPrint />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Order saved, but printing could not start. Reprint the receipt from Transactions.');
    expect(screen.getByRole('button', { name: 'New Order' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Print Receipt' })).not.toBeInTheDocument();
    page.rerender(<ReceiptViewModal {...props} autoPrint cashier="Updated name" />);
    expect(printReceipt).toHaveBeenCalledTimes(1);
});
