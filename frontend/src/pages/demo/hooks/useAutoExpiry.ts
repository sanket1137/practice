// useAutoExpiry - Hook for managing auto-expiry timers

import { useEffect, useRef } from 'react';
import { BOOKING_DURATION_MS, STREAM_DURATION_MS } from '../utils/demoUtils';

export const useAutoExpiry = (
    bookings: Array<{ id: string; status: string; createdAt: Date }>,
    screens: Array<{ id: string; streamActive: boolean; streamStartedAt?: Date }>,
    onExpireBooking: (bookingId: string) => void,
    onStopStream: (screenId: string) => void
) => {
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        // Setup booking expiry timers
        bookings.forEach(booking => {
            if (booking.status === 'pending' && !timersRef.current.has(booking.id)) {
                const expiryTime = booking.createdAt.getTime() + BOOKING_DURATION_MS;
                const timeUntilExpiry = expiryTime - Date.now();

                if (timeUntilExpiry > 0) {
                    const timer = setTimeout(() => {
                        onExpireBooking(booking.id);
                        timersRef.current.delete(booking.id);
                    }, timeUntilExpiry);

                    timersRef.current.set(booking.id, timer);
                }
            }

            // Clear timer if booking is no longer pending
            if (booking.status !== 'pending' && timersRef.current.has(booking.id)) {
                clearTimeout(timersRef.current.get(booking.id));
                timersRef.current.delete(booking.id);
            }
        });

        // Setup stream stop timers
        screens.forEach(screen => {
            const streamTimerId = `stream-${screen.id}`;

            if (screen.streamActive && screen.streamStartedAt && !timersRef.current.has(streamTimerId)) {
                const stopTime = screen.streamStartedAt.getTime() + STREAM_DURATION_MS;
                const timeUntilStop = stopTime - Date.now();

                if (timeUntilStop > 0) {
                    const timer = setTimeout(() => {
                        onStopStream(screen.id);
                        timersRef.current.delete(streamTimerId);
                    }, timeUntilStop);

                    timersRef.current.set(streamTimerId, timer);
                }
            }

            // Clear timer if stream is no longer active
            if (!screen.streamActive && timersRef.current.has(streamTimerId)) {
                clearTimeout(timersRef.current.get(streamTimerId));
                timersRef.current.delete(streamTimerId);
            }
        });

        // Cleanup on unmount
        return () => {
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current.clear();
        };
    }, [bookings, screens, onExpireBooking, onStopStream]);
};
