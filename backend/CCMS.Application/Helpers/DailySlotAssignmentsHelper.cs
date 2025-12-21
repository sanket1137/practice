using System.Text.Json;

namespace CCMS.Application.Helpers;

/// <summary>
/// Helper class for standardizing DailySlotAssignments JSON format
/// Standard format: {"YYYY-MM-DD": [slotNumber1, slotNumber2, ...]}
/// </summary>
public static class DailySlotAssignmentsHelper
{
    private const string DateFormat = "yyyy-MM-dd";
    
    /// <summary>
    /// Create JSON string in standard format from dictionary
    /// </summary>
    public static string CreateJson(Dictionary<DateTime, List<int>> assignments)
    {
        var normalized = assignments.ToDictionary(
            kvp => kvp.Key.ToString(DateFormat),
            kvp => kvp.Value
        );
        return JsonSerializer.Serialize(normalized);
    }
    
    /// <summary>
    /// Parse JSON string to dictionary, handling legacy formats
    /// Supports:
    /// - Standard: {"2025-12-19": [1, 2]}
    /// - Legacy with timestamp: {"2025-12-19T00:00:00": [1]}
    /// - Legacy int values: {"2025-12-19": 1}
    /// </summary>
    public static Dictionary<DateTime, List<int>> ParseJson(string json)
    {
        if (string.IsNullOrEmpty(json))
            return new Dictionary<DateTime, List<int>>();
            
        try
        {
            // Try current format first (standard array format)
            var dict = JsonSerializer.Deserialize<Dictionary<string, List<int>>>(json);
            if (dict != null)
            {
                return dict.ToDictionary(
                    kvp => DateTime.ParseExact(kvp.Key.Substring(0, 10), DateFormat, null),
                    kvp => kvp.Value
                );
            }
        }
        catch
        {
            // Fallback for legacy int format
            try
            {
                var dictInt = JsonSerializer.Deserialize<Dictionary<string, int>>(json);
                if (dictInt != null)
                {
                    return dictInt.ToDictionary(
                        kvp => DateTime.ParseExact(kvp.Key.Substring(0, 10), DateFormat, null),
                        kvp => new List<int> { kvp.Value }
                    );
                }
            }
            catch
            {
                // Invalid JSON, return empty
                return new Dictionary<DateTime, List<int>>();
            }
        }
        
        return new Dictionary<DateTime, List<int>>();
    }
    
    /// <summary>
    /// Check if a specific slot is assigned on a specific date
    /// </summary>
    public static bool HasSlotOnDate(string json, DateTime date, int slotNumber)
    {
        var assignments = ParseJson(json);
        return assignments.TryGetValue(date.Date, out var slots) 
            && slots.Contains(slotNumber);
    }
    
    /// <summary>
    /// Get all slot numbers assigned for a specific date
    /// </summary>
    public static List<int> GetSlotsForDate(string json, DateTime date)
    {
        var assignments = ParseJson(json);
        return assignments.TryGetValue(date.Date, out var slots) 
            ? slots 
            : new List<int>();
    }
}
