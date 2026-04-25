import { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
    Box, CircularProgress, Alert, Stack, LinearProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { cmsPairingApi } from '../../services/cmsApi';

interface Props {
    open: boolean;
    onClose: () => void;
}

/**
 * Displays a 6-character pairing code that a player device uses to claim a screen.
 * Polls status every 3 s; closes automatically when the code is claimed.
 */
export default function PairingCodeDialog({ open, onClose }: Props) {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [code, setCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);

    const generate = useMutation({
        mutationFn: () => cmsPairingApi.generate(),
        onSuccess: (res) => {
            setCode(res.code);
            setExpiresAt(res.expiresAt);
        },
        onError: () => enqueueSnackbar('Failed to generate pairing code', { variant: 'error' }),
    });

    useEffect(() => {
        if (open && !code) {
            generate.mutate();
        }
        if (!open) {
            setCode(null);
            setExpiresAt(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const { data: status } = useQuery({
        queryKey: ['cms-pair-status', code],
        queryFn: () => cmsPairingApi.status(code!),
        enabled: open && !!code,
        refetchInterval: 3000,
        staleTime: 0,
    });

    useEffect(() => {
        if (status?.isClaimed) {
            enqueueSnackbar('Device paired successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['cms-screens'] });
            onClose();
        }
    }, [status?.isClaimed, queryClient, enqueueSnackbar, onClose]);

    const secondsLeft = expiresAt
        ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
        : 0;
    const expired = !!expiresAt && secondsLeft <= 0;

    const copyCode = async () => {
        if (!code) return;
        await navigator.clipboard.writeText(code);
        enqueueSnackbar('Code copied', { variant: 'info' });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Pair a new screen</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Enter this code in the player app running on your device. The code expires in 10 minutes.
                    </Typography>

                    {generate.isPending && <CircularProgress />}

                    {code && !expired && (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography
                                variant="h2"
                                sx={{
                                    fontFamily: 'monospace',
                                    letterSpacing: 8,
                                    fontWeight: 700,
                                    color: 'primary.main',
                                }}
                            >
                                {code}
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<ContentCopyIcon />}
                                onClick={copyCode}
                                sx={{ mt: 1 }}
                            >
                                Copy
                            </Button>
                        </Box>
                    )}

                    {expired && (
                        <Alert severity="warning">
                            This code has expired. Generate a new one to continue.
                        </Alert>
                    )}

                    {code && !expired && (
                        <Box>
                            <LinearProgress
                                variant="determinate"
                                value={(secondsLeft / 600) * 100}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                            </Typography>
                        </Box>
                    )}

                    {status && !status.isClaimed && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} />
                            <Typography variant="caption">Waiting for device…</Typography>
                        </Stack>
                    )}

                    {status?.isClaimed && (
                        <Alert severity="success" icon={<CheckCircleIcon />}>
                            Device paired — closing dialog.
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button
                    variant="contained"
                    onClick={() => generate.mutate()}
                    disabled={generate.isPending}
                >
                    {expired ? 'Generate new code' : 'Regenerate'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
