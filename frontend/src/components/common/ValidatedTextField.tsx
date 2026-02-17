import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { useState, useEffect } from 'react';

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

export default function ValidatedTextField({
    value,
    validationRules,
    onValidationChange,
    onBlur,
    ...props
}: ValidatedTextFieldProps) {
    const [touched, setTouched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!touched || !validationRules) {
            setError(null);
            onValidationChange?.(true);
            return;
        }

        // Required validation
        if (validationRules.required && !value.trim()) {
            setError('This field is required');
            onValidationChange?.(false);
            return;
        }

        // Min length validation
        if (validationRules.minLength && value.length < validationRules.minLength) {
            setError(`Minimum ${validationRules.minLength} characters required`);
            onValidationChange?.(false);
            return;
        }

        // Max length validation
        if (validationRules.maxLength && value.length > validationRules.maxLength) {
            setError(`Maximum ${validationRules.maxLength} characters allowed`);
            onValidationChange?.(false);
            return;
        }

        // Pattern validation
        if (validationRules.pattern && !validationRules.pattern.test(value)) {
            setError('Invalid format');
            onValidationChange?.(false);
            return;
        }

        // Custom validation
        if (validationRules.custom) {
            const customError = validationRules.custom(value);
            if (customError) {
                setError(customError);
                onValidationChange?.(false);
                return;
            }
        }

        setError(null);
        onValidationChange?.(true);
    }, [value, touched, validationRules, onValidationChange]);

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
