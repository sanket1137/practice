// ScreenSelector Component (MUI Version)

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';

interface Screen {
    id: string;
    name: string;
    location: string;
}

interface ScreenSelectorProps {
    screens: Screen[];
    selectedScreenId: string | null;
    onChange: (screenId: string) => void;
    disabled?: boolean;
}

export const ScreenSelector: React.FC<ScreenSelectorProps> = ({
    screens,
    selectedScreenId,
    onChange,
    disabled = false,
}) => {
    return (
        <FormControl fullWidth disabled={disabled}>
            <InputLabel>Select Screen</InputLabel>
            <Select
                value={selectedScreenId || ''}
                label="Select Screen"
                onChange={(e) => onChange(e.target.value as string)}
            >
                <MenuItem value="">
                    <em>Choose a screen...</em>
                </MenuItem>
                {screens.map((screen) => (
                    <MenuItem key={screen.id} value={screen.id}>
                        {screen.name} - {screen.location}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};
