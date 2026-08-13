import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import QrScannerDialog from '../../components/verification/QrScannerDialog';
import { useAuthStore } from '../../store/authStore';
import { playerPairingApi } from '../../services/playerPairingApi';

const cmsSchema = z.object({
  screenName: z.string().min(2, 'Screen name is required').max(100),
  orientation: z.enum(['Landscape', 'Portrait']),
  resolutionWidth: z.string().regex(/^\d+$/, 'Width must be a number'),
  resolutionHeight: z.string().regex(/^\d+$/, 'Height must be a number'),
  venue: z.string().min(2, 'Venue is required').max(200),
});

const ccmsSchema = z.object({
  screenName: z.string().min(2, 'Screen name is required').max(100),
  description: z.string().min(5, 'Description is required').max(500),
  orientation: z.enum(['Landscape', 'Portrait']),
  resolutionWidth: z.string().regex(/^\d+$/, 'Width must be a number'),
  resolutionHeight: z.string().regex(/^\d+$/, 'Height must be a number'),
  street: z.string().min(3, 'Street is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  country: z.string().min(2),
  postalCode: z.string().min(4),
  latitude: z.string().regex(/^-?\d+(\.\d+)?$/, 'Latitude must be numeric'),
  longitude: z.string().regex(/^-?\d+(\.\d+)?$/, 'Longitude must be numeric'),
  timezone: z.string().min(2),
  pricePerSlot: z.string().regex(/^\d+(\.\d+)?$/, 'Price must be numeric'),
  currency: z.string().min(2),
  timeFrameMinutes: z.string().regex(/^\d+$/, 'Timeframe must be numeric'),
  slotsPerFrame: z.string().regex(/^\d+$/, 'Slots must be numeric'),
  operatingStart: z.string().regex(/^\d{2}:\d{2}$/),
  operatingEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

type CmsFormValues = z.infer<typeof cmsSchema>;
type CcmsFormValues = z.infer<typeof ccmsSchema>;

function extractTokenFromQr(raw: string): string | null {
  try {
    if (raw.includes('token=')) {
      const url = new URL(raw);
      return url.searchParams.get('token');
    }
  } catch {
    // ignore malformed URL and fallback below
  }
  return null;
}

function buildSchedule(startTime: string, endTime: string): unknown {
  return {
    monday: { isOperating: true, startTime, endTime },
    tuesday: { isOperating: true, startTime, endTime },
    wednesday: { isOperating: true, startTime, endTime },
    thursday: { isOperating: true, startTime, endTime },
    friday: { isOperating: true, startTime, endTime },
    saturday: { isOperating: true, startTime, endTime },
    sunday: { isOperating: true, startTime, endTime },
  };
}

export default function ClaimPlayerQrPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [scannerOpen, setScannerOpen] = useState(false);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const accountType = useAuthStore((state) => state.user?.accountType);
  const isCms = accountType === 'CmsOwner';

  const cmsForm = useForm<CmsFormValues>({
    resolver: zodResolver(cmsSchema),
    defaultValues: {
      screenName: 'My Screen',
      orientation: 'Landscape',
      resolutionWidth: '1920',
      resolutionHeight: '1080',
      venue: '',
    },
  });

  const ccmsForm = useForm<CcmsFormValues>({
    resolver: zodResolver(ccmsSchema),
    defaultValues: {
      screenName: '',
      description: '',
      orientation: 'Landscape',
      resolutionWidth: '1920',
      resolutionHeight: '1080',
      street: '',
      city: '',
      state: '',
      country: 'India',
      postalCode: '',
      latitude: '0',
      longitude: '0',
      timezone: 'Asia/Kolkata',
      pricePerSlot: '100',
      currency: 'INR',
      timeFrameMinutes: '1',
      slotsPerFrame: '6',
      operatingStart: '09:00',
      operatingEnd: '22:00',
    },
  });

  const claimCmsMutation = useMutation({
    mutationFn: (values: CmsFormValues) =>
      playerPairingApi.claimCms({
        token,
        screenName: values.screenName,
        orientation: values.orientation,
        resolutionWidth: Number(values.resolutionWidth),
        resolutionHeight: Number(values.resolutionHeight),
        venue: values.venue,
      }),
    onSuccess: (res) => {
      enqueueSnackbar(`Screen paired: ${res.screenName}`, { variant: 'success' });
      navigate('/cms/screens');
    },
    onError: () => enqueueSnackbar('Failed to pair screen', { variant: 'error' }),
  });

  const claimCcmsMutation = useMutation({
    mutationFn: (values: CcmsFormValues) =>
      playerPairingApi.claimCcms({
        token,
        screenName: values.screenName,
        description: values.description,
        orientation: values.orientation,
        resolutionWidth: Number(values.resolutionWidth),
        resolutionHeight: Number(values.resolutionHeight),
        street: values.street,
        city: values.city,
        state: values.state,
        country: values.country,
        postalCode: values.postalCode,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        timezone: values.timezone,
        pricePerSlot: Number(values.pricePerSlot),
        currency: values.currency,
        timeFrameMinutes: Number(values.timeFrameMinutes),
        slotsPerFrame: Number(values.slotsPerFrame),
        schedule: buildSchedule(values.operatingStart, values.operatingEnd),
      }),
    onSuccess: (res) => {
      enqueueSnackbar(`Screen paired: ${res.screenName}`, { variant: 'success' });
      navigate('/screens');
    },
    onError: () => enqueueSnackbar('Failed to pair screen', { variant: 'error' }),
  });

  const hasToken = useMemo(() => token.length > 8, [token]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Pair player by QR</Typography>
          <Typography variant="body2" color="text.secondary">
            Scan the QR shown on the player device, then fill the required details.
          </Typography>

          {!hasToken && (
            <Alert severity="warning">
              No QR token found. Scan a player QR to continue.
            </Alert>
          )}

          <Box>
            <Button variant="outlined" onClick={() => setScannerOpen(true)}>
              Scan player QR
            </Button>
          </Box>

          {hasToken && (
            <Alert severity="info">Token captured. Complete registration below.</Alert>
          )}

          {hasToken && isCms && (
            <Box component="form" onSubmit={cmsForm.handleSubmit((v) => claimCmsMutation.mutate(v))}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="screenName"
                    control={cmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Screen name"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="orientation"
                    control={cmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        select
                        fullWidth
                        label="Orientation"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      >
                        <MenuItem value="Landscape">Landscape</MenuItem>
                        <MenuItem value="Portrait">Portrait</MenuItem>
                      </TextField>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="resolutionWidth"
                    control={cmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        label="Width"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Controller
                    name="resolutionHeight"
                    control={cmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        label="Height"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="venue"
                    control={cmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Venue"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message || 'Example: Floor 2 - Food Court'}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button type="submit" variant="contained" disabled={claimCmsMutation.isPending}>
                    {claimCmsMutation.isPending ? 'Pairing...' : 'Pair CMS screen'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}

          {hasToken && !isCms && (
            <Box component="form" onSubmit={ccmsForm.handleSubmit((v) => claimCcmsMutation.mutate(v))}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6">CCMS details</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="screenName"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} fullWidth label="Screen name" error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="pricePerSlot"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} type="number" fullWidth label="Price per slot" error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="description"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} fullWidth label="Description" multiline rows={2} error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller
                    name="timeFrameMinutes"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} type="number" fullWidth label="Availability timeframe (min)" error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller
                    name="slotsPerFrame"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} type="number" fullWidth label="Slots per frame" error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller
                    name="timezone"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} fullWidth label="Timezone" error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="operatingStart"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} type="time" fullWidth label="Operating start" InputLabelProps={{ shrink: true }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller
                    name="operatingEnd"
                    control={ccmsForm.control}
                    render={({ field, fieldState }) => (
                      <TextField {...field} type="time" fullWidth label="Operating end" InputLabelProps={{ shrink: true }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2">Address and location</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Controller name="street" control={ccmsForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} fullWidth label="Street" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller name="city" control={ccmsForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} fullWidth label="City" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller name="state" control={ccmsForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} fullWidth label="State" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Controller name="postalCode" control={ccmsForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} fullWidth label="Postal code" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="latitude" control={ccmsForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} type="number" fullWidth label="Latitude" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Controller name="longitude" control={ccmsForm.control} render={({ field, fieldState }) => (
                    <TextField {...field} type="number" fullWidth label="Longitude" error={!!fieldState.error} helperText={fieldState.error?.message} />
                  )} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button type="submit" variant="contained" disabled={claimCcmsMutation.isPending}>
                    {claimCcmsMutation.isPending ? 'Pairing...' : 'Pair CCMS screen'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}
        </Stack>
      </Paper>

      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Scan player registration QR"
        onScan={(raw) => {
          const scannedToken = extractTokenFromQr(raw);
          if (!scannedToken) {
            enqueueSnackbar('Invalid player QR', { variant: 'error' });
            return;
          }
          setSearchParams({ token: scannedToken });
          setScannerOpen(false);
        }}
      />
    </Container>
  );
}
