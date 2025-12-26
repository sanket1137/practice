import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    CircularProgress,
    Chip,
    Alert,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    PlayArrow,
    Stop,
    Fullscreen,
    Settings,
    SignalWifi4Bar,
    SignalWifiOff,
} from '@mui/icons-material';
import * as signalR from '@microsoft/signalr';

interface WebRTCPlayerProps {
    screenId: string;
    autoStart?: boolean;
    onStreamStart?: () => void;
    onStreamEnd?: () => void;
    onError?: (error: Error) => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'live' | 'error' | 'stopped';

export const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({
    screenId,
    autoStart = false,
    onStreamStart,
    onStreamEnd,
    onError,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const streamingHubRef = useRef<signalR.HubConnection | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [latency, setLatency] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const isStreamingRef = useRef(false);

    // Latency monitoring
    const startLatencyMonitoring = useCallback(() => {
        const interval = setInterval(() => {
            if (videoRef.current && isStreamingRef.current) {
                const buffered = videoRef.current.buffered;
                if (buffered.length > 0) {
                    const latencyMs = Math.round((buffered.end(0) - videoRef.current.currentTime) * 1000);
                    setLatency(latencyMs);
                }
            } else {
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Stop stream function
    const stopStream = useCallback(async () => {
        try {
            isStreamingRef.current = false;
            
            // Stop watching on server
            if (streamingHubRef.current && streamingHubRef.current.state === signalR.HubConnectionState.Connected) {
                try {
                    await streamingHubRef.current.invoke('StopWatching', screenId);
                } catch (e) {
                    console.log('[WebRTC] StopWatching invoke failed:', e);
                }
            }

            // Close peer connection
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            // Stop video
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            setStatus('stopped');
            onStreamEnd?.();
        } catch (err) {
            console.error('[WebRTC] Error stopping stream:', err);
        }
    }, [screenId, onStreamEnd]);

    // Start stream function
    const startStream = useCallback(async () => {
        if (isStreamingRef.current) {
            console.log('[WebRTC] Already streaming');
            return;
        }

        try {
            setStatus('connecting');
            setError(null);

            if (!streamingHubRef.current || streamingHubRef.current.state !== signalR.HubConnectionState.Connected) {
                setError('Not connected to streaming server');
                setStatus('error');
                return;
            }

            // Create peer connection
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
            });

            peerConnectionRef.current = pc;

            // CRITICAL: Add transceiver to indicate we want to receive video
            pc.addTransceiver('video', { direction: 'recvonly' });

            // Handle incoming tracks
            pc.ontrack = (event) => {
                console.log('[WebRTC] Received remote track:', event.track.kind);
                console.log('[WebRTC] Track readyState:', event.track.readyState);
                
                if (videoRef.current && event.streams[0]) {
                    console.log('[WebRTC] Setting video srcObject...');
                    videoRef.current.srcObject = event.streams[0];
                    
                    videoRef.current.play()
                        .then(() => {
                            console.log('[WebRTC] Video playback started successfully');
                            isStreamingRef.current = true;
                            setStatus('live');
                            startLatencyMonitoring();
                            onStreamStart?.();
                        })
                        .catch((playError) => {
                            console.error('[WebRTC] Video play() failed:', playError);
                            isStreamingRef.current = true;
                            setStatus('live');
                            onStreamStart?.();
                        });
                } else if (event.track.kind === 'video') {
                    console.log('[WebRTC] No stream in event, creating MediaStream from track...');
                    const stream = new MediaStream([event.track]);
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play()
                            .then(() => {
                                isStreamingRef.current = true;
                                setStatus('live');
                                startLatencyMonitoring();
                                onStreamStart?.();
                            })
                            .catch(() => {
                                isStreamingRef.current = true;
                                setStatus('live');
                                onStreamStart?.();
                            });
                    }
                }
            };

            // Handle ICE candidates
            pc.onicecandidate = async (event) => {
                if (event.candidate && streamingHubRef.current) {
                    console.log('[WebRTC] Sending ICE candidate');
                    await streamingHubRef.current.invoke('SendViewerIceCandidate', screenId, JSON.stringify({
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                    }));
                }
            };

            pc.onicegatheringstatechange = () => {
                console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState);
            };

            pc.oniceconnectionstatechange = () => {
                console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
                if (pc.iceConnectionState === 'connected') {
                    console.log('[WebRTC] ✓ ICE connected - media should flow!');
                } else if (pc.iceConnectionState === 'failed') {
                    setError('ICE connection failed - check network/firewall');
                }
            };

            pc.onconnectionstatechange = () => {
                console.log('[WebRTC] Connection state:', pc.connectionState);
                switch (pc.connectionState) {
                    case 'connected':
                        setStatus('connected');
                        break;
                    case 'disconnected':
                    case 'failed':
                        setStatus('error');
                        setError('Connection failed');
                        onError?.(new Error('WebRTC connection failed'));
                        break;
                    case 'closed':
                        setStatus('stopped');
                        onStreamEnd?.();
                        break;
                }
            };

            // Handle offer from player
            const handleOffer = async (offerSdp: string) => {
                try {
                    if (!peerConnectionRef.current) return;
                    
                    if (peerConnectionRef.current.signalingState !== 'stable') {
                        console.log('[WebRTC] Ignoring duplicate offer');
                        return;
                    }

                    console.log('[WebRTC] Received offer from player');
                    const offer = JSON.parse(offerSdp);
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

                    const answer = await peerConnectionRef.current.createAnswer();
                    await peerConnectionRef.current.setLocalDescription(answer);

                    if (streamingHubRef.current) {
                        await streamingHubRef.current.invoke('SendAnswer', screenId, JSON.stringify({
                            type: peerConnectionRef.current.localDescription?.type,
                            sdp: peerConnectionRef.current.localDescription?.sdp,
                        }));
                    }
                    console.log('[WebRTC] Sent answer to player');
                } catch (err) {
                    console.error('[WebRTC] Error handling offer:', err);
                    setError('Failed to establish connection');
                }
            };

            // Handle ICE candidate from player
            const handleIceCandidate = async (candidateJson: string) => {
                try {
                    if (!peerConnectionRef.current) return;
                    const candidate = JSON.parse(candidateJson);
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('[WebRTC] Added ICE candidate from player');
                } catch (err) {
                    console.error('[WebRTC] Error handling ICE candidate:', err);
                }
            };

            // Handle stream ended
            const handleStreamEnded = (endedScreenId: string) => {
                if (endedScreenId === screenId) {
                    console.log('[WebRTC] Stream ended by player');
                    stopStream();
                }
            };

            // Handle stream error
            const handleStreamError = (errorMessage: string) => {
                if (peerConnectionRef.current?.connectionState === 'connected') {
                    console.log('[WebRTC] Ignoring stream error - already connected');
                    return;
                }
                console.error('[WebRTC] Stream error:', errorMessage);
                setError(errorMessage);
                setStatus('error');
            };

            // Set up SignalR event handlers
            streamingHubRef.current.on('OnOffer', handleOffer);
            streamingHubRef.current.on('OnIceCandidate', handleIceCandidate);
            streamingHubRef.current.on('OnStreamEnded', handleStreamEnded);
            streamingHubRef.current.on('OnStreamError', handleStreamError);

            // Request stream from player
            console.log('[WebRTC] Requesting stream for screen:', screenId);
            await streamingHubRef.current.invoke('RequestStream', screenId);

        } catch (err) {
            console.error('[WebRTC] Error starting stream:', err);
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to start stream');
            onError?.(err instanceof Error ? err : new Error('Failed to start stream'));
        }
    }, [screenId, onStreamStart, onStreamEnd, onError, stopStream, startLatencyMonitoring]);

    // Initialize SignalR connection
    useEffect(() => {
        const initStreamingHub = async () => {
            const connection = new signalR.HubConnectionBuilder()
                .withUrl('http://localhost:5257/hubs/streaming', {
                    transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            streamingHubRef.current = connection;

            try {
                await connection.start();
                console.log('[WebRTC] Connected to StreamingHub');
                
                if (autoStart) {
                    setTimeout(() => startStream(), 100);
                }
            } catch (err) {
                console.error('[WebRTC] Failed to connect to StreamingHub:', err);
                setError('Failed to connect to streaming server');
            }
        };

        initStreamingHub();

        return () => {
            stopStream();
            streamingHubRef.current?.stop();
        };
    }, [screenId, autoStart, startStream, stopStream]);

    const toggleFullscreen = () => {
        if (!videoRef.current) return;
        if (!isFullscreen) {
            videoRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const getStatusColor = (): 'default' | 'primary' | 'success' | 'error' | 'warning' => {
        switch (status) {
            case 'live': return 'success';
            case 'connected':
            case 'connecting': return 'primary';
            case 'error': return 'error';
            default: return 'default';
        }
    };

    const getStatusIcon = (): React.ReactElement | undefined => {
        switch (status) {
            case 'live':
            case 'connected': return <SignalWifi4Bar />;
            case 'error':
            case 'stopped': return <SignalWifiOff />;
            default: return undefined;
        }
    };

    return (
        <Card sx={{ maxWidth: '100%', height: '100%' }}>
            <CardContent>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Live Stream</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                            icon={getStatusIcon()}
                            label={status.toUpperCase()}
                            color={getStatusColor()}
                            size="small"
                        />
                        {latency !== null && status === 'live' && (
                            <Chip label={`${latency}ms`} size="small" variant="outlined" />
                        )}
                    </Box>
                </Box>

                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {/* Video Player */}
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%',
                        backgroundColor: '#000',
                        borderRadius: 1,
                        overflow: 'hidden',
                    }}
                >
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={() => {
                            console.log('[WebRTC] Video metadata loaded');
                            videoRef.current?.play().catch(() => {});
                        }}
                        onCanPlay={() => {
                            console.log('[WebRTC] Video can play');
                            if (videoRef.current?.paused) {
                                videoRef.current.play().catch(() => {});
                            }
                        }}
                        onPlaying={() => {
                            console.log('[WebRTC] Video is playing!');
                            if (status !== 'live') setStatus('live');
                        }}
                        onError={(e) => console.error('[WebRTC] Video error:', e)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                        }}
                    />

                    {/* Loading Overlay */}
                    {status === 'connecting' && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(0,0,0,0.7)',
                            }}
                        >
                            <CircularProgress sx={{ mb: 2 }} />
                            <Typography variant="body2" sx={{ color: '#fff' }}>
                                Connecting to live stream...
                            </Typography>
                        </Box>
                    )}

                    {/* Idle Overlay */}
                    {(status === 'idle' || status === 'stopped') && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                cursor: 'pointer',
                            }}
                            onClick={startStream}
                        >
                            <PlayArrow sx={{ fontSize: 64, color: '#fff', opacity: 0.8 }} />
                            <Typography variant="body1" sx={{ color: '#fff', mt: 1 }}>
                                Click to start live stream
                            </Typography>
                        </Box>
                    )}

                    {/* Live Controls Overlay */}
                    {status === 'live' && (
                        <>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(255, 0, 0, 0.9)',
                                    padding: '4px 8px',
                                    borderRadius: 1,
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                        '0%': { opacity: 1 },
                                        '50%': { opacity: 0.7 },
                                        '100%': { opacity: 1 },
                                    },
                                }}
                            >
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fff', mr: 1 }} />
                                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 'bold' }}>LIVE</Typography>
                            </Box>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 0, left: 0, right: 0,
                                    padding: 1,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    opacity: 0,
                                    '&:hover': { opacity: 1 },
                                    transition: 'opacity 0.3s',
                                }}
                            >
                                <Tooltip title="Fullscreen">
                                    <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'white' }}>
                                        <Fullscreen />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </>
                    )}
                </Box>

                {/* Control Buttons */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        {status === 'idle' || status === 'stopped' || status === 'error' ? (
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                startIcon={<PlayArrow />}
                                onClick={startStream}
                            >
                                Start Stream
                            </Button>
                        ) : (
                            <Button
                                fullWidth
                                variant="outlined"
                                color="secondary"
                                startIcon={<Stop />}
                                onClick={stopStream}
                            >
                                Stop Stream
                            </Button>
                        )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Settings />}
                            disabled={status === 'connecting' || status === 'live'}
                        >
                            Settings
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        WebRTC ultra-low latency streaming. Typical latency: &lt;500ms
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

export default WebRTCPlayer;
