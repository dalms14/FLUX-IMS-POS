import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidatedForm from './ValidatedForm';

test.each([
    ['', 'Enter price.'],
    ['-1', 'Price must be at least 0.'],
    ['100.01', 'Price must be 100 or less.'],
    ['30.505', 'Use up to 2 decimal places for price.'],
])('invalid numeric entry %j shows a FLUX error, focuses the field and blocks submission', (value, message) => {
    const submit = jest.fn(event => event.preventDefault());
    render(<ValidatedForm onSubmit={submit}><label>Price<input required type="number" min="0" max="100" step="0.01" defaultValue={value} /></label><button>Save</button></ValidatedForm>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Price')).toHaveFocus();
    expect(screen.getByLabelText('Price')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Price').form).toHaveAttribute('novalidate');
});

test.each(['30.50', '0'])('valid cent amounts and explicit zero are submitted: %s', value => {
    const submit = jest.fn(event => event.preventDefault());
    render(<ValidatedForm onSubmit={submit}><label>Price<input required type="number" min="0" step="0.01" defaultValue={value} /></label><button>Save</button></ValidatedForm>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('editing clears the error and restores existing field accessibility descriptions', () => {
    render(<ValidatedForm onSubmit={event => event.preventDefault()}><label>Price<input aria-describedby="price-help" required type="number" step="0.01" /></label><small id="price-help">Enter pesos and centavos.</small><button>Save</button></ValidatedForm>);
    const price = screen.getByLabelText('Price');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(price.getAttribute('aria-describedby')).toContain('price-help');
    expect(price.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    fireEvent.change(price, { target: { value: '30.50' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(price).not.toHaveAttribute('aria-invalid');
    expect(price).toHaveAttribute('aria-describedby', 'price-help');
});

test('invalid email and required selections keep their rules without browser popups', () => {
    const submit = jest.fn(event => event.preventDefault());
    render(<ValidatedForm onSubmit={submit}><label>Email<input type="email" defaultValue="invalid" /></label><label>Role<select required defaultValue=""><option value="">Choose</option><option value="staff">Staff</option></select></label><button>Save</button></ValidatedForm>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select role.');
    expect(submit).not.toHaveBeenCalled();
});

test('disabled fieldsets are skipped during multi-step account verification', () => {
    const submit = jest.fn(event => event.preventDefault());
    render(<ValidatedForm onSubmit={submit}><fieldset disabled><input aria-label="Uneditable required value" required /></fieldset><button>Verify</button></ValidatedForm>);
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(submit).toHaveBeenCalledTimes(1);
});
