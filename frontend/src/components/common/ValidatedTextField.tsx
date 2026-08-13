import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

interface ValidatedTextFieldProps extends Omit<TextFieldProps, 'error'> {
    value: string;
    validationRules?: {
        required?: boolean;
        minLength?: number;
        maxLength?: number;
        pattern?: RegExp;
        custom?: (value: string) => string | null;
    };
    onValidationChange?: (isValid: boolean) => void;
}

function computeError(
    value: string,
    touched: boolean,
    validationRules?: ValidatedTextFieldProps['validationRules']
): string | null {
    if (!touched || !validationRules) {
        return null;
    }

    if (validationRules.required && !value.trim()) {
        return 'This field is required';
    }

    if (validationRules.minLength && value.length < validationRules.minLength) {
        return `Minimum ${validationRules.minLength} characters required`;
    }

    if (validationRules.maxLength && value.length > validationRules.maxLength) {
        return `Maximum ${validationRules.maxLength} characters allowed`;
    }

    if (validationRules.pattern && !validationRules.pattern.test(value)) {
        return 'Invalid format';
    }

    if (validationRules.custom) {
        const customError = validationRules.custom(value);
        if (customError) {
            return customError;
        }
    }

    return null;
}

export default function ValidatedTextField({
    value,
    validationRules,
    onValidationChange,
    onBlur,
    ...props
}: ValidatedTextFieldProps) {
    const [touched, setTouched] = useState(false);

    // Error is a pure derivation of value/touched/validationRules — compute it
    // directly during render instead of syncing it into state via an effect.
    const error = useMemo(
        () => computeError(value, touched, validationRules),
        [value, touched, validationRules]
    );

    // Notifying the parent is a side effect (it calls into code we don't own),
    // so it stays in an effect — but no local setState happens here anymore.
    useEffect(() => {
        onValidationChange?.(error === null);
    }, [error, onValidationChange]);

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        setTouched(true);
        onBlur?.(event);
    };

    return (
        <TextField
            {...props}
            value={value}
            error={!!error}
            helperText={error || props.helperText}
            onBlur={handleBlur}
        />
    );
}
