import React from 'react';
import {
    Box,
    FormControlLabel,
    Checkbox,
    TextField,
    Typography,
    Grid,
    Paper,
} from '@mui/material';

interface DaySchedule {
    startTime: string;
    endTime: string;
    isOperating: boolean;
}

interface OperatingSchedule {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

interface OperatingScheduleFormProps {
    schedule: OperatingSchedule;
    onChange: (schedule: OperatingSchedule) => void;
}

const daysOfWeek: (keyof OperatingSchedule)[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
];

const OperatingScheduleForm: React.FC<OperatingScheduleFormProps> = ({
    schedule,
    onChange,
}) => {
    const handleDayToggle = (day: keyof OperatingSchedule) => {
        const newSchedule = { ...schedule };
        newSchedule[day] = {
            ...newSchedule[day],
            isOperating: !newSchedule[day].isOperating,
        };
        onChange(newSchedule);
    };

    const handleTimeChange = (
        day: keyof OperatingSchedule,
        field: 'startTime' | 'endTime',
        value: string
    ) => {
        const newSchedule = { ...schedule };
        newSchedule[day] = {
            ...newSchedule[day],
            [field]: value,
        };
        onChange(newSchedule);
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Operating Schedule
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Configure when your screen operates each day
            </Typography>

            <Grid container spacing={2}>
                {daysOfWeek.map((day) => (
                    <Grid item xs={12} key={day}>
                        <Paper sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={schedule[day].isOperating}
                                            onChange={() => handleDayToggle(day)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ textTransform: 'capitalize', minWidth: 100 }}>
                                            {day}
                                        </Typography>
                                    }
                                />

                                {schedule[day].isOperating && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                        <TextField
                                            type="time"
                                            label="Start Time"
                                            value={schedule[day].startTime}
                                            onChange={(e) =>
                                                handleTimeChange(day, 'startTime', e.target.value)
                                            }
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ minWidth: 150 }}
                                        />
                                        <Typography variant="body2" color="textSecondary">
                                            to
                                        </Typography>
                                        <TextField
                                            type="time"
                                            label="End Time"
                                            value={schedule[day].endTime}
                                            onChange={(e) =>
                                                handleTimeChange(day, 'endTime', e.target.value)
                                            }
                                            InputLabelProps={{ shrink: true }}
                                            size="small"
                                            sx={{ minWidth: 150 }}
                                        />
                                    </Box>
                                )}

                                {!schedule[day].isOperating && (
                                    <Typography variant="body2" color="textSecondary">
                                        Closed
                                    </Typography>
                                )}
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default OperatingScheduleForm;
