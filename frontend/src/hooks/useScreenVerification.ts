import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  scanQr,
  uploadVerificationVideo,
  getVerificationStatus,
  getVerificationHistory,
} from '../services/verificationApi';
import type { ScanQrRequest } from '../types/verification';

const VERIFICATION_STATUS_POLL_INTERVAL = 10_000;

export function useVerificationStatus(screenId: string, enabled = true) {
  return useQuery({
    queryKey: ['verification-status', screenId],
    queryFn: () => getVerificationStatus(screenId),
    enabled: !!screenId && enabled,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'Verified' || status === 'Rejected') return false;
      return VERIFICATION_STATUS_POLL_INTERVAL;
    },
  });
}

export function useVerificationHistory(screenId: string) {
  return useQuery({
    queryKey: ['verification-history', screenId],
    queryFn: () => getVerificationHistory(screenId),
    enabled: !!screenId,
  });
}

export function useScanQr(screenId: string) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: (request: ScanQrRequest) => scanQr(screenId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-status', screenId] });
      queryClient.invalidateQueries({ queryKey: ['verification-history', screenId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'QR verification failed';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

export function useUploadVerificationVideo(screenId: string) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({
      verificationId,
      file,
      onUploadProgress,
    }: {
      verificationId: string;
      file: File;
      onUploadProgress?: (progress: number) => void;
    }) => uploadVerificationVideo(screenId, verificationId, file, onUploadProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-status', screenId] });
      queryClient.invalidateQueries({ queryKey: ['verification-history', screenId] });
      enqueueSnackbar('Video uploaded — pending admin review', { variant: 'success' });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to upload verification video';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}
