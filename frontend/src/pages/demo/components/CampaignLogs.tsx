// CampaignLogs Component (MUI Version)

import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import type { CampaignLog } from '../types';
import { formatTimestamp } from '../utils/demoUtils';

interface CampaignLogsProps {
    logs: CampaignLog[];
}

export const CampaignLogs: React.FC<CampaignLogsProps> = ({ logs }) => {
    const getStatusColor = (status: CampaignLog['status']) => {
        switch (status) {
            case 'approved':
            case 'playing':
                return 'success';
            case 'rejected':
                return 'error';
            case 'expired':
                return 'warning';
            default:
                return 'info';
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Campaign Logs
            </Typography>

            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {logs.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            No activity yet
                        </Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                        {logs.map((log) => (
                            <Paper
                                key={log.id}
                                variant="outlined"
                                sx={{ p: 2 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle2" fontWeight="bold">
                                            {log.screenName}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {log.message}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                        <Chip
                                            label={log.status.toUpperCase()}
                                            size="small"
                                            color={getStatusColor(log.status)}
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTimestamp(log.timestamp)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};
