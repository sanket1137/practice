import { useState, useEffect } from 'react';
import { websocketService } from '../../services/websocket';

interface LivePreviewWidgetProps {
    screenId: string;
    screenName: string;
}

interface CurrentCreative {
    creativeId: string;
    creativeName: string;
    thumbnailUrl: string;
    timestamp: Date;
}

// SignalR serializes camelCase on the wire.
interface AdStartedEvent {
    screenId: string;
    creativeId?: string | null;
    creativeName?: string;
    thumbnailUrl?: string;
}

interface ScreenStatusChangedEvent {
    screenId: string;
    isOnline: boolean;
}

export function LivePreviewWidget({ screenId, screenName }: LivePreviewWidgetProps) {
    const [currentCreative, setCurrentCreative] = useState<CurrentCreative | null>(null);
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        // Subscribe to AdStarted events for this specific screen
        const handleAdStarted = (data: AdStartedEvent) => {
            if (data.screenId === screenId) {
                setCurrentCreative({
                    creativeId: data.creativeId || '',
                    creativeName: data.creativeName || 'Unknown',
                    thumbnailUrl: data.thumbnailUrl || '/default-thumbnail.png',
                    timestamp: new Date()
                });
                setIsOnline(true);
            }
        };

        // Subscribe to screen status events
        const handleScreenStatus = (data: ScreenStatusChangedEvent) => {
            if (data.screenId === screenId) {
                setIsOnline(data.isOnline);
            }
        };

        // Register event handlers
        websocketService.on('AdStarted', handleAdStarted);
        websocketService.on('ScreenStatusChanged', handleScreenStatus);

        // Cleanup on unmount
        return () => {
            websocketService.off('AdStarted', handleAdStarted);
            websocketService.off('ScreenStatusChanged', handleScreenStatus);
        };
    }, [screenId]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {screenName}
                </h3>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isOnline ? 'Live' : 'Offline'}
                    </span>
                </div>
            </div>

            {/* Preview Area */}
            <div className="relative aspect-video bg-gray-100 dark:bg-gray-900">
                {currentCreative && isOnline ? (
                    <>
                        <img
                            src={currentCreative.thumbnailUrl}
                            alt={currentCreative.creativeName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.src = '/default-thumbnail.png';
                            }}
                        />
                        {/* Overlay with creative name */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-white text-sm font-medium truncate">
                                {currentCreative.creativeName}
                            </p>
                            <p className="text-white/70 text-xs">
                                {currentCreative.timestamp.toLocaleTimeString()}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="text-4xl mb-2">📺</div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                {isOnline ? 'Waiting for content...' : 'Screen Offline'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
