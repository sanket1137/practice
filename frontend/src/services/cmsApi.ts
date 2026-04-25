import { api } from './api';
import type {
    PairingCodeResponse,
    PairingStatusResponse,
    CheckSha256Request,
    CheckSha256Response,
    PresignUploadRequest,
    PresignUploadResponse,
    FinalizeUploadRequest,
    MediaAssetDto,
    CmsPlaylistDto,
    CreateCmsPlaylistRequest,
    UpdateCmsPlaylistRequest,
    ReplacePlaylistItemsRequest,
    IssueRemoteCommandRequest,
    RemoteCommandDto,
} from '../types/cms';

// API envelope from backend: { success, data, message, errors }
interface Envelope<T> { success: boolean; data: T; message?: string; errors?: string[]; }
interface Paged<T> { items: T[]; totalCount: number; pageNumber: number; pageSize: number; totalPages: number; }

const unwrap = <T,>(res: { data: Envelope<T> }) => res.data.data;

// ---- Pairing ----
export const cmsPairingApi = {
    generate: () => api.post<Envelope<PairingCodeResponse>>('/cms/pairing/generate').then(unwrap),
    status: (code: string) => api.get<Envelope<PairingStatusResponse>>(`/cms/pairing/status/${code}`).then(unwrap),
};

// ---- Media ----
export const cmsMediaApi = {
    checkSha256: (body: CheckSha256Request) =>
        api.post<Envelope<CheckSha256Response>>('/cms/media/check-sha256', body).then(unwrap),
    presignUpload: (body: PresignUploadRequest) =>
        api.post<Envelope<PresignUploadResponse>>('/cms/media/presign-upload', body).then(unwrap),
    finalize: (body: FinalizeUploadRequest) =>
        api.post<Envelope<MediaAssetDto>>('/cms/media/finalize', body).then(unwrap),
    list: (page = 1, pageSize = 24) =>
        api.get<Envelope<Paged<MediaAssetDto>>>(`/cms/media?page=${page}&pageSize=${pageSize}`).then(unwrap),
    delete: (id: string) => api.delete<Envelope<boolean>>(`/cms/media/${id}`).then(unwrap),
};

// ---- Playlists ----
export const cmsPlaylistApi = {
    listForScreen: (screenId: string) =>
        api.get<Envelope<CmsPlaylistDto[]>>(`/cms/playlists/by-screen/${screenId}`).then(unwrap),
    get: (id: string) => api.get<Envelope<CmsPlaylistDto>>(`/cms/playlists/${id}`).then(unwrap),
    create: (body: CreateCmsPlaylistRequest) =>
        api.post<Envelope<CmsPlaylistDto>>('/cms/playlists', body).then(unwrap),
    update: (id: string, body: UpdateCmsPlaylistRequest) =>
        api.put<Envelope<CmsPlaylistDto>>(`/cms/playlists/${id}`, body).then(unwrap),
    replaceItems: (id: string, body: ReplacePlaylistItemsRequest) =>
        api.put<Envelope<CmsPlaylistDto>>(`/cms/playlists/${id}/items`, body).then(unwrap),
    delete: (id: string) => api.delete<Envelope<boolean>>(`/cms/playlists/${id}`).then(unwrap),
    setDefault: (id: string, screenId: string) =>
        api.post<Envelope<boolean>>(`/cms/playlists/${id}/set-default?screenId=${screenId}`).then(unwrap),
};

// ---- Remote commands ----
export const cmsCommandsApi = {
    issue: (body: IssueRemoteCommandRequest) =>
        api.post<Envelope<RemoteCommandDto>>('/cms/commands', body).then(unwrap),
    recent: (screenId: string, limit = 50) =>
        api.get<Envelope<RemoteCommandDto[]>>(`/cms/commands/by-screen/${screenId}?limit=${limit}`).then(unwrap),
};

// ---- Helper: SHA-256 of a File via SubtleCrypto ----
export async function computeSha256Hex(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
