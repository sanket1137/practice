import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  adminGetVerifications,
  adminGetVerificationDetail,
  adminApproveVerification,
  adminRejectVerification,
} from '../services/verificationApi';
import type { AdminVerificationListParams } from '../types/verification';

export function useAdminVerifications(params: AdminVerificationListParams) {
  return useQuery({
    queryKey: ['admin-verifications', params],
    queryFn: () => adminGetVerifications(params),
    staleTime: 0,
  });
}

export function useAdminVerificationDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: ['admin-verification', id],
    queryFn: () => adminGetVerificationDetail(id),
    enabled: !!id && enabled,
  });
}

export function useApproveVerification() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: (id: string) => adminApproveVerification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      enqueueSnackbar('Screen verification approved', { variant: 'success' });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to approve verification';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}

export function useRejectVerification() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminRejectVerification(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      enqueueSnackbar('Screen verification rejected', { variant: 'success' });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to reject verification';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
}
