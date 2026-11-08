const previousAccessibility = new WeakMap();

// Bring an invalid field into view, including controls inside collapsed options.
export function focusInvalidField(container, field, messageId = 'app-notice-message') {
    if (!container || !field) return;
    clearInvalidField(container);
    let parent = field.parentElement;
    while (parent && parent !== container) {
        if (parent.tagName === 'DETAILS') parent.open = true;
        parent = parent.parentElement;
    }
    previousAccessibility.set(field, {
        invalid: field.getAttribute('aria-invalid'),
        describedBy: field.getAttribute('aria-describedby'),
    });
    field.classList.add('product-invalid-field');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), messageId].filter(Boolean).join(' '));
    field.focus({ preventScroll: true });
    field.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

export function clearInvalidField(container) {
    container?.querySelectorAll('.product-invalid-field').forEach(field => {
        field.classList.remove('product-invalid-field');
        const previous = previousAccessibility.get(field);
        for (const [attribute, value] of [['aria-invalid', previous?.invalid], ['aria-describedby', previous?.describedBy]]) {
            if (value == null) field.removeAttribute(attribute);
            else field.setAttribute(attribute, value);
        }
        previousAccessibility.delete(field);
    });
}

export function firstInvalidField(container) {
    return [...(container?.querySelectorAll('input, select, textarea, button[data-required-missing]') || [])]
        .find(field => !field.disabled && (field.dataset.requiredMissing === 'true' || (field.willValidate !== false && field.validity && !field.validity.valid)));
}

export function fieldValidationMessage(field) {
    if (field.dataset.validationMessage) return field.dataset.validationMessage;
    const labelCopy = field.labels?.[0]?.cloneNode(true);
    labelCopy?.querySelectorAll('input, select, textarea, button, small').forEach(control => control.remove());
    const label = field.dataset.validationLabel || field.getAttribute('aria-label')
        || labelCopy?.textContent.trim()
        || (field.previousElementSibling?.tagName === 'LABEL' ? field.previousElementSibling.textContent.trim() : '')
        || field.name || 'This field';
    const name = label.replace(/\s*\*\s*$/, '').trim();
    const validity = field.validity;
    if (validity.valueMissing) return field.tagName === 'SELECT' ? `Select ${name.toLowerCase()}.` : `Enter ${name.toLowerCase()}.`;
    if (validity.badInput) return `Enter a valid number for ${name.toLowerCase()}.`;
    if (validity.typeMismatch) return field.type === 'email' ? 'Enter a valid email address.' : `Enter a valid ${name.toLowerCase()}.`;
    if (validity.rangeUnderflow) return `${name} must be at least ${field.min}.`;
    if (validity.rangeOverflow) return `${name} must be ${field.max} or less.`;
    if (validity.stepMismatch) {
        const places = field.step?.split('.')[1]?.length || 0;
        return places ? `Use up to ${places} decimal places for ${name.toLowerCase()}.` : `Enter a whole number for ${name.toLowerCase()}.`;
    }
    if (validity.tooShort) return `${name} must contain at least ${field.minLength} characters.`;
    if (validity.tooLong) return `${name} must contain no more than ${field.maxLength} characters.`;
    if (validity.patternMismatch) return `Check the format of ${name.toLowerCase()}.`;
    if (validity.customError) return field.validationMessage;
    return `Check ${name.toLowerCase()} and try again.`;
}
