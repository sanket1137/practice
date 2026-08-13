import { useEffect, useState } from 'react';

// Hook to manage keyboard shortcuts panel
export function useKeyboardShortcuts() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Show shortcuts panel with ?
            if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                setOpen(true);
            }

            // Close with Esc
            if (event.key === 'Escape' && open) {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    return { open, setOpen };
}
