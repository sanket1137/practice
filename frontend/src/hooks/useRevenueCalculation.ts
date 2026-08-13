import { useMemo } from 'react';

interface DaySchedule {
    startTime: string;
    endTime: string;
    isOperating: boolean;
}

interface OperatingSchedule {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

interface RevenueEstimate {
    perFrame: number;  // Revenue per complete time frame
    perHour: number;
    daily: Record<string, number>;
    weekly: number;
    monthly: number;
}

interface ScreenConfig {
    timeFrameMinutes: number;
    slotsPerFrame: number;
    pricePerSlot: number;
    schedule: OperatingSchedule;
}

const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

const calculateDailyRevenue = (
    schedule: DaySchedule,
    revenuePerFrame: number,
    timeFrameMinutes: number
): number => {
    if (!schedule.isOperating) return 0;

    let operatingMinutes =
        timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);

    // Handle midnight crossover (e.g., 23:00 to 01:00)
    if (operatingMinutes < 0) {
        operatingMinutes += 24 * 60;
    }

    // Number of complete frames in the day
    const framesPerDay = operatingMinutes / timeFrameMinutes;

    return revenuePerFrame * framesPerDay;
};

export const useRevenueCalculation = (
    config: ScreenConfig
): RevenueEstimate => {
    return useMemo(() => {
        const { timeFrameMinutes, slotsPerFrame, pricePerSlot, schedule } = config;

        // CORRECTION: Revenue per Cycle = Price per Slot * Number of ads per cycle
        // Previously (Incorrect): Price per slot per minute * time frame minutes
        const revenuePerFrame = pricePerSlot * slotsPerFrame;

        // Frames per hour (how many cycles fit in an hour)
        const framesPerHour = 60 / timeFrameMinutes;

        // Revenue per hour
        const revenuePerHour = framesPerHour * revenuePerFrame;

        const daily: Record<string, number> = {
            monday: calculateDailyRevenue(schedule.monday, revenuePerFrame, timeFrameMinutes),
            tuesday: calculateDailyRevenue(schedule.tuesday, revenuePerFrame, timeFrameMinutes),
            wednesday: calculateDailyRevenue(schedule.wednesday, revenuePerFrame, timeFrameMinutes),
            thursday: calculateDailyRevenue(schedule.thursday, revenuePerFrame, timeFrameMinutes),
            friday: calculateDailyRevenue(schedule.friday, revenuePerFrame, timeFrameMinutes),
            saturday: calculateDailyRevenue(schedule.saturday, revenuePerFrame, timeFrameMinutes),
            sunday: calculateDailyRevenue(schedule.sunday, revenuePerFrame, timeFrameMinutes),
        };

        const weekly = Object.values(daily).reduce((sum, val) => sum + val, 0);

        // CORRECTION: Monthly Revenue = Daily Revenue * 30
        // Use average daily revenue from weekly schedule
        const averageDailyRevenue = weekly / 7;
        const monthly = averageDailyRevenue * 30;

        return {
            perFrame: revenuePerFrame,
            perHour: revenuePerHour,
            daily,
            weekly,
            monthly,
        };
    }, [config]);
};
