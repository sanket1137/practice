import { useCallback, useState } from 'react';
import type { PaginationState } from '../components/common/PaginationControls';

/**
 * Hook for managing pagination state
 */
export const usePagination = (initialPageSize = 10) => {
    const [state, setState] = useState<PaginationState>({
        page: 1,
        pageSize: initialPageSize,
        totalCount: 0,
        totalPages: 0,
        searchTerm: '',
        sortBy: 'CreatedAt',
        sortDirection: 'desc',
        filters: {},
    });

    const setPage = useCallback((page: number) => {
        setState((prev) => ({ ...prev, page }));
    }, []);

    const setPageSize = useCallback((pageSize: number) => {
        setState((prev) => ({ ...prev, pageSize, page: 1 }));
    }, []);

    const setSearchTerm = useCallback((searchTerm: string) => {
        setState((prev) => ({ ...prev, searchTerm, page: 1 }));
    }, []);

    const setSort = useCallback((sortBy: string, sortDirection: 'asc' | 'desc') => {
        setState((prev) => ({ ...prev, sortBy, sortDirection }));
    }, []);

    const setFilters = useCallback((filters: Record<string, string>) => {
        setState((prev) => ({ ...prev, filters, page: 1 }));
    }, []);

    const updateFromResponse = useCallback((response: {
        totalCount: number;
        pageNumber: number;
        pageSize: number;
        totalPages: number;
    }) => {
        setState((prev) => ({
            ...prev,
            totalCount: response.totalCount,
            page: response.pageNumber,
            pageSize: response.pageSize,
            totalPages: response.totalPages,
        }));
    }, []);

    const reset = useCallback(() => {
        setState({
            page: 1,
            pageSize: initialPageSize,
            totalCount: 0,
            totalPages: 0,
            searchTerm: '',
            sortBy: 'CreatedAt',
            sortDirection: 'desc',
            filters: {},
        });
    }, [initialPageSize]);

    return {
        state,
        setPage,
        setPageSize,
        setSearchTerm,
        setSort,
        setFilters,
        updateFromResponse,
        reset,
    };
};
