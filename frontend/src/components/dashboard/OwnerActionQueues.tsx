import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import PendingActionsIcon from '@mui/icons-material/PendingActions';

/** Structural slice of the dashboard's existing screens query — no extra fetching. */
export interface QueueScreen {
    id: string;
    name: string;
    status: string;
    isOnline?: boolean;
}

/**
 * "Needs attention" feed: screens that are silently not earning — online
 * screens gone dark, and screens stuck before Active. Derived entirely from
 * the screens list already on the dashboard. Renders nothing when all clear.
 */
export function NeedsAttention({ screens }: { screens: QueueScreen[] }) {
    const navigate = useNavigate();

    const offline = screens.filter((s) => s.status === 'Active' && s.isOnline === false);
    const stuck = screens.filter((s) =>
        s.status === 'Draft' || s.status === 'PendingVerification' || s.status === 'Ready');

    if (offline.length === 0 && stuck.length === 0) return null;

    return (
        <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <WarningAmberIcon color="error" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Needs attention
                    </Typography>
                </Box>
                <Box sx={{ display: 'grid', gap: 1 }}>
                    {offline.map((s) => (
                        <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                            <WifiOffIcon color="error" fontSize="small" />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>{s.name} is offline</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    The player stopped responding — plays are not being delivered.
                                </Typography>
                            </Box>
                            <Button size="small" onClick={() => navigate(`/screens/${s.id}?tab=device`)}>
                                Check device
                            </Button>
                        </Box>
                    ))}
                    {stuck.map((s) => (
                        <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                            <PendingActionsIcon color="warning" fontSize="small" />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                    {s.name} isn't earning yet
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {s.status === 'Draft' && 'Setup incomplete — finish the details and submit for verification.'}
                                    {s.status === 'PendingVerification' && 'Verification in progress — complete the QR + video step.'}
                                    {s.status === 'Ready' && 'Verified and ready — connect the player and activate.'}
                                </Typography>
                            </Box>
                            <Button size="small" onClick={() => navigate(`/screens/${s.id}?tab=settings`)}>
                                Finish setup
                            </Button>
                        </Box>
                    ))}
                </Box>
            </CardContent>
        </Card>
    );
}
