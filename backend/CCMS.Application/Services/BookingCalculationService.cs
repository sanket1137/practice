using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.Interfaces;
using CCMS.Domain.ValueObjects;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Services;

public class BookingCalculationService
{
    private readonly SlotAvailabilityService _availabilityService;
    private readonly IRepository<PricingRule> _pricingRuleRepository;

    public BookingCalculationService(
        SlotAvailabilityService availabilityService,
        IRepository<PricingRule> pricingRuleRepository)
    {
        _availabilityService = availabilityService;
        _pricingRuleRepository = pricingRuleRepository;
    }

    // ── Pricing engine ──────────────────────────────────────────────────────
    // The one pipeline every quote goes through. Owners' PricingRules were
    // previously stored and displayed but never referenced by any price
    // calculation — a rule could say "₹1600 on weekends" and every weekend
    // still quoted the base price. Resolution per day:
    //   SpecificDate beats DateRange beats Weekday (most specific wins);
    //   among matching rules of the same type, the highest price wins
    //   (owner intent for peak days). Festive pricing rides this same
    //   mechanism — the festive page materializes calendar entries into
    //   DateRange rules.

    private async Task<List<PricingRule>> LoadActiveRulesAsync(Guid screenId, CancellationToken ct)
    {
        var rules = await _pricingRuleRepository.FindAsync(
            r => r.ScreenId == screenId && r.IsActive && !r.IsDeleted, ct);
        return rules.ToList();
    }

    private static (decimal Price, string? RuleName) ResolveDayPrice(
        DateTime date, decimal basePrice, IReadOnlyList<PricingRule> rules)
    {
        var day = DateOnly.FromDateTime(date);
        var dayNumber = ((int)date.DayOfWeek).ToString(); // 0=Sunday … 6=Saturday

        foreach (var type in new[] { PricingRuleType.SpecificDate, PricingRuleType.DateRange, PricingRuleType.Weekday })
        {
            PricingRule? best = null;
            foreach (var rule in rules)
            {
                if (rule.RuleType != type || rule.RegularSlotPrice is not > 0) continue;

                var matches = type switch
                {
                    PricingRuleType.SpecificDate => rule.StartDate == day,
                    PricingRuleType.DateRange => rule.StartDate <= day && day <= (rule.EndDate ?? rule.StartDate),
                    PricingRuleType.Weekday => (rule.DaysOfWeek ?? string.Empty)
                        .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                        .Contains(dayNumber),
                    _ => false,
                };

                if (matches && (best == null || rule.RegularSlotPrice > best.RegularSlotPrice))
                    best = rule;
            }
            if (best != null)
                return (best.RegularSlotPrice!.Value, best.Name);
        }

        return (basePrice, null);
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
            breakdown.RequestedDates.Add(currentDate.ToString("yyyy-MM-dd"));

            // Check if slot is available on this day
            var availableSlots = await _availabilityService.GetDayAvailableSlots(
                screenId,
                currentDate,
                cancellationToken);

            if (availableSlots.Contains(slotNumber))
            {
                breakdown.AvailableDates.Add(currentDate.ToString("yyyy-MM-dd"));
            }
            else
            {
                breakdown.UnavailableDates.Add(currentDate.ToString("yyyy-MM-dd"));
            }

            currentDate = currentDate.AddDays(1);
        }

        breakdown.TotalAvailable = breakdown.AvailableDates.Count;
        breakdown.TotalUnavailable = breakdown.UnavailableDates.Count;
        // Only partial if some REQUESTED days couldn't be booked
        breakdown.IsPartialBooking = breakdown.AvailableDates.Count < breakdown.TotalRequested;

        return breakdown;
    }

    // NOTE: the old synchronous CalculateBooking(screen, start, end) was removed
    // deliberately: it had no callers and could not load pricing rules, so any
    // future caller would have silently quoted rule-blind prices. All quoting
    // goes through CalculateBookingWithAvailability.

    /// <summary>
    /// Calculate booking cost with slot availability checking (RECOMMENDED - Accurate billing)
    /// Only charges for days where the assigned slot is actually available.
    /// Prices each day through the pricing engine (screen rules + festive rules).
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
        decimal totalCost = 0;

        // SLOT-BASED PRICING MODEL
        // Display time per slot (in minutes) - for informational purposes
        decimal displayTimePerSlot = (decimal)screen.TimeFrameMinutes / screen.SlotsPerFrame;

        // Per-day slot price = base price run through the pricing engine.
        var rules = await LoadActiveRulesAsync(screen.Id, cancellationToken);
        calculation.BasePricePerSlot = screen.PricePerSlot;

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
                    var (dayPrice, ruleName) = ResolveDayPrice(currentDate, screen.PricePerSlot, rules);
                    var operatingMinutes = CalculateOperatingMinutes(daySchedule);
                    var framesPerDay = (decimal)operatingMinutes / screen.TimeFrameMinutes;
                    var costThisDay = framesPerDay * dayPrice;

                    calculation.DailyBreakdown.Add(new DailyCalculation
                    {
                        Date = currentDate,
                        DayOfWeek = dayOfWeek.ToString(),
                        OperatingHours = (double)(operatingMinutes / 60m),
                        Frames = (int)framesPerDay,
                        CostPerFrame = dayPrice,
                        Cost = costThisDay,
                        IsAvailable = true,
                        AppliedRule = ruleName
                    });

                    totalOperatingMinutes += operatingMinutes;
                    totalFrames += framesPerDay;
                    totalCost += costThisDay;
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
        calculation.CostPerFrame = screen.PricePerSlot; // base price; per-day prices live in DailyBreakdown
        calculation.TotalCost = totalCost; // sum of per-day costs (rule-aware), bookable days only

        // Aggregate which rules changed the price and by how much, so both the
        // advertiser's quote and the owner's rule editor can show the arithmetic.
        calculation.PriceAdjustments = calculation.DailyBreakdown
            .Where(d => d.AppliedRule != null && d.Frames > 0)
            .GroupBy(d => new { d.AppliedRule, d.CostPerFrame })
            .Select(g => new PriceAdjustmentSummary
            {
                RuleName = g.Key.AppliedRule!,
                PricePerSlot = g.Key.CostPerFrame,
                Days = g.Count(),
                Delta = g.Sum(d => d.Cost - d.Frames * screen.PricePerSlot),
            })
            .OrderByDescending(a => Math.Abs(a.Delta))
            .ToList();

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

    /// <summary>The screen's base price per slot, before any rule applied.</summary>
    public decimal BasePricePerSlot { get; set; }

    /// <summary>Which pricing rules changed this quote, and by how much — the visible arithmetic.</summary>
    public List<PriceAdjustmentSummary> PriceAdjustments { get; set; } = new();

    // For backward compatibility
    public int TotalExpectedImpressions { get; set; } // Same as TotalFrames
}

public class PriceAdjustmentSummary
{
    public string RuleName { get; set; } = string.Empty;
    public decimal PricePerSlot { get; set; }
    public int Days { get; set; }
    /// <summary>Total cost change vs base price across the affected days (positive = premium).</summary>
    public decimal Delta { get; set; }
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
    /// <summary>Name of the pricing rule that set this day's price; null when base price applied.</summary>
    public string? AppliedRule { get; set; }
}
