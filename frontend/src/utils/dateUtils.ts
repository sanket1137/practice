import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Timezone Utilities for CCMS Frontend
 * 
 * PRINCIPLE: Backend sends/receives only UTC dates (ISO 8601 with 'Z')
 * Frontend converts to local timezone only for display
 */

/**
 * Get user's timezone from browser
 */
export const getUserTimezone = (): string => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Convert UTC date from backend to local time for display
 * @param utcDate - ISO 8601 string from backend (e.g., "2026-01-09T00:00:00.000Z")
 * @param formatString - date-fns format string (default: "MMM dd, yyyy hh:mm a")
 * @returns Formatted local time string
 * 
 * @example
 * // Backend sends: "2026-01-09T00:00:00.000Z"
 * // User in IST sees: "Jan 09, 2026 05:30 AM"  
 * displayLocalDate("2026-01-09T00:00:00.000Z") // "Jan 09, 2026 05:30 AM"
 */
export const displayLocalDate = (
    utcDate: string | Date,
    formatString: string = 'MMM dd, yyyy hh:mm a'
): string => {
    const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
    const userTz = getUserTimezone();
    const zonedDate = toZonedTime(date, userTz);
    return format(zonedDate, formatString);
};

/**
 * Convert local user input to UTC for sending to backend
 * @param localDate - Date object from date picker (in user's local timezone)
 * @returns ISO 8601 UTC string for backend
 * 
 * @example
 * // User in IST picks: Jan 09, 2026 10:00 AM
 * // Sends to backend: "2026-01-09T04:30:00.000Z"
 * toUTC(new Date(2026, 0, 9, 10, 0)) // "2026-01-09T04:30:00.000Z"
 */
export const toUTC = (localDate: Date): string => {
    const userTz = getUserTimezone();
    const utcDate = fromZonedTime(localDate, userTz);
    return utcDate.toISOString();
};

/**
 * Check if a UTC date is today in user's timezone
 * @param utcDate - ISO 8601 UTC string
 * @returns true if date is today in user's local timezone
 */
export const isToday = (utcDate: string): boolean => {
    const userTz = getUserTimezone();
    const zonedDate = toZonedTime(parseISO(utcDate), userTz);
    const now = toZonedTime(new Date(), userTz);
    return format(zonedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
};

/**
 * Get UTC offset string for display
 * @returns Offset string like "+05:30" or "-08:00"
 */
export const getTimezoneOffset = (): string => {
    return format(new Date(), 'XXX');
};

/**
 * Display date in short format (date only, no time)
 */
export const displayLocalDateShort = (utcDate: string | Date): string => {
    return displayLocalDate(utcDate, 'MMM dd, yyyy');
};

/**
 * Display time only
 */
export const displayLocalTime = (utcDate: string | Date): string => {
    return displayLocalDate(utcDate, 'hh:mm a');
};
