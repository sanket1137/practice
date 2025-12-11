using CCMS.Domain.Entities;
using CCMS.Domain.ValueObjects;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Services;

public class BookingCalculationService
{
    private readonly SlotAvailabilityService _availabilityService;

    public BookingCalculationService(SlotAvailabilityService availabilityService)
    {
        _availabilityService = availabilityService;
    }

    /// <summary>
    /// Get detailed breakdown of available vs unavailable dates for a booking request
    /// </summary>
    public async Task<BookingDateBreakdown> GetDateBreakdown(
        Guid screenId,
        int slotNumber,
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken = default)
    {
        var breakdown = new BookingDateBreakdown
        {
            TotalRequested = (int)(endDate.Date - startDate.Date).TotalDays + 1
        };

        var currentDate = startDate.Date;
        while (currentDate <= endDate.Date)
        {
            breakdown.RequestedDates.Add(currentDate);

            // Check if slot is available on this day
            var availableSlots = await _availabilityService.GetDayAvailableSlots(
                screenId,
                currentDate,
                cancellationToken);

            if (availableSlots.Contains(slotNumber))
            {
                breakdown.AvailableDates.Add(currentDate);
            }
            else
            {
                breakdown.UnavailableDates.Add(currentDate);
            }

            currentDate = currentDate.AddDays(1);
        }

        breakdown.TotalAvailable = breakdown.AvailableDates.Count;
        breakdown.TotalUnavailable = breakdown.UnavailableDates.Count;
        breakdown.IsPartialBooking = breakdown.TotalUnavailable > 0;

        return breakdown;
    }

    public BookingCalculation CalculateBooking(
        Screen screen, 
        DateTime startDate, 
        DateTime endDate)
    {
        var calculation = new BookingCalculation();
        var currentDate = startDate.Date;
        
        decimal totalOperatingMinutes = 0;
        decimal totalFrames = 0;
        
        // SLOT-BASED PRICING MODEL
        // Display time per slot (in minutes) - for informational purposes
        decimal displayTimePerSlot = (decimal)screen.TimeFrameMinutes / screen.SlotsPerFrame;
        
        // Cost per frame = Price per slot (ONE advertiser gets ONE slot per frame)
        // The advertiser pays the slot price once per complete cycle
        decimal costPerFrame = screen.PricePerSlot;
        
        while (currentDate <= endDate.Date)
        {
            var dayOfWeek = currentDate.DayOfWeek;
            var daySchedule = GetDaySchedule(screen.Schedule, dayOfWeek);
            
            if (daySchedule?.IsOperating == true)
            {
                var operatingMinutes = CalculateOperatingMinutes(daySchedule);
                var framesPerDay = (decimal)operatingMinutes / screen.TimeFrameMinutes;
                var costThisDay = framesPerDay * costPerFrame;
                
                calculation.DailyBreakdown.Add(new DailyCalculation
                {
                    Date = currentDate,
                    DayOfWeek = dayOfWeek.ToString(),
                    OperatingHours = (double)(operatingMinutes / 60m),
                    Frames = (int)framesPerDay,
                    CostPerFrame = costPerFrame,
                    Cost = costThisDay
                });
                
                totalOperatingMinutes += operatingMinutes;
                totalFrames += framesPerDay;
            }
            else
            {
                calculation.DailyBreakdown.Add(new DailyCalculation
                {
                    Date = currentDate,
                    DayOfWeek = dayOfWeek.ToString(),
                    OperatingHours = 0,
                    Frames = 0,
                    CostPerFrame = 0,
                    Cost = 0
                });
            }
            
            currentDate = currentDate.AddDays(1);
        }
        
        calculation.TotalDays = (int)(endDate.Date - startDate.Date).TotalDays + 1;
        calculation.OperatingDays = calculation.DailyBreakdown.Count(d => d.OperatingHours > 0);
        calculation.TotalOperatingMinutes = (int)totalOperatingMinutes;
        calculation.TotalFrames = (int)totalFrames;
        calculation.DisplayTimePerSlot = displayTimePerSlot;
        calculation.CostPerFrame = costPerFrame;
        calculation.TotalCost = totalFrames * costPerFrame;
        
        // For backward compatibility
        calculation.TotalExpectedImpressions = calculation.TotalFrames;
        
        return calculation;
    }

    /// <summary>
    /// Calculate booking cost with slot availability checking (RECOMMENDED - Accurate billing)
    /// Only charges for days where the assigned slot is actually available
    /// </summary>
    public async Task<BookingCalculation> CalculateBookingWithAvailability(
        Screen screen,
        int slotNumber,
        DateTime startDate,
        DateTime endDate,
        SlotAvailabilityService availabilityService,
        CancellationToken cancellationToken = default)
    {
        var calculation = new BookingCalculation();
        var currentDate = startDate.Date;
        
        decimal totalOperatingMinutes = 0;
        decimal totalFrames = 0;
        
        // SLOT-BASED PRICING MODEL
        // Display time per slot (in minutes) - for informational purposes
        decimal displayTimePerSlot = (decimal)screen.TimeFrameMinutes / screen.SlotsPerFrame;
        
        // Cost per frame = Price per slot (ONE advertiser gets ONE slot per frame)
        // The advertiser pays the slot price once per complete cycle
        decimal costPerFrame = screen.PricePerSlot;
        
        while (currentDate <= endDate.Date)
        {
            var dayOfWeek = currentDate.DayOfWeek;
            var daySchedule = GetDaySchedule(screen.Schedule, dayOfWeek);
            
            if (daySchedule?.IsOperating == true)
            {
                // NEW: Check if the specific slot is available on this day
                var availableSlots = await availabilityService.GetDayAvailableSlots(
                    screen.Id, 
                    currentDate, 
                    cancellationToken);
                
                bool isSlotAvailable = availableSlots.Contains(slotNumber);
                
                if (isSlotAvailable)
                {
                    // Slot is available - include in calculation
                    var operatingMinutes = CalculateOperatingMinutes(daySchedule);
                    var framesPerDay = (decimal)operatingMinutes / screen.TimeFrameMinutes;
                    var costThisDay = framesPerDay * costPerFrame;
                    
                    calculation.DailyBreakdown.Add(new DailyCalculation
                    {
                        Date = currentDate,
                        DayOfWeek = dayOfWeek.ToString(),
                        OperatingHours = (double)(operatingMinutes / 60m),
                        Frames = (int)framesPerDay,
                        CostPerFrame = costPerFrame,
                        Cost = costThisDay,
                        IsAvailable = true
                    });
                    
                    totalOperatingMinutes += operatingMinutes;
                    totalFrames += framesPerDay;
                }
                else
                {
                    // Slot is sold out - exclude from calculation
                    calculation.DailyBreakdown.Add(new DailyCalculation
                    {
                        Date = currentDate,
                        DayOfWeek = dayOfWeek.ToString(),
                        OperatingHours = 0,
                        Frames = 0,
                        CostPerFrame = 0,
                        Cost = 0,
                        IsAvailable = false,
                        Reason = "Sold Out"
                    });
                    
                    calculation.ExcludedDates.Add(currentDate);
                }
            }
            else
            {
                // Screen not operating
                calculation.DailyBreakdown.Add(new DailyCalculation
                {
                    Date = currentDate,
                    DayOfWeek = dayOfWeek.ToString(),
                    OperatingHours = 0,
                    Frames = 0,
                    CostPerFrame = 0,
                    Cost = 0,
                    IsAvailable = false,
                    Reason = "Not Operating"
                });
            }
            
            currentDate = currentDate.AddDays(1);
        }
        
        calculation.TotalDays = (int)(endDate.Date - startDate.Date).TotalDays + 1;
        calculation.OperatingDays = calculation.DailyBreakdown.Count(d => d.OperatingHours > 0 && d.IsAvailable);
        calculation.BookableDays = calculation.DailyBreakdown.Count(d => d.IsAvailable && d.Frames > 0);
        calculation.SoldOutDays = calculation.DailyBreakdown.Count(d => d.Reason == "Sold Out");
        calculation.TotalOperatingMinutes = (int)totalOperatingMinutes;
        calculation.TotalFrames = (int)totalFrames;
        calculation.DisplayTimePerSlot = displayTimePerSlot;
        calculation.CostPerFrame = costPerFrame;
        calculation.TotalCost = totalFrames * costPerFrame;  // Only charges for bookable days
        
        // For backward compatibility
        calculation.TotalExpectedImpressions = calculation.TotalFrames;
        
        return calculation;
    }
    
    private DaySchedule? GetDaySchedule(OperatingSchedule schedule, DayOfWeek dayOfWeek)
    {
        return dayOfWeek switch
        {
            DayOfWeek.Monday => schedule.Monday,
            DayOfWeek.Tuesday => schedule.Tuesday,
            DayOfWeek.Wednesday => schedule.Wednesday,
            DayOfWeek.Thursday => schedule.Thursday,
            DayOfWeek.Friday => schedule.Friday,
            DayOfWeek.Saturday => schedule.Saturday,
            DayOfWeek.Sunday => schedule.Sunday,
            _ => null
        };
    }
    
    private int CalculateOperatingMinutes(DaySchedule daySchedule)
    {
        return (int)(daySchedule.EndTime - daySchedule.StartTime).TotalMinutes;
    }
}

public class BookingCalculation
{
    public int TotalDays { get; set; }
    public int OperatingDays { get; set; }
    public int BookableDays { get; set; } // Days where assigned slot is available
    public int SoldOutDays { get; set; } // Days that are sold out
    public int TotalOperatingMinutes { get; set; }
    public int TotalFrames { get; set; }
    public decimal DisplayTimePerSlot { get; set; } // In minutes
    public decimal CostPerFrame { get; set; } // Cost per play
    public decimal TotalCost { get; set; }
    public List<DailyCalculation> DailyBreakdown { get; set; } = new();
    public List<DateTime> ExcludedDates { get; set; } = new(); // Dates excluded due to sold-out
    
    // For backward compatibility
    public int TotalExpectedImpressions { get; set; } // Same as TotalFrames
}

public class DailyCalculation
{
    public DateTime Date { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public double OperatingHours { get; set; }
    public int Frames { get; set; } // Number of plays this day
    public decimal CostPerFrame { get; set; }
    public decimal Cost { get; set; } // Cost for this day
    public bool IsAvailable { get; set; } = true; // Is slot available on this day
    public string? Reason { get; set; } // "Sold Out", "Not Operating", etc.
}
