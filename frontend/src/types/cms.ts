// CMS subsystem shared types (mirrors backend CCMS.Shared.DTOs.Cms.*)

export type AccountType = 'MediaOwner' | 'CmsOwner' | 'Advertiser';

export type CmsPlaylistType = 'Standard' | 'Shuffle' | 'Conditional';
export type CmsPlaylistItemType = 'Image' | 'Video' | 'Html5';

// Pairing -------------------------------------------------------------------

export interface PairingCodeResponse {
    code: string;
    expiresAt: string; // ISO
    qrPayload: string; // what the player scans (usually the raw code)
}

export interface PairingStatusResponse {
    code: string;
    isClaimed: boolean;
    screenId?: string;
    expiresAt: string;
}

export interface ClaimPairingCodeRequest {
    code: string;
    deviceFingerprint: string;
    deviceModel?: string;
    osVersion?: string;
    appVersion?: string;
}

export interface ClaimPairingCodeResponse {
    screenId: string;
    apiKey: string; // raw, shown once to the player
    screenName: string;
}

// Media ---------------------------------------------------------------------

export interface CheckSha256Request { sha256: string; }
export interface CheckSha256Response { exists: boolean; mediaAssetId?: string; }

export interface PresignUploadRequest {
    sha256: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
}

export interface PresignUploadResponse {
    mediaAssetId: string;
    uploadUrl: string;
    objectKey: string;
    expiresAt: string;
}

export interface FinalizeUploadRequest {
    mediaAssetId: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
}

export interface MediaAssetDto {
    id: string;
    ownerId: string;
    sha256: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    fileUrl: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    isReady: boolean;
    createdAt: string;
}

// Playlists -----------------------------------------------------------------

export interface CmsPlaylistItemDto {
    id: string;
    mediaAssetId: string;
    itemType: CmsPlaylistItemType;
    order: number;
    durationSeconds?: number;
    mediaAsset?: MediaAssetDto;
}

export interface CmsPlaylistDto {
    id: string;
    screenId: string;
    name: string;
    playlistType: CmsPlaylistType;
    version: number;
    isDefault: boolean;
    lastPublishedAt?: string;
    items: CmsPlaylistItemDto[];
    createdAt: string;
    updatedAt?: string;
}

export interface CreateCmsPlaylistRequest {
    screenId: string;
    name: string;
    playlistType: CmsPlaylistType;
}

export interface UpdateCmsPlaylistRequest {
    name: string;
    playlistType: CmsPlaylistType;
}

export interface PlaylistItemInput {
    mediaAssetId: string;
    itemType: CmsPlaylistItemType;
    durationSeconds?: number;
}

export interface ReplacePlaylistItemsRequest {
    expectedVersion: number;
    items: PlaylistItemInput[];
}

// Remote commands -----------------------------------------------------------

export type RemoteCommandType =
    | 'Reboot' | 'Restart' | 'UpdateApp' | 'ClearCache'
    | 'Play' | 'Pause' | 'Skip' | 'RestartLoop' | 'JumpTo' | 'SetItemDuration'
    | 'SetVolume' | 'Mute' | 'Unmute'
    | 'TakeScreenshot' | 'PushLogs' | 'RefreshContent'
    | 'SetBrightness' | 'SetOrientation'
    | 'ShowMessage' | 'PushAnnouncement' | 'Custom';

export type RemoteCommandStatus = 'Pending' | 'Sent' | 'Acked' | 'Failed' | 'Expired';

export interface IssueRemoteCommandRequest {
    screenId: string;
    commandType: RemoteCommandType;
    payload?: unknown;
}

export interface RemoteCommandDto {
    id: string;
    screenId: string;
    commandType: RemoteCommandType;
    payloadJson?: string;
    status: RemoteCommandStatus;
    issuedAt: string;
    dispatchedAt?: string;
    ackedAt?: string;
    errorMessage?: string;
}

// Bulk commands ----------------------------------------------------------------

export interface BulkIssueRemoteCommandRequest {
    screenIds: string[];
    commandType: string;
    payload?: unknown;
}

// Screen health ---------------------------------------------------------------

export type ScreenHealthStatus = 'online' | 'stale' | 'offline';

export interface ScreenHealthDto {
    screenId: string;
    name: string;
    status: ScreenHealthStatus;
    lastSeenAt?: string;
    currentPlaylistName?: string;
    currentPlaylistId?: string;
    locationTag?: string;
    autoApprovalEnabled: boolean;
}

// Schedule windows ------------------------------------------------------------

export interface ScheduleWindowDto {
    id: string;
    screenId: string;
    playlistId: string;
    playlistName?: string;
    daysOfWeekMask: number;
    startMinute: number;
    endMinute: number;
    isActive: boolean;
    label?: string;
}

export interface CreateScheduleWindowRequest {
    playlistId: string;
    daysOfWeekMask: number;
    startMinute: number;
    endMinute: number;
    isActive: boolean;
    label?: string;
}

export interface UpdateScheduleWindowRequest {
    playlistId?: string;
    daysOfWeekMask?: number;
    startMinute?: number;
    endMinute?: number;
    isActive?: boolean;
    label?: string;
}

// Screen groups ---------------------------------------------------------------

export interface ScreenGroupDto {
    id: string;
    name: string;
    description?: string;
    screenIds: string[];
    memberCount: number;
    createdAt: string;
}

export interface CreateScreenGroupRequest {
    name: string;
    description?: string;
    screenIds: string[];
}

export interface UpdateScreenGroupRequest {
    name?: string;
    description?: string;
}
