using System.Text.Json;

namespace CCMS.Application.Helpers;

/// <summary>
/// Helper class for standardizing DailySlotAssignments JSON format
/// Standard format: {"yyyy-MM-dd": [slotNumber1, slotNumber2, ...]}
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
    /// Parse JSON string to dictionary, handling ALL legacy formats
    /// Supports:
    /// - Standard: {"2025-12-19": [1, 2]}
    /// - Legacy with timestamp: {"2025-12-19T00:00:00": [1]}
    /// - Legacy int values: {"2025-12-19": 1}
    /// - Legacy with timestamp and int: {"2025-12-19T00:00:00": 2}
    /// </summary>
    public static Dictionary<DateTime, List<int>> ParseJson(string? json)
    {
        if (string.IsNullOrEmpty(json))
            return new Dictionary<DateTime, List<int>>();
            
        try
        {
            using var doc = JsonDocument.Parse(json);
            var result = new Dictionary<DateTime, List<int>>();
            
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var date = ParseDateKey(prop.Name);
                var slots = new List<int>();
                
                // Handle both array and single value
                if (prop.Value.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in prop.Value.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.Number)
                        {
                            slots.Add(item.GetInt32());
                        }
                    }
                }
                else if (prop.Value.ValueKind == JsonValueKind.Number)
                {
                    slots.Add(prop.Value.GetInt32());
                }
                
                if (slots.Any())
                {
                    result[date] = slots;
                }
            }
            
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WARN] Failed to parse DailySlotAssignmentsJson: {ex.Message}. JSON: {json}");
            return new Dictionary<DateTime, List<int>>();
        }
    }
    
    /// <summary>
    /// Parse date key, handling formats with or without timestamp
    /// Supports: "2025-12-19" and "2025-12-19T00:00:00"
    /// </summary>
    private static DateTime ParseDateKey(string key)
    {
        // Extract first 10 chars (yyyy-MM-dd)
        var dateStr = key.Length >= 10 ? key.Substring(0, 10) : key;
        
        if (DateTime.TryParseExact(dateStr, DateFormat, null, System.Globalization.DateTimeStyles.None, out var date))
        {
            return date.Date;
        }
        
        // Fallback to general parsing
        if (DateTime.TryParse(key, out var parsed))
        {
            return parsed.Date;
        }
        
        throw new FormatException($"Invalid date key format: '{key}'. Expected 'yyyy-MM-dd' or 'yyyy-MM-ddTHH:mm:ss'");
    }
    
    /// <summary>
    /// Check if a specific slot is assigned on a specific date
    /// </summary>
    public static bool HasSlotOnDate(string? json, DateTime date, int slotNumber)
    {
        var assignments = ParseJson(json);
        return assignments.TryGetValue(date.Date, out var slots) 
            && slots.Contains(slotNumber);
    }
    
    /// <summary>
    /// Get all slot numbers assigned for a specific date
    /// </summary>
    public static List<int> GetSlotsForDate(string? json, DateTime date)
    {
        var assignments = ParseJson(json);
        return assignments.TryGetValue(date.Date, out var slots) 
            ? slots 
            : new List<int>();
    }
    
    /// <summary>
    /// Normalize JSON to standard format (convert legacy formats)
    /// </summary>
    public static string NormalizeJson(string? json)
    {
        var parsed = ParseJson(json);
        return CreateJson(parsed);
    }
    
    /// <summary>
    /// Validate JSON format and return validation errors
    /// </summary>
    public static List<string> ValidateJson(string? json)
    {
        var errors = new List<string>();
        
        if (string.IsNullOrWhiteSpace(json))
        {
            return errors; // Empty is valid
        }
        
        try
        {
            using var doc = JsonDocument.Parse(json);
            
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                // Check date format
                try
                {
                    ParseDateKey(prop.Name);
                }
                catch (FormatException ex)
                {
                    errors.Add(ex.Message);
                }
                
                // Check value type
                if (prop.Value.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in prop.Value.EnumerateArray())
                    {
                        if (item.ValueKind != JsonValueKind.Number)
                        {
                            errors.Add($"Array item in '{prop.Name}' is not a number");
                        }
                    }
                }
                else if (prop.Value.ValueKind != JsonValueKind.Number)
                {
                    errors.Add($"Value for '{prop.Name}' must be number or array of numbers");
                }
            }
        }
        catch (JsonException ex)
        {
            errors.Add($"Invalid JSON: {ex.Message}");
        }
        
        return errors;
    }
}
