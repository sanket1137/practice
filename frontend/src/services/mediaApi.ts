import api from './api';

/**
 * Library-first media model. A Creative may be unattached (sitting in the
 * advertiser's library) or attached to one campaign. Attaching the same asset
 * to a second campaign clones the row on the server, preserving the original.
 */
export interface MediaCreative {
  id: string;
  campaignId?: string | null;
  name: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  duration: number;
  status: 'PendingReview' | 'Approved' | 'Rejected';
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  uploadedById?: string | null;
  createdAt: string;
}

export interface UploadCreativeArgs {
  file: File;
  name: string;
  duration?: number;
  width?: number;
  height?: number;
  /** Optional — when omitted the asset lives in the library, unattached. */
  campaignId?: string;
  onProgress?: (percent: number) => void;
}

const mediaApi = {
  /** Full library for the current user. */
  listLibrary: async (): Promise<MediaCreative[]> => {
    const res = await api.get('/creatives/library');
    return res.data?.data ?? [];
  },

  upload: async ({ file, name, duration, width, height, campaignId, onProgress }: UploadCreativeArgs): Promise<MediaCreative> => {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    if (duration != null) form.append('duration', String(duration));
    if (width != null) form.append('width', String(width));
    if (height != null) form.append('height', String(height));
    if (campaignId) form.append('campaignId', campaignId);
    const res = await api.post('/creatives/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    });
    return res.data.data;
  },

  updateMetadata: async (id: string, patch: { name?: string; duration?: number }): Promise<MediaCreative> => {
    const res = await api.patch(`/creatives/${id}`, patch);
    return res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/creatives/${id}`);
  },

  attach: async (id: string, campaignId: string): Promise<MediaCreative> => {
    const res = await api.post(`/creatives/${id}/attach`, { campaignId });
    return res.data.data;
  },

  detach: async (id: string): Promise<MediaCreative> => {
    const res = await api.post(`/creatives/${id}/detach`);
    return res.data.data;
  },
};

export default mediaApi;
