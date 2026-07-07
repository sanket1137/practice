namespace CCMS.Domain.Enums;

/// <summary>
/// Coarse classification of a media library asset. Derived from MIME type
/// at finalize time; used for fast UI filtering ("show me all videos").
/// </summary>
public enum MediaAssetType
{
    Other = 0,
    Image = 1,
    Video = 2,
    Html = 3
}
