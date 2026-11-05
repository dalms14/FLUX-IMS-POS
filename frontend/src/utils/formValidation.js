// Bring an invalid field into view, including controls inside collapsed options.
export function focusInvalidField(container, field) {
    if (!container || !field) return;
    clearInvalidField(container);
    let parent = field.parentElement;
    while (parent && parent !== container) {
        if (parent.tagName === 'DETAILS') parent.open = true;
        parent = parent.parentElement;
    }
    field.classList.add('product-invalid-field');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', 'app-notice-message');
    field.focus({ preventScroll: true });
    field.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

export function clearInvalidField(container) {
    container?.querySelectorAll('.product-invalid-field').forEach(field => {
        field.classList.remove('product-invalid-field');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
    });
}

export function firstInvalidField(container) {
    return [...(container?.querySelectorAll('input, select, textarea, button[data-required-missing]') || [])]
        .find(field => !field.disabled && (field.dataset.requiredMissing === 'true' || (field.validity && !field.validity.valid)));
}
