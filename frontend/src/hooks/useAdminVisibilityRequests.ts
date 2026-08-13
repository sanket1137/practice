import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAdminVisibilityRequests,
    getAdminVisibilityRequestById,
    approveVisibilityRequest,
    rejectVisibilityRequest,
} from '../services/profileApi';
import type { VisibilityRequestsParams } from '../services/profileApi';

export const useAdminVisibilityRequests = (params: VisibilityRequestsParams = {}) => {
    const queryClient = useQueryClient();

    const listQuery = useQuery({
        queryKey: ['admin-visibility-requests', params],
        queryFn: () => getAdminVisibilityRequests(params),
        staleTime: 0,
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => approveVisibilityRequest(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-visibility-requests'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVisibilityRequest(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-visibility-requests'] });
        },
    });

    return {
        requests: listQuery.data,
        isLoading: listQuery.isLoading,
        error: listQuery.error,
        refetch: listQuery.refetch,
        approve: approveMutation.mutateAsync,
        isApproving: approveMutation.isPending,
        reject: rejectMutation.mutateAsync,
        isRejecting: rejectMutation.isPending,
    };
};

export const useAdminVisibilityRequestDetail = (id: string) => {
    return useQuery({
        queryKey: ['admin-visibility-requests', id],
        queryFn: () => getAdminVisibilityRequestById(id),
        enabled: !!id,
    });
};
