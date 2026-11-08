import React, { forwardRef, useCallback, useId, useRef, useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import { clearInvalidField, fieldValidationMessage, firstInvalidField, focusInvalidField } from '../utils/formValidation';
import './ValidatedForm.css';

// Keep HTML constraints, but present failures using FLUX's own error design.
const ValidatedForm = forwardRef(function ValidatedForm({ children, onSubmit, onInputCapture, onChangeCapture, ...props }, forwardedRef) {
    const formRef = useRef(null);
    const messageId = useId();
    const [error, setError] = useState('');
    const attachRef = useCallback(form => {
        formRef.current = form;
        if (typeof forwardedRef === 'function') forwardedRef(form);
        else if (forwardedRef) forwardedRef.current = form;
    }, [forwardedRef]);
    const clearError = () => {
        if (!error) return;
        clearInvalidField(formRef.current);
        setError('');
    };
    const submit = event => {
        const invalid = firstInvalidField(event.currentTarget);
        if (invalid) {
            event.preventDefault();
            setError(fieldValidationMessage(invalid));
            focusInvalidField(event.currentTarget, invalid, messageId);
            return;
        }
        clearError();
        onSubmit?.(event);
    };

    return <form {...props} ref={attachRef} noValidate data-inline-validation onSubmit={submit}
        onInputCapture={event => { clearError(); onInputCapture?.(event); }}
        onChangeCapture={event => { clearError(); onChangeCapture?.(event); }}>
        {error && <div className="app-form-validation-error" role="alert" id={messageId}>
            <FiAlertCircle aria-hidden="true" />
            <p>{error}</p>
        </div>}
        {children}
    </form>;
});

export default ValidatedForm;
