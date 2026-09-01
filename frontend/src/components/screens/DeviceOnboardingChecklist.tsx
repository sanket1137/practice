import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Chip,
    Paper,
    Step,
    StepLabel,
    Stepper,
    Tooltip,
    Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import api from '../../services/api';

interface ScreenSetupView {
    status?: string;
    hasApiKey?: boolean;
    verificationStatus?: string | null;
    lastSeenAt?: string | null;
    isOnline?: boolean;
}

interface SyncHealth {
    isOnline: boolean;
    lastSeenAt?: string | null;
    pendingImpressions?: number | null;
    reportedAt?: string | null;
}

/**
 * Device setup checklist + sync health. The checklist derives every step from
 * server state (never client-side guesses) and collapses to one line once the
 * device is fully live. Sync health shows the impression backlog the player
 * self-reports with each heartbeat — "all plays reported" at a glance.
 */
export default function DeviceOnboardingChecklist({ screenId }: { screenId: string }) {
    // Same key as the workspace's screen query — served from cache, no extra fetch.
    const { data: screen } = useQuery<ScreenSetupView>({
        queryKey: ['screen', screenId],
        queryFn: async () => (await api.get(`/screens/${screenId}`)).data.data,
        enabled: !!screenId,
    });

    const { data: sync } = useQuery<SyncHealth>({
        queryKey: ['sync-health', screenId],
        queryFn: async () => (await api.get(`/screens/${screenId}/sync-health`)).data.data,
        enabled: !!screenId,
        refetchInterval: 60 * 1000,
    });

    if (!screen) return null;

    const steps = [
        {
            label: 'API key generated',
            done: !!screen.hasApiKey,
            hint: 'Generate the key below and put it in the player\'s config.',
        },
        {
            label: 'Player connected',
            done: !!screen.lastSeenAt,
            hint: 'Start the player on the device — it appears here on its first heartbeat.',
        },
        {
            label: 'Screen verified',
            done: screen.verificationStatus === 'Verified',
            hint: 'Complete the QR + video verification under Settings.',
        },
        {
            label: 'Live for bookings',
            done: screen.status === 'Active',
            hint: 'Activate the screen from the lifecycle controls once verified and connected.',
        },
    ];
    const doneCount = steps.filter((s) => s.done).length;
    const complete = doneCount === steps.length;
    const nextStep = steps.find((s) => !s.done);

    const pending = sync?.pendingImpressions;

    return (
        <Paper sx={{ p: 2.5, mb: 3 }}>
            {complete ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" fontWeight={600}>Device set up and live</Typography>
                </Box>
            ) : (
                <>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        Device setup — {doneCount}/{steps.length}
                    </Typography>
                    <Stepper activeStep={doneCount} alternativeLabel sx={{ mb: 1 }}>
                        {steps.map((s) => (
                            <Step key={s.label} completed={s.done}>
                                <StepLabel>{s.label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                    {nextStep && (
                        <Typography variant="body2" color="text.secondary">
                            Next: {nextStep.hint}
                        </Typography>
                    )}
                </>
            )}

            {/* Sync health — meaningful once the player has connected at least once */}
            {!!screen.lastSeenAt && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: complete ? 1 : 2, flexWrap: 'wrap' }}>
                    {pending == null ? (
                        <Chip size="small" variant="outlined" icon={<CloudQueueIcon />}
                            label="Sync health: awaiting first report from the player" />
                    ) : pending === 0 ? (
                        <Tooltip title="The player has no impressions queued locally — everything it played has reached the server." arrow>
                            <Chip size="small" color="success" variant="outlined" icon={<CloudDoneIcon />}
                                label="All plays reported" />
                        </Tooltip>
                    ) : (
                        <Tooltip title="Plays recorded on the device that haven't synced yet. They are safe in the player's local store and upload automatically — a growing number here usually means a connectivity problem." arrow>
                            <Chip size="small" color="warning" variant="outlined" icon={<CloudQueueIcon />}
                                label={`${pending.toLocaleString()} play${pending === 1 ? '' : 's'} queued on device`} />
                        </Tooltip>
                    )}
                    {sync?.reportedAt && (
                        <Typography variant="caption" color="text.secondary">
                            reported {new Date(sync.reportedAt).toLocaleTimeString()}
                        </Typography>
                    )}
                </Box>
            )}
        </Paper>
    );
}
