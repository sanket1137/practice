namespace CCMS.Domain.Enums;

/// <summary>
/// Every remote command the dashboard can send to a player. Some are CMS-only
/// (would corrupt DOOH billing if allowed); others work in both modes.
/// Mode restrictions are enforced by <c>RemoteCommandValidator.CanIssue</c>.
/// </summary>
public enum RemoteCommandType
{
    // Playback — CMS only (would corrupt DOOH billing)
    Play = 0,
    Pause = 1,
    Skip = 2,
    RestartLoop = 3,
    JumpTo = 4,
    SetItemDuration = 5,

    // Audio — both modes
    SetVolume = 10,
    Mute = 11,
    Unmute = 12,

    // Display — both modes
    Blackout = 20,
    SetBrightness = 21,
    DisplayOn = 22,
    DisplayOff = 23,
    SetOrientation = 24,

    // Content overlay — both modes
    PushAnnouncement = 30,

    // System — both modes
    Reboot = 40,
    PowerOff = 41,
    ForceSync = 42,
    ClearCache = 43,

    // Monitoring — both modes
    RequestScreenshot = 50,
    StartScreenShare = 51,
    StopScreenShare = 52,
    RunDiagnostics = 53,
}
