// ScreenCardSelector - Card-based screen selection

import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ScreenCardSelectorProps {
    screens: Array<{ id: string; name: string; location: string; availableSlots: number }>;
    selectedScreenId: string | null;
    onChange: (screenId: string) => void;
    disabled?: boolean;
}

export const ScreenCardSelector: React.FC<ScreenCardSelectorProps> = ({
    screens,
    selectedScreenId,
    onChange,
    disabled = false,
}) => {
    return (
        <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Select Screen
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {screens.map((screen) => {
                    const isSelected = screen.id === selectedScreenId;
                    const isFull = screen.availableSlots === 0;
                    const isDisabled = disabled || isFull;

                    return (
                        <Paper
                            key={screen.id}
                            onClick={() => !isDisabled && onChange(screen.id)}
                            sx={{
                                p: 2,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                border: 2,
                                borderColor: isSelected ? 'primary.main' : 'transparent',
                                bgcolor: isDisabled ? 'action.disabledBackground' : isSelected ? 'primary.lighter' : 'background.paper',
                                opacity: isDisabled ? 0.6 : 1,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: isDisabled ? 'transparent' : isSelected ? 'primary.main' : 'primary.light',
                                    bgcolor: isDisabled ? 'action.disabledBackground' : isSelected ? 'primary.lighter' : 'action.hover',
                                },
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="body1" fontWeight="bold">
                                        📺 {screen.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {screen.location}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {isFull ? (
                                        <Chip label="FULL" color="error" size="small" />
                                    ) : (
                                        <Chip
                                            label={`${screen.availableSlots} slot${screen.availableSlots > 1 ? 's' : ''} available`}
                                            color="success"
                                            size="small"
                                        />
                                    )}
                                    {isSelected && <CheckCircleIcon color="primary" />}
                                </Box>
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
        </Box>
    );
};
