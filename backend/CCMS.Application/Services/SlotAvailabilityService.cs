using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;

namespace CCMS.Application.Services;

public class SlotAvailabilityService
{
    private readonly IRepository<SlotAvailability> _slotAvailabilityRepo;
    private readonly IRepository<Screen> _screenRepo;
    private readonly IUnitOfWork _unitOfWork;

    public SlotAvailabilityService(
        IRepository<SlotAvailability> slotAvailabilityRepo,
        IRepository<Screen> screenRepo,
        IUnitOfWork unitOfWork)
    {
        _slotAvailabilityRepo = slotAvailabilityRepo;
        _screenRepo = screenRepo;
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Ensures DateTime is specified as UTC for PostgreSQL compatibility
    /// </summary>
    private static DateTime EnsureUtc(DateTime date)
    {
        return DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
    }

    /// <summary>
    /// Initialize slot availability records for a date range
    /// </summary>
    public async Task InitializeSlotAvailability(Guid screenId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var screen = await _screenRepo.GetByIdAsync(screenId, cancellationToken);
        if (screen == null)
            throw new KeyNotFoundException("Screen not found");

        var currentDate = EnsureUtc(startDate);
        var end = EnsureUtc(endDate);

        while (currentDate <= end)
        {
            // Check if record already exists
            var existing = await _slotAvailabilityRepo
                .FindAsync(sa => sa.ScreenId == screenId && sa.Date == currentDate, cancellationToken);

            if (!existing.Any())
            {
                var slotAvailability = new SlotAvailability
                {
                    ScreenId = screenId,
                    Date = currentDate,
                    TotalSlots = screen.SlotsPerFrame,
                    BookedSlots = 0,
                    SlotBookings = new Dictionary<int, Guid?>(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _slotAvailabilityRepo.AddAsync(slotAvailability, cancellationToken);
            }

            currentDate = currentDate.AddDays(1);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Check if a specific slot is available across entire date range
    /// </summary>
    public async Task<bool> IsSlotAvailable(Guid screenId, int slotNumber, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        // Ensure records exist for the date range
        await InitializeSlotAvailability(screenId, startDate, endDate, cancellationToken);

        var currentDate = EnsureUtc(startDate);
        var end = EnsureUtc(endDate);

        while (currentDate <= end)
        {
            var availability = await _slotAvailabilityRepo
                .FindAsync(sa => sa.ScreenId == screenId && sa.Date == currentDate, cancellationToken);

            var dayAvailability = availability.FirstOrDefault();
            if (dayAvailability == null)
                return false; // No availability record exists
            
            // Slot is booked if SlotBookings contains the key AND the value is not null
            if (dayAvailability.SlotBookings.ContainsKey(slotNumber) && dayAvailability.SlotBookings[slotNumber] != null)
            {
                return false; // Slot is booked on this date
            }

            currentDate = currentDate.AddDays(1);
        }

        return true;
    }

    /// <summary>
    /// Get availability for a specific day (used for booking calculation)
    /// </summary>
    public async Task<List<int>> GetDayAvailableSlots(Guid screenId, DateTime date, CancellationToken cancellationToken = default)
    {
        var utcDate = EnsureUtc(date);
        await InitializeSlotAvailability(screenId, utcDate, utcDate, cancellationToken);
        
        var availability = await _slotAvailabilityRepo
            .FindAsync(sa => sa.ScreenId == screenId && sa.Date == utcDate, cancellationToken);
        
        var dayAvailability = availability.FirstOrDefault();
        if (dayAvailability == null)
        {
            Console.WriteLine($"[SLOT DEBUG] No availability record found for screen {screenId} on {date:yyyy-MM-dd} after initialization!");
            return new List<int>();
        }
        
        Console.WriteLine($"[SLOT DEBUG] Screen {screenId.ToString().Substring(0,8)} on {date:yyyy-MM-dd}: TotalSlots={dayAvailability.TotalSlots}, BookedSlots={dayAvailability.BookedSlots}, SlotBookings.Count={dayAvailability.SlotBookings.Count}");
        Console.WriteLine($"[SLOT DEBUG] SlotBookings details: {string.Join(", ", dayAvailability.SlotBookings.Select(kvp => $"{kvp.Key}={kvp.Value?.ToString()?.Substring(0,8) ?? "null"}"))}");

        
        var availableSlotNumbers = new List<int>();
        for (int i = 1; i <= dayAvailability.TotalSlots; i++)
        {
            if (!dayAvailability.SlotBookings.ContainsKey(i) || 
                dayAvailability.SlotBookings[i] == null)
            {
                availableSlotNumbers.Add(i);
            }
        }
        
        Console.WriteLine($"[SLOT DEBUG] Available slots: [{string.Join(", ", availableSlotNumbers)}]");
        
        return availableSlotNumbers;
    }

    /// <summary>
    /// Find the first available slot across the entire date range
    /// </summary>
    public async Task<int?> FindAvailableSlot(Guid screenId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var screen = await _screenRepo.GetByIdAsync(screenId, cancellationToken);
        if (screen == null)
            return null;

        // Try each slot number (1 to SlotsPerFrame)
        for (int slotNum = 1; slotNum <= screen.SlotsPerFrame; slotNum++)
        {
            if (await IsSlotAvailable(screenId, slotNum, startDate, endDate, cancellationToken))
            {
                return slotNum;
            }
        }

        return null; // No available slot found
    }

    /// <summary>
    /// Find a slot that's available on at least ONE day in the range (allows partial bookings)
    /// </summary>
    public async Task<int?> FindPartiallyAvailableSlot(Guid screenId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var screen = await _screenRepo.GetByIdAsync(screenId, cancellationToken);
        if (screen == null)
            return null;

        // Try each slot number (1 to SlotsPerFrame)
        for (int slotNum = 1; slotNum <= screen.SlotsPerFrame; slotNum++)
        {
            // Check if this slot is available on AT LEAST ONE day
            var currentDate = EnsureUtc(startDate);
            var end = EnsureUtc(endDate);
            
            while (currentDate <= end)
            {
                var availableSlots = await GetDayAvailableSlots(screenId, currentDate, cancellationToken);
                if (availableSlots.Contains(slotNum))
                {
                    // Found at least one day where this slot is available
                    return slotNum;
                }
                currentDate = currentDate.AddDays(1);
            }
        }

        return null; // No slot available on any day
    }

    /// <summary>
    /// Book a slot for a booking across a date range (skips days where slot is already booked)
    /// </summary>
    public async Task BookSlot(Guid screenId, int slotNumber, Guid bookingId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        // Ensure records exist
        await InitializeSlotAvailability(screenId, startDate, endDate, cancellationToken);

        var currentDate = EnsureUtc(startDate);
        var end = EnsureUtc(endDate);
        int daysBooked = 0;
        var bookedDates = new List<DateTime>();  // Track booked dates for logging

        while (currentDate <= end)
        {
            var availability = await _slotAvailabilityRepo
                .FindAsync(sa => sa.ScreenId == screenId && sa.Date == currentDate, cancellationToken);

            var dayAvailability = availability.FirstOrDefault();
            if (dayAvailability != null)
            {
                // Check if slot is available: either not in dictionary OR value is null
                if (!dayAvailability.SlotBookings.ContainsKey(slotNumber) || 
                    dayAvailability.SlotBookings[slotNumber] == null)
                {
                    // Slot is available - book it
                    dayAvailability.SlotBookings[slotNumber] = bookingId;
                    dayAvailability.BookedSlots++;
                    dayAvailability.UpdatedAt = DateTime.UtcNow;

                    await _slotAvailabilityRepo.UpdateAsync(dayAvailability, cancellationToken);
                    daysBooked++;
                    bookedDates.Add(currentDate);  // Track this booked date
                }
                // else: Slot already booked, skip this day (allows partial bookings)
            }

            currentDate = currentDate.AddDays(1);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Log booked dates for debugging
        Console.WriteLine($"[BookSlot] Booking {bookingId}: Reserved slot {slotNumber} on {daysBooked} days: {string.Join(", ", bookedDates.Select(d => d.ToString("yyyy-MM-dd")))}");

        // Ensure at least one day was booked
        if (daysBooked == 0)
        {
            throw new InvalidOperationException($"Slot {slotNumber} is already fully booked for the entire date range.");
        }
    }

    /// <summary>
    /// Book slots with per-day assignment (finds best available slot for each day)
    /// This solves the overlapping booking issue where one booking takes a slot on specific   days
    /// </summary>
    public async Task<Dictionary<DateTime, int>> BookWithDailyAssignment(
        Guid screenId, 
        Guid bookingId, 
        DateTime startDate, 
        DateTime endDate, 
        CancellationToken cancellationToken = default)
    {
        await InitializeSlotAvailability(screenId, startDate, endDate, cancellationToken);

        var dailyAssignments = new Dictionary<DateTime, int>();
        var currentDate = EnsureUtc(startDate);
        var end = EnsureUtc(endDate);

        while (currentDate <= end)
        {
            // Get available slots for THIS specific day
            var availableSlots = await GetDayAvailableSlots (screenId, currentDate, cancellationToken);

            if (!availableSlots.Any())
            {
                // No slots available on this date – skip it for partial booking
                // Continue to next date (increment handled at loop end)
                currentDate = currentDate.AddDays(1);
                continue;
            }

            // Take the first available slot
            var slotToUse = availableSlots.First();

            // Get the day's availability record
            var availability = await _slotAvailabilityRepo
                .FindAsync(sa => sa.ScreenId == screenId && sa.Date == currentDate, cancellationToken);

            var dayAvailability = availability.FirstOrDefault();
            if (dayAvailability != null)
            {
                // Book this slot for this day
                dayAvailability.SlotBookings[slotToUse] = bookingId;
                dayAvailability.BookedSlots++;
                dayAvailability.UpdatedAt = DateTime.UtcNow;

                await _slotAvailabilityRepo.UpdateAsync(dayAvailability, cancellationToken);
                
                // Record the assignment
                dailyAssignments[currentDate] = slotToUse;
            }

            currentDate = currentDate.AddDays(1);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Log for debugging
        Console.WriteLine($"[BookWithDailyAssignment] Booking {bookingId}: Assigned slots per day:");
        foreach (var assignment in dailyAssignments)
        {
            Console.WriteLine($"  {assignment.Key:yyyy-MM-dd} → Slot {assignment.Value}");
        }

        return dailyAssignments;
    }

    /// <summary>
    /// Release a slot when booking is cancelled
    /// </summary>
    public async Task ReleaseSlot(Guid screenId, int slotNumber, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var currentDate = EnsureUtc(startDate);
        var end = EnsureUtc(endDate);

        while (currentDate <= end)
        {
            var availability = await _slotAvailabilityRepo
                .FindAsync(sa => sa.ScreenId == screenId && sa.Date == currentDate, cancellationToken);

            var dayAvailability = availability.FirstOrDefault();
            if (dayAvailability != null && dayAvailability.SlotBookings.ContainsKey(slotNumber))
            {
                dayAvailability.SlotBookings.Remove(slotNumber);
                dayAvailability.BookedSlots = Math.Max(0, dayAvailability.BookedSlots - 1);
                dayAvailability.UpdatedAt = DateTime.UtcNow;

                await _slotAvailabilityRepo.UpdateAsync(dayAvailability, cancellationToken);
            }

            currentDate = currentDate.AddDays(1);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Unbook all slots for a specific booking (used when booking is rejected/cancelled)
    /// </summary>
    public async Task UnbookSlot(Guid bookingId, CancellationToken cancellationToken = default)
    {
        // Find all slot availability records that have this booking
        var allAvailability = await _slotAvailabilityRepo
            .FindAsync(sa => sa.SlotBookings.Values.Contains(bookingId), cancellationToken);

        foreach (var dayAvailability in allAvailability)
        {
            // Find and remove all slots booked by this booking
            var slotsToRemove = dayAvailability.SlotBookings
                .Where(kvp => kvp.Value == bookingId)
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var slotNum in slotsToRemove)
            {
                dayAvailability.SlotBookings.Remove(slotNum);
                dayAvailability.BookedSlots = Math.Max(0, dayAvailability.BookedSlots - 1);
            }

            dayAvailability.UpdatedAt = DateTime.UtcNow;
            await _slotAvailabilityRepo.UpdateAsync(dayAvailability, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Get availability summary for a date range
    /// </summary>
    public async Task<List<DailyAvailability>> GetAvailability(Guid screenId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        // Ensure records exist
        await InitializeSlotAvailability(screenId, startDate, endDate, cancellationToken);

        var result = new List<DailyAvailability>();
        var currentDate = EnsureUtc(startDate);
        var end = EnsureUtc(endDate);

        while (currentDate <= end)
        {
            var availability = await _slotAvailabilityRepo
                .FindAsync(sa => sa.ScreenId == screenId && sa.Date == currentDate, cancellationToken);

            var dayAvailability = availability.FirstOrDefault();
            if (dayAvailability != null)
            {
                // Determine available slot numbers
                var availableSlots = new List<int>();
                for (int i = 1; i <= dayAvailability.TotalSlots; i++)
                {
                    // Check if slot is available: either not in dictionary OR value is null
                    if (!dayAvailability.SlotBookings.ContainsKey(i) || 
                        dayAvailability.SlotBookings[i] == null)
                    {
                        availableSlots.Add(i);
                    }
                }

                // Determine status
                string status;
                if (dayAvailability.AvailableSlots == 0)
                    status = "SOLD_OUT";
                else if (dayAvailability.AvailableSlots >= 5)
                    status = "AVAILABLE";
                else
                    status = "LIMITED";

                result.Add(new DailyAvailability
                {
                    Date = currentDate,
                    DayOfWeek = currentDate.DayOfWeek.ToString(),
                    TotalSlots = dayAvailability.TotalSlots,
                    AvailableSlots = dayAvailability.AvailableSlots,
                    AvailableSlotNumbers = availableSlots,
                    Status = status
                });
            }

            currentDate = currentDate.AddDays(1);
        }

        return result;
    }
}

public class DailyAvailability
{
    public DateTime Date { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public int TotalSlots { get; set; }
    public int AvailableSlots { get; set; }
    public List<int> AvailableSlotNumbers { get; set; } = new();
    public string Status { get; set; } = string.Empty;
}
