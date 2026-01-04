// useDemoState - Main state management hook for demo page

import { useState, useCallback } from 'react';
import type { DemoState, Booking, CampaignLog, PlayLog, Creative } from '../types';
import { generateId, BOOKING_DURATION_MS, createVideoUrl, revokeVideoUrl } from '../utils/demoUtils';
import { DEFAULT_PRICING_CONFIG, createInitialSlots } from '../utils/pricingUtils';

const INITIAL_SCREENS = [
    {
        id: 'screen-1',
        name: 'Bandra-Worli Sea Link Screen-1',
        location: 'Mumbai Highway',
        status: 'idle' as const,
        currentBooking: null,
        playLogs: [],
        streamActive: false,
    },
    {
        id: 'screen-2',
        name: 'MG Road & Brigade Road Screen-1',
        location: 'Bangalore',
        status: 'idle' as const,
        currentBooking: null,
        playLogs: [],
        streamActive: false,
    },
];

export const useDemoState = () => {
    const [state, setState] = useState<DemoState>({
        campaign: {
            id: 'campaign-summer-sale',
            name: 'Summer Sale',
            creative: {
                video: null,
                videoUrl: null,
                duration: 0,
                name: '',
            },
        },
        screens: INITIAL_SCREENS,
        bookings: [],
        campaignLogs: [],
        pricingConfig: DEFAULT_PRICING_CONFIG,
        slots: {
            'screen-1': createInitialSlots('screen-1', DEFAULT_PRICING_CONFIG.totalSlots),
            'screen-2': createInitialSlots('screen-2', DEFAULT_PRICING_CONFIG.totalSlots),
        },
        advertiserStats: {
            bookingsCreated: 0,
            bookingsApproved: 0,
            bookingsRejected: 0,
            totalSpent: 0,
        },
        screenOwnerStats: {
            bookingsReceived: 0,
            bookingsApproved: 0,
            bookingsRejected: 0,
            totalRevenue: 0, // Start from 0, will increment with plays
        },
    });

    // Upload creative video
    const uploadCreative = useCallback((file: File, duration: number) => {
        const videoUrl = createVideoUrl(file);

        setState(prev => {
            // Revoke old URL if exists
            if (prev.campaign.creative.videoUrl) {
                revokeVideoUrl(prev.campaign.creative.videoUrl);
            }

            return {
                ...prev,
                campaign: {
                    ...prev.campaign,
                    creative: {
                        video: file,
                        videoUrl,
                        duration,
                        name: file.name,
                    },
                },
            };
        });
    }, []);

    // Create booking
    const createBooking = useCallback((screenId: string) => {
        const now = new Date();
        const booking: Booking = {
            id: generateId(),
            campaignId: state.campaign.id,
            screenId,
            status: 'pending',
            createdAt: now,
            expiresAt: new Date(now.getTime() + BOOKING_DURATION_MS),
        };

        const screen = state.screens.find(s => s.id === screenId);

        setState(prev => ({
            ...prev,
            bookings: [...prev.bookings, booking],
            campaignLogs: [...prev.campaignLogs, {
                id: generateId(),
                timestamp: now,
                screenId,
                screenName: screen?.name || '',
                status: 'booked',
                message: `Booking created for ${screen?.name}`,
            }],
            advertiserStats: {
                ...prev.advertiserStats,
                bookingsCreated: prev.advertiserStats.bookingsCreated + 1,
            },
            screenOwnerStats: {
                ...prev.screenOwnerStats,
                bookingsReceived: prev.screenOwnerStats.bookingsReceived + 1,
            },
        }));

        return booking.id;
    }, [state.campaign.id, state.screens]);

    // Approve booking
    const approveBooking = useCallback((bookingId: string) => {
        const now = new Date();

        setState(prev => {
            const booking = prev.bookings.find(b => b.id === bookingId);
            if (!booking) return prev;

            const screen = prev.screens.find(s => s.id === booking.screenId);
            const bookingCost = prev.pricingConfig.pricePerSlot;

            // Find next available slot for this screen
            const screenSlots = prev.slots[booking.screenId] || [];
            const nextAvailableSlot = screenSlots.find(slot => !slot.isBooked);

            // Update slots to mark the next available slot as booked
            const updatedSlots = {
                ...prev.slots,
                [booking.screenId]: screenSlots.map(slot =>
                    slot.slotNumber === nextAvailableSlot?.slotNumber
                        ? {
                            ...slot,
                            isBooked: true,
                            bookingId: booking.id,
                            campaignName: prev.campaign.name,
                            price: bookingCost,
                            videoUrl: prev.campaign.creative.videoUrl,
                        }
                        : slot
                ),
            };

            return {
                ...prev,
                bookings: prev.bookings.map(b =>
                    b.id === bookingId
                        ? { ...b, status: 'approved' as const, approvedAt: now }
                        : b
                ),
                screens: prev.screens.map(s =>
                    s.id === booking.screenId
                        ? {
                            ...s,
                            status: 'playing' as const,
                            currentBooking: booking,
                            streamActive: true,
                            streamStartedAt: now,
                        }
                        : s
                ),
                slots: updatedSlots,
                campaignLogs: [...prev.campaignLogs, {
                    id: generateId(),
                    timestamp: now,
                    screenId: booking.screenId,
                    screenName: screen?.name || '',
                    status: 'approved',
                    message: `✓ Approved - Slot ${nextAvailableSlot?.slotNumber} booked on ${screen?.name}`,
                }],
                advertiserStats: {
                    ...prev.advertiserStats,
                    bookingsApproved: prev.advertiserStats.bookingsApproved + 1,
                    totalSpent: prev.advertiserStats.totalSpent + bookingCost,
                },
                screenOwnerStats: {
                    ...prev.screenOwnerStats,
                    bookingsApproved: prev.screenOwnerStats.bookingsApproved + 1,
                    totalRevenue: prev.screenOwnerStats.totalRevenue + bookingCost,
                },
            };
        });
    }, []);

    // Reject booking
    const rejectBooking = useCallback((bookingId: string) => {
        const now = new Date();

        setState(prev => {
            const booking = prev.bookings.find(b => b.id === bookingId);
            if (!booking) return prev;

            const screen = prev.screens.find(s => s.id === booking.screenId);

            return {
                ...prev,
                bookings: prev.bookings.map(b =>
                    b.id === bookingId
                        ? { ...b, status: 'rejected' as const }
                        : b
                ),
                campaignLogs: [...prev.campaignLogs, {
                    id: generateId(),
                    timestamp: now,
                    screenId: booking.screenId,
                    screenName: screen?.name || '',
                    status: 'rejected',
                    message: `✗ Rejected by ${screen?.name}`,
                }],
                advertiserStats: {
                    ...prev.advertiserStats,
                    bookingsRejected: prev.advertiserStats.bookingsRejected + 1,
                },
                screenOwnerStats: {
                    ...prev.screenOwnerStats,
                    bookingsRejected: prev.screenOwnerStats.bookingsRejected + 1,
                },
            };
        });
    }, []);

    // Stop stream
    const stopStream = useCallback((screenId: string) => {
        const now = new Date();

        setState(prev => ({
            ...prev,
            screens: prev.screens.map(s =>
                s.id === screenId
                    ? {
                        ...s,
                        streamActive: false,
                        status: 'idle' as const,
                        playLogs: [...s.playLogs, {
                            id: generateId(),
                            timestamp: now,
                            type: 'stream_end',
                            message: 'Stream ended (1 min limit)',
                        }],
                    }
                    : s
            ),
        }));
    }, []);

    // Add play log
    const addPlayLog = useCallback((screenId: string, type: PlayLog['type'], message: string) => {
        const now = new Date();

        setState(prev => ({
            ...prev,
            screens: prev.screens.map(s =>
                s.id === screenId
                    ? {
                        ...s,
                        playLogs: [...s.playLogs, {
                            id: generateId(),
                            timestamp: now,
                            type,
                            message,
                        }],
                    }
                    : s
            ),
        }));
    }, []);

    // Expire booking
    const expireBooking = useCallback((bookingId: string) => {
        const now = new Date();

        setState(prev => {
            const booking = prev.bookings.find(b => b.id === bookingId);
            if (!booking) return prev;

            const screen = prev.screens.find(s => s.id === booking.screenId);

            return {
                ...prev,
                bookings: prev.bookings.map(b =>
                    b.id === bookingId
                        ? { ...b, status: 'expired' as const }
                        : b
                ),
                campaignLogs: [...prev.campaignLogs, {
                    id: generateId(),
                    timestamp: now,
                    screenId: booking.screenId,
                    screenName: screen?.name || '',
                    status: 'expired',
                    message: `Booking expired (5 min timeout)`,
                }],
            };
        });
    }, []);

    // Increment play count when a slot completes playing
    const incrementPlayCount = useCallback((screenId: string, slotNumber: number) => {
        setState(prev => {
            const slot = prev.slots[screenId]?.find(s => s.slotNumber === slotNumber);

            // Only track booked slots (not empty/default content)
            if (!slot || !slot.isBooked) return prev;

            const pricePerPlay = 10; // ₹10 per play

            // Update slot play count
            const updatedSlots = {
                ...prev.slots,
                [screenId]: prev.slots[screenId].map(s =>
                    s.slotNumber === slotNumber
                        ? { ...s, playCount: (s.playCount || 0) + 1 }
                        : s
                ),
            };

            // Update booking play count (if booking exists, not pre-booked)
            const updatedBookings = slot.bookingId && !slot.bookingId.startsWith('pre-')
                ? prev.bookings.map(b =>
                    b.id === slot.bookingId
                        ? { ...b, playCount: (b.playCount || 0) + 1 }
                        : b
                )
                : prev.bookings;

            // Check if this is advertiser's campaign
            const isAdvertiserCampaign = slot.campaignName === prev.campaign.name;

            return {
                ...prev,
                slots: updatedSlots,
                bookings: updatedBookings,
                screenOwnerStats: {
                    ...prev.screenOwnerStats,
                    totalRevenue: prev.screenOwnerStats.totalRevenue + pricePerPlay,
                },
                advertiserStats: isAdvertiserCampaign ? {
                    ...prev.advertiserStats,
                    totalSpent: prev.advertiserStats.totalSpent + pricePerPlay,
                } : prev.advertiserStats,
            };
        });
    }, []);

    return {
        state,
        uploadCreative,
        createBooking,
        approveBooking,
        rejectBooking,
        stopStream,
        addPlayLog,
        expireBooking,
        incrementPlayCount,
    };
};
