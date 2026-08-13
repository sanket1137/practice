import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, TextField, Alert, Stepper,
    Step, StepLabel, Divider, Chip, Grid, CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useMutation } from '@tanstack/react-query';
import { upgradeScreenToMarketplace } from '../../services/profileApi';
import type { ScreenUpgradeRequired } from '../../types/profile';
import { PlacesAutocompleteField, type PlaceDetails } from './PlacesAutocompleteField';

const WIZARD_STORAGE_KEY = 'ccms_mode_switch_draft';
const DRAFT_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes

const DEFAULT_SCHEDULE = {
    monday:    { isOperating: true, startTime: '09:00', endTime: '22:00' },
    tuesday:   { isOperating: true, startTime: '09:00', endTime: '22:00' },
    wednesday: { isOperating: true, startTime: '09:00', endTime: '22:00' },
    thursday:  { isOperating: true, startTime: '09:00', endTime: '22:00' },
    friday:    { isOperating: true, startTime: '09:00', endTime: '22:00' },
    saturday:  { isOperating: true, startTime: '10:00', endTime: '22:00' },
    sunday:    { isOperating: true, startTime: '10:00', endTime: '21:00' },
};

interface ScreenFormState {
    pricePerSlot: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: string;
    longitude: string;
    timezone: string;
    timeFrameMinutes: string;
    slotsPerFrame: string;
}

const defaultForm = (): ScreenFormState => ({
    pricePerSlot: '',
    street: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    latitude: '',
    longitude: '',
    timezone: 'Asia/Kolkata',
    timeFrameMinutes: '10',
    slotsPerFrame: '6',
});

export interface ScreenUpgradeWizardProps {
    open: boolean;
    screens: ScreenUpgradeRequired[];
    onComplete: () => void;
    onCancel: () => void;
}

export default function ScreenUpgradeWizard({
    open,
    screens,
    onComplete,
    onCancel,
}: ScreenUpgradeWizardProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [forms, setForms] = useState<ScreenFormState[]>(() => {
        try {
            const stored = localStorage.getItem(WIZARD_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as { timestamp: number; forms: ScreenFormState[] };
                if (Date.now() - parsed.timestamp < DRAFT_EXPIRY_MS) {
                    return parsed.forms.length === screens.length ? parsed.forms : screens.map(() => defaultForm());
                }
            }
        } catch { /* ignore */ }
        return screens.map(() => defaultForm());
    });
    const [hasDraft, setHasDraft] = useState(() => {
        try {
            const stored = localStorage.getItem(WIZARD_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as { timestamp: number };
                return Date.now() - parsed.timestamp < DRAFT_EXPIRY_MS;
            }
        } catch { /* ignore */ }
        return false;
    });
    const [errorMsg, setErrorMsg] = useState('');
    const [done, setDone] = useState<boolean[]>(() => screens.map(() => false));

    // Persist to localStorage on every form change
    useEffect(() => {
        localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), forms }));
    }, [forms]);

    const upgradeMutation = useMutation({
        mutationFn: ({ screenId, form }: { screenId: string; form: ScreenFormState }) =>
            upgradeScreenToMarketplace(screenId, {
                pricePerSlot: Number(form.pricePerSlot),
                location: {
                    street: form.street,
                    city: form.city,
                    state: form.state,
                    country: form.country,
                    postalCode: form.postalCode,
                },
                latitude: Number(form.latitude) || 0,
                longitude: Number(form.longitude) || 0,
                timezone: form.timezone,
                schedule: DEFAULT_SCHEDULE,
                timeFrameMinutes: Number(form.timeFrameMinutes),
                slotsPerFrame: Number(form.slotsPerFrame),
            }),
        onSuccess: () => {
            setDone((prev) => prev.map((v, i) => i === activeStep ? true : v));
            setErrorMsg('');
            if (activeStep < screens.length - 1) {
                setActiveStep((s) => s + 1);
            } else {
                localStorage.removeItem(WIZARD_STORAGE_KEY);
                onComplete();
            }
        },
        onError: (err: Error) => {
            setErrorMsg(err.message || 'Failed to upgrade screen');
        },
    });

    const current = screens[activeStep];
    const form = forms[activeStep];

    const setField = (field: keyof ScreenFormState, value: string) => {
        setForms((prev) => prev.map((f, i) => i === activeStep ? { ...f, [field]: value } : f));
    };

    const handlePlaceSelect = (details: PlaceDetails) => {
        setForms((prev) => prev.map((f, i) => i === activeStep ? {
            ...f,
            street: details.street,
            city: details.city,
            state: details.state,
            country: details.country,
            postalCode: details.postalCode,
            latitude: String(details.latitude),
            longitude: String(details.longitude),
        } : f));
    };

    const validate = (): string | null => {
        if (!form.city.trim()) return 'City is required';
        if (!form.country.trim()) return 'Country is required';
        const price = Number(form.pricePerSlot);
        if (!price || price <= 0) return 'Price per slot must be positive';
        const tf = Number(form.timeFrameMinutes);
        const sf = Number(form.slotsPerFrame);
        if (!tf || tf <= 0) return 'Time frame minutes must be positive';
        if (!sf || sf <= 0) return 'Slots per frame must be positive';
        if ((tf * 60) % sf !== 0) return `${tf} min frame doesn't divide evenly into slots`;
        return null;
    };

    const handleSave = () => {
        const err = validate();
        if (err) { setErrorMsg(err); return; }
        setErrorMsg('');
        upgradeMutation.mutate({ screenId: current.id, form });
    };

    if (!current) return null;

    return (
        <Dialog open={open} maxWidth="md" fullWidth disableEscapeKeyDown>
            <DialogTitle>
                Upgrade screens to marketplace
                <Typography variant="body2" color="text.secondary">
                    Fill in the required marketplace details for each screen before switching your account.
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {screens.length > 1 && (
                    <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                        {screens.map((s, i) => (
                            <Step key={s.id} completed={done[i]}>
                                <StepLabel>{s.name}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                )}

                <Box mb={2}>
                    <Typography variant="subtitle1" fontWeight={600}>{current.name}</Typography>
                    <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                        {current.needsPricing && <Chip label="Needs pricing" color="warning" size="small" />}
                        {current.needsAddress && <Chip label="Needs address" color="warning" size="small" />}
                        {current.needsSchedule && <Chip label="Needs schedule config" color="warning" size="small" />}
                    </Box>
                </Box>

                {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

                {hasDraft && (
                    <Alert severity="info" sx={{ mb: 2 }} onClose={() => setHasDraft(false)}>
                        A draft was found and has been restored. You can continue where you left off.
                    </Alert>
                )}

                <Grid container spacing={2}>
                    {/* Pricing */}
                    <Grid size={{ xs: 12 }}>
                        <Divider sx={{ mb: 1 }}><Typography variant="caption">Pricing</Typography></Divider>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Price per slot (INR)"
                            type="number"
                            fullWidth
                            required
                            value={form.pricePerSlot}
                            onChange={(e) => setField('pricePerSlot', e.target.value)}
                        />
                    </Grid>

                    {/* Schedule config */}
                    <Grid size={{ xs: 12 }}>
                        <Divider sx={{ mb: 1 }}><Typography variant="caption">Slot configuration</Typography></Divider>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            label="Time frame (minutes)"
                            type="number"
                            fullWidth
                            required
                            value={form.timeFrameMinutes}
                            onChange={(e) => setField('timeFrameMinutes', e.target.value)}
                            helperText="Duration of one ad cycle"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            label="Slots per frame"
                            type="number"
                            fullWidth
                            required
                            value={form.slotsPerFrame}
                            onChange={(e) => setField('slotsPerFrame', e.target.value)}
                            helperText="Ad slots in each cycle"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            label="Timezone"
                            fullWidth
                            value={form.timezone}
                            onChange={(e) => setField('timezone', e.target.value)}
                            helperText="IANA e.g. Asia/Kolkata"
                        />
                    </Grid>

                    {/* Address */}
                    <Grid size={{ xs: 12 }}>
                        <Divider sx={{ mb: 1 }}><Typography variant="caption">Address / Location</Typography></Divider>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <PlacesAutocompleteField
                            value={form.street}
                            onPlaceSelect={handlePlaceSelect}
                            label="Search address"
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField label="Street" fullWidth value={form.street} onChange={(e) => setField('street', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="City" fullWidth required value={form.city} onChange={(e) => setField('city', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="State" fullWidth value={form.state} onChange={(e) => setField('state', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Country" fullWidth required value={form.country} onChange={(e) => setField('country', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Postal code" fullWidth value={form.postalCode} onChange={(e) => setField('postalCode', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Latitude" type="number" fullWidth value={form.latitude} onChange={(e) => setField('latitude', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Longitude" type="number" fullWidth value={form.longitude} onChange={(e) => setField('longitude', e.target.value)} />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onCancel} disabled={upgradeMutation.isPending}>Cancel</Button>
                <Box flex={1} />
                <Typography variant="caption" color="text.secondary">
                    Screen {activeStep + 1} of {screens.length}
                </Typography>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={upgradeMutation.isPending}
                    startIcon={upgradeMutation.isPending ? <CircularProgress size={16} /> : done[activeStep] ? <CheckCircleIcon /> : undefined}
                >
                    {upgradeMutation.isPending
                        ? 'Saving...'
                        : activeStep < screens.length - 1
                        ? 'Save & next'
                        : 'Save & continue'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
