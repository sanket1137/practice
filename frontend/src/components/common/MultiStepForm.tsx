import { Box, Stepper, Step, StepLabel, Button, Paper, Typography } from '@mui/material';
import { useState, ReactNode } from 'react';

interface FormStep {
    label: string;
    description?: string;
    content: ReactNode;
    validate?: () => boolean | Promise<boolean>;
}

interface MultiStepFormProps {
    steps: FormStep[];
    onComplete: () => void | Promise<void>;
    onCancel?: () => void;
}

export default function MultiStepForm({ steps, onComplete, onCancel }: MultiStepFormProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleNext = async () => {
        const currentStep = steps[activeStep];

        // Run validation if provided
        if (currentStep.validate) {
            setLoading(true);
            try {
                const isValid = await currentStep.validate();
                if (!isValid) {
                    setLoading(false);
                    return;
                }
            } catch (error) {
                console.error('Validation error:', error);
                setLoading(false);
                return;
            }
            setLoading(false);
        }

        if (activeStep === steps.length - 1) {
            // Last step - complete the form
            setLoading(true);
            try {
                await onComplete();
            } catch (error) {
                console.error('Form submission error:', error);
            }
            setLoading(false);
        } else {
            setActiveStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    return (
        <Box>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((step, index) => (
                    <Step key={step.label}>
                        <StepLabel>
                            {step.label}
                            {step.description && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                    {step.description}
                                </Typography>
                            )}
                        </StepLabel>
                    </Step>
                ))}
            </Stepper>

            <Paper sx={{ p: 3, mb: 3 }}>
                {steps[activeStep].content}
            </Paper>

            <Box display="flex" justifyContent="space-between">
                <Box>
                    {onCancel && (
                        <Button onClick={onCancel} disabled={loading}>
                            Cancel
                        </Button>
                    )}
                </Box>
                <Box display="flex" gap={2}>
                    <Button
                        disabled={activeStep === 0 || loading}
                        onClick={handleBack}
                    >
                        Back
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={loading}
                    >
                        {activeStep === steps.length - 1 ? 'Complete' : 'Next'}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
