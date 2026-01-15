import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { useMemo } from 'react';

// Common timezones with their display names and UTC offsets
const COMMON_TIMEZONES = [
    // India
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', offset: '+05:30', region: 'Asia' },
    
    // Americas
    { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00', region: 'Americas' },
    { value: 'America/Chicago', label: 'Central Time (CT)', offset: '-06:00', region: 'Americas' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', offset: '-07:00', region: 'Americas' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00', region: 'Americas' },
    { value: 'America/Phoenix', label: 'Arizona (No DST)', offset: '-07:00', region: 'Americas' },
    { value: 'America/Toronto', label: 'Toronto (ET)', offset: '-05:00', region: 'Americas' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)', offset: '-08:00', region: 'Americas' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', offset: '-03:00', region: 'Americas' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)', offset: '-06:00', region: 'Americas' },
    
    // Europe
    { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00', region: 'Europe' },
    { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+01:00', region: 'Europe' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: '+01:00', region: 'Europe' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', offset: '+01:00', region: 'Europe' },
    { value: 'Europe/Rome', label: 'Rome (CET)', offset: '+01:00', region: 'Europe' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)', offset: '+01:00', region: 'Europe' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: '+03:00', region: 'Europe' },
    { value: 'Europe/Istanbul', label: 'Istanbul (TRT)', offset: '+03:00', region: 'Europe' },
    
    // Asia Pacific
    { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+04:00', region: 'Asia' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00', region: 'Asia' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: '+08:00', region: 'Asia' },
    { value: 'Asia/Shanghai', label: 'China (CST)', offset: '+08:00', region: 'Asia' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00', region: 'Asia' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: '+09:00', region: 'Asia' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', offset: '+07:00', region: 'Asia' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: '+07:00', region: 'Asia' },
    { value: 'Asia/Karachi', label: 'Pakistan (PKT)', offset: '+05:00', region: 'Asia' },
    { value: 'Asia/Dhaka', label: 'Bangladesh (BST)', offset: '+06:00', region: 'Asia' },
    
    // Australia/Pacific
    { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00', region: 'Pacific' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST)', offset: '+10:00', region: 'Pacific' },
    { value: 'Australia/Perth', label: 'Perth (AWST)', offset: '+08:00', region: 'Pacific' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: '+12:00', region: 'Pacific' },
    
    // Africa
    { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: '+02:00', region: 'Africa' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)', offset: '+01:00', region: 'Africa' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: '+02:00', region: 'Africa' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)', offset: '+03:00', region: 'Africa' },
    
    // UTC
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00', region: 'UTC' },
];

interface TimezoneOption {
    value: string;
    label: string;
    offset: string;
    region: string;
}

interface TimezoneSelectorProps {
    value: string;
    onChange: (timezone: string) => void;
    label?: string;
    helperText?: string;
    required?: boolean;
    error?: boolean;
    fullWidth?: boolean;
    disabled?: boolean;
}

/**
 * Get the browser's current timezone
 */
export function getBrowserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

/**
 * Check if a timezone exists in the common list, if not add it
 */
function getTimezoneOptions(browserTimezone: string): TimezoneOption[] {
    const options = [...COMMON_TIMEZONES];
    
    // Check if browser timezone is already in the list
    const browserTzExists = options.some(tz => tz.value === browserTimezone);
    
    if (!browserTzExists && browserTimezone) {
        // Add browser timezone at the top
        options.unshift({
            value: browserTimezone,
            label: `${browserTimezone.replace(/_/g, ' ')} (Your timezone)`,
            offset: '',
            region: 'Local'
        });
    }
    
    return options;
}

export default function TimezoneSelector({
    value,
    onChange,
    label = 'Timezone',
    helperText = 'Select the timezone for this screen\'s operating hours',
    required = false,
    error = false,
    fullWidth = true,
    disabled = false,
}: TimezoneSelectorProps) {
    const browserTimezone = useMemo(() => getBrowserTimezone(), []);
    const timezoneOptions = useMemo(() => getTimezoneOptions(browserTimezone), [browserTimezone]);
    
    // Find the selected option
    const selectedOption = timezoneOptions.find(tz => tz.value === value) || {
        value,
        label: value,
        offset: '',
        region: 'Other'
    };

    return (
        <Autocomplete
            value={selectedOption}
            onChange={(_event, newValue) => {
                if (newValue) {
                    onChange(newValue.value);
                }
            }}
            options={timezoneOptions}
            groupBy={(option) => option.region}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, val) => option.value === val.value}
            disabled={disabled}
            fullWidth={fullWidth}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    required={required}
                    error={error}
                    helperText={helperText}
                />
            )}
            renderOption={(props, option) => {
                const { key, ...otherProps } = props as { key: string } & React.HTMLAttributes<HTMLLIElement>;
                return (
                    <Box component="li" key={key} {...otherProps}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{option.label}</Typography>
                            {option.offset && (
                                <Typography variant="caption" color="text.secondary">
                                    UTC {option.offset}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                );
            }}
        />
    );
}
