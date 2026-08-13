import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyVisibilityRequest, submitVisibilityRequest } from '../services/profileApi';

export const useVisibilityRequest = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['visibility-request'],
        queryFn: getMyVisibilityRequest,
        staleTime: 0,
    });

    const submitMutation = useMutation({
        mutationFn: (message?: string) => submitVisibilityRequest(message),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['visibility-request'] });
        },
    });

    return {
        request: query.data,
        isLoading: query.isLoading,
        error: query.error,
        submitRequest: submitMutation.mutateAsync,
        isSubmitting: submitMutation.isPending,
    };
};
