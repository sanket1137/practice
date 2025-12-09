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
    perMinute: number;
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
    revenuePerMinute: number
): number => {
    if (!schedule.isOperating) return 0;

    let operatingMinutes =
        timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);

    // Handle midnight crossover (e.g., 23:00 to 01:00)
    if (operatingMinutes < 0) {
        operatingMinutes += 24 * 60;
    }

    return revenuePerMinute * operatingMinutes;
};

export const useRevenueCalculation = (
    config: ScreenConfig
): RevenueEstimate => {
    return useMemo(() => {
        const { timeFrameMinutes, slotsPerFrame, pricePerSlot, schedule } = config;

        const revenuePerMinute = slotsPerFrame * pricePerSlot;
        const revenuePerHour = revenuePerMinute * 60;

        const daily: Record<string, number> = {
            monday: calculateDailyRevenue(schedule.monday, revenuePerMinute),
            tuesday: calculateDailyRevenue(schedule.tuesday, revenuePerMinute),
            wednesday: calculateDailyRevenue(schedule.wednesday, revenuePerMinute),
            thursday: calculateDailyRevenue(schedule.thursday, revenuePerMinute),
            friday: calculateDailyRevenue(schedule.friday, revenuePerMinute),
            saturday: calculateDailyRevenue(schedule.saturday, revenuePerMinute),
            sunday: calculateDailyRevenue(schedule.sunday, revenuePerMinute),
        };

        const weekly = Object.values(daily).reduce((sum, val) => sum + val, 0);
        const monthly = weekly * 4.33; // Average weeks per month

        return {
            perMinute: revenuePerMinute,
            perHour: revenuePerHour,
            daily,
            weekly,
            monthly,
        };
    }, [config]);
};
