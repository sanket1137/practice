// Tour step configurations for guided tours
import type { Step } from 'react-joyride';

export const advertiserTourSteps: Step[] = [
    {
        target: '.upload-video-section',
        content: '👋 Welcome! Start by uploading your campaign video here (MP4 format, max 50MB)',
        placement: 'right',
        disableBeacon: true,
    },
    {
        target: '.create-booking-section',
        content: '📺 Click on a screen card to select it, then you can book your campaign for that screen',
        placement: 'right',
    },
    {
        target: '.campaign-stats',
        content: '📊 Track your campaign plays and spending in real-time. After booking and approval, watch your stats update as your ads play!',
        placement: 'bottom',
    },
];

export const screenOwnerTourSteps: Step[] = [
    {
        target: '.booking-queue',
        content: '📥 New booking requests appear here. When bookings arrive, click "Approve" to accept and start displaying ads!',
        placement: 'left',
        disableBeacon: true,
    },

    {
        target: '.screen-preview',
        content: '🎥 Watch your screens play content - slots rotate every 10 seconds',
        placement: 'right',
    },
    {
        target: '.revenue-section',
        content: '💰 Track your earnings per campaign - you earn ₹10 for each ad play',
        placement: 'left',
    },
    {
        target: '.play-logs',
        content: '📋 Monitor all screen activity in real-time with detailed play logs',
        placement: 'top',
    },
];
