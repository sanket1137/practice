namespace CCMS.Domain.Enums;

public enum PlaylistType
{
    Standard = 0,   // Sequential playback, loops
    Shuffle = 1,    // Randomized order each loop
    Conditional = 2 // Items play based on time/day/weather rules (Phase C)
}
