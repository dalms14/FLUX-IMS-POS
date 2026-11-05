import { clearInvalidField, firstInvalidField, focusInvalidField } from './formValidation';

test('invalid fields are focused and scrolled into view, opening collapsed options and clearing old highlights', () => {
    const container = document.createElement('div');
    container.innerHTML = '<input required /><details><input type="number" required min="1" /></details>';
    document.body.append(container);
    const [first, second] = container.querySelectorAll('input');
    second.scrollIntoView = jest.fn();
    expect(firstInvalidField(container)).toBe(first);
    focusInvalidField(container, first);
    first.value = 'Coffee';
    expect(firstInvalidField(container)).toBe(second);
    focusInvalidField(container, second);
    expect(container.querySelector('details').open).toBe(true);
    expect(second).toHaveFocus();
    expect(second.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
    expect(first).not.toHaveAttribute('aria-invalid');
    expect(second).toHaveAttribute('aria-invalid', 'true');
    clearInvalidField(container);
    expect(second).not.toHaveAttribute('aria-invalid');
    container.remove();
});
