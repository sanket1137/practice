namespace CCMS.Shared.DTOs.Creatives;

public class CreativeValidationDto
{
    public bool IsCompatible { get; set; }
    public CreativeRequirementsDto Requirements { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}

public class CreativeRequirementsDto
{
    public List<DimensionDto> SupportedSizes { get; set; } = new();
    public int MaxDuration { get; set; } // in seconds
}

public class DimensionDto
{
    public int Width { get; set; }
    public int Height { get; set; }
}
