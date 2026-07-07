import {
    Box, Card, CardContent, Typography, Stack, Switch, CircularProgress,
    Table, TableBody, TableCell, TableHead, TableRow, Button,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { getNotificationPreferences, updateNotificationPreferences } from '../../services/notificationApi';
import type { NotificationPreference, UpdateNotificationPreferenceRequest } from '../../types/notification';
import { useState, useEffect } from 'react';
import ErrorState from '../../components/common/ErrorState';

const CATEGORY_MAP: Record<string, number[]> = {
    Bookings: [1, 2, 3, 4, 5, 24],
    Creatives: [6, 7, 8, 9, 16, 17],
    Campaigns: [10, 11, 12, 18, 19],
    Screens: [20, 21, 22, 25],
    Wallet: [13, 14, 15, 23],
};

export default function NotificationPreferencesPage() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const [local, setLocal] = useState<Record<number, { inApp: boolean; email: boolean }>>({});

    const { data: prefs = [], isLoading, error, refetch } = useQuery({
        queryKey: ['notification-preferences'],
        queryFn: getNotificationPreferences,
    });

    useEffect(() => {
        if (prefs.length > 0) {
            const map: Record<number, { inApp: boolean; email: boolean }> = {};
            prefs.forEach(p => { map[p.notificationType] = { inApp: p.inAppEnabled, email: p.emailEnabled }; });
            setLocal(map);
        }
    }, [prefs]);

    const saveMutation = useMutation({
        mutationFn: (updates: UpdateNotificationPreferenceRequest[]) => updateNotificationPreferences(updates),
        onSuccess: () => {
            enqueueSnackbar('Preferences saved', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
        },
        onError: () => enqueueSnackbar('Failed to save preferences', { variant: 'error' }),
    });

    const toggle = (notificationType: number, key: 'inApp' | 'email') => {
        setLocal(prev => ({
            ...prev,
            [notificationType]: { ...prev[notificationType], [key]: !prev[notificationType]?.[key] },
        }));
    };

    const handleSave = () => {
        const updates: UpdateNotificationPreferenceRequest[] = Object.entries(local).map(([type, val]) => ({
            notificationType: Number(type),
            inAppEnabled: val.inApp,
            emailEnabled: val.email,
        }));
        saveMutation.mutate(updates);
    };

    if (isLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    }

    if (error) {
        return <ErrorState title="Failed to load preferences" onRetry={() => refetch()} />;
    }

    const categoryEntries = Object.entries(CATEGORY_MAP);

    return (
        <Box>
            <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                        <Box>
                            <Typography variant="h5" fontWeight={700}>Notification Preferences</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Control which notifications you receive in-app and by email.
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Saving...' : 'Save preferences'}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            <Stack spacing={3}>
                {categoryEntries.map(([category, types]) => {
                    const categoryPrefs = prefs.filter(p => types.includes(p.notificationType));
                    if (categoryPrefs.length === 0) return null;
                    return (
                        <Card key={category} sx={{ bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <CardContent>
                                <Typography variant="subtitle1" fontWeight={700} mb={1}>{category}</Typography>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Notification</TableCell>
                                            <TableCell align="center">In-App</TableCell>
                                            <TableCell align="center">Email</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {categoryPrefs.map(p => {
                                            const cur = local[p.notificationType] ?? { inApp: p.inAppEnabled, email: p.emailEnabled };
                                            return (
                                                <TableRow key={p.notificationType} hover>
                                                    <TableCell>{p.name}</TableCell>
                                                    <TableCell align="center">
                                                        <Switch
                                                            size="small"
                                                            checked={cur.inApp}
                                                            onChange={() => toggle(p.notificationType, 'inApp')}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Switch
                                                            size="small"
                                                            checked={cur.email}
                                                            onChange={() => toggle(p.notificationType, 'email')}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    );
                })}
            </Stack>
        </Box>
    );
}