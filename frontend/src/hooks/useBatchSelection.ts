import { useState } from 'react';

// Hook to manage batch selection
export function useBatchSelection<T extends { id: string }>(items: T[] = []) {
    const [selected, setSelected] = useState<string[]>([]);

    const isSelected = (id: string) => selected.includes(id);

    const isAllSelected = items.length > 0 && selected.length === items.length;

    const isIndeterminate = selected.length > 0 && selected.length < items.length;

    const toggleSelect = (id: string) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        setSelected(isAllSelected ? [] : items.map(item => item.id));
    };

    const clearSelection = () => setSelected([]);

    const getSelectedItems = () => items.filter(item => selected.includes(item.id));

    return {
        selected,
        isSelected,
        isAllSelected,
        isIndeterminate,
        toggleSelect,
        toggleSelectAll,
        clearSelection,
        getSelectedItems,
        selectedCount: selected.length,
    };
}
