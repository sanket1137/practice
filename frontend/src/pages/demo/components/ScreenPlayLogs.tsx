// ScreenPlayLogs Component (MUI Version)

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { PlayLog } from '../types';
import { formatTimestamp } from '../utils/demoUtils';

interface ScreenPlayLogsProps {
    logs: PlayLog[];
    screenName: string;
}

export const ScreenPlayLogs: React.FC<ScreenPlayLogsProps> = ({ logs, screenName }) => {
    const getLogIcon = (type: PlayLog['type']) => {
        switch (type) {
            case 'ad_start':
            case 'stream_start':
                return '▶️';
            case 'ad_end':
            case 'stream_end':
                return '⏹️';
            default:
                return '📝';
        }
    };

    return (
        <Paper className="play-logs" variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom>
                {screenName}
            </Typography>

            <Box sx={{ maxHeight: 160, overflow: 'auto' }}>
                {logs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            No activity
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                        {logs.map((log) => (
                            <Paper
                                key={log.id}
                                variant="outlined"
                                sx={{ p: 1, bgcolor: 'grey.50', display: 'flex', gap: 1, alignItems: 'flex-start' }}
                            >
                                <Box>{getLogIcon(log.type)}</Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" color="text.primary" display="block">
                                        {log.message}
                                    </Typography>
                                    <Typography variant="caption" color="grey.700" display="block">
                                        {formatTimestamp(log.timestamp)}
                                    </Typography>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Box>
        </Paper>
    );
};
