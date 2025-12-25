import React, { useEffect, useRef, useState } from 'react';
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
    Grid,
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
    fallbackToVideoSync?: boolean;
    onStreamStart?: () => void;
    onStreamEnd?: () => void;
    onError?: (error: Error) => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'live' | 'error' | 'stopped';

export const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({
    screenId,
    autoStart = false,
    fallbackToVideoSync = true,
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

    useEffect(() => {
        // Initialize StreamingHub connection
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
            } catch (err) {
                console.error('[WebRTC] Failed to connect to StreamingHub:', err);
                setError('Failed to connect to streaming server');
            }
        };

        initStreamingHub();

        if (autoStart) {
            startStream();
        }

        return () => {
            stopStream();
            streamingHubRef.current?.stop();
        };
    }, [screenId]);

    const startStream = async () => {
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

            // Handle incoming tracks
            pc.ontrack = (event) => {
                console.log('[WebRTC] Received remote track');
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                    setStatus('live');
                    onStreamStart?.();
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

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                console.log('[WebRTC] Connection state:', pc.connectionState);

                switch (pc.connectionState) {
                    case 'connected':
                        setStatus('connected');
                        startLatencyMonitoring();
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

            // Set up SignalR event handlers
            streamingHubRef.current.on('OnOffer', handleOffer);
            streamingHubRef.current.on('OnIceCandidate', handleIceCandidate);
            streamingHubRef.current.on('OnStreamEnded', handleStreamEnded);
            streamingHubRef.current.on('OnStreamError', handleStreamError);

            // Request stream from player
            console.log('[WebRTC] Requesting stream for screen:', screenId);
            await streamingHubRef.current.invoke('RequestStream', screenId);

            setStatus('connecting');

        } catch (err) {
            console.error('[WebRTC] Error starting stream:', err);
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to start stream');
            onError?.(err instanceof Error ? err : new Error('Failed to start stream'));
        }
    };

    const handleOffer = async (offerSdp: string) => {
        try {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            // CRITICAL: Ignore duplicate offers if we're not in stable state (already processing one)
            if (pc.signalingState !== 'stable') {
                console.log('[WebRTC] Ignoring duplicate offer - already processing/connected (state: ' + pc.signalingState + ')');
                return;
            }

            console.log('[WebRTC] Received offer from player');
            const offer = JSON.parse(offerSdp);

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (streamingHubRef.current) {
                await streamingHubRef.current.invoke('SendAnswer', screenId, JSON.stringify({
                    type: pc.localDescription?.type,
                    sdp: pc.localDescription?.sdp,
                }));
            }

            console.log('[WebRTC] Sent answer to player');

        } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
            setError('Failed to establish connection');
        }
    };

    const handleIceCandidate = async (candidateJson: string) => {
        try {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            const candidate = JSON.parse(candidateJson);
            await pc.addIceCandidate(new RTCIceCandidate(candidate));

            console.log('[WebRTC] Added ICE candidate from player');

        } catch (err) {
            console.error('[WebRTC] Error handling ICE candidate:', err);
        }
    };

    const handleStreamEnded = (endedScreenId: string) => {
        if (endedScreenId === screenId) {
            console.log('[WebRTC] Stream ended by player');
            stopStream();
        }
    };

    const handleStreamError = (errorMessage: string) => {
        console.error('[WebRTC] Stream error:', errorMessage);
        setError(errorMessage);
        setStatus('error');
    };

    const stopStream = async () => {
        try {
            // Stop watching on server
            if (streamingHubRef.current && streamingHubRef.current.state === signalR.HubConnectionState.Connected) {
                await streamingHubRef.current.invoke('StopWatching', screenId);
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

            // Cleanup event listeners
            if (streamingHubRef.current) {
                streamingHubRef.current.off('OnOffer', handleOffer);
                streamingHubRef.current.off('OnIceCandidate', handleIceCandidate);
                streamingHubRef.current.off('OnStreamEnded', handleStreamEnded);
                streamingHubRef.current.off('OnStreamError', handleStreamError);
            }

            setStatus('stopped');
            onStreamEnd?.();

        } catch (err) {
            console.error('[WebRTC] Error stopping stream:', err);
        }
    };

    const startLatencyMonitoring = () => {
        // Simple latency estimation based on video buffering
        const interval = setInterval(() => {
            if (videoRef.current && status === 'live') {
                const buffered = videoRef.current.buffered;
                if (buffered.length > 0) {
                    const latencyMs = Math.round((buffered.end(0) - videoRef.current.currentTime) * 1000);
                    setLatency(latencyMs);
                }
            } else {
                clearInterval(interval);
            }
        }, 1000);
    };

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
            case 'live':
                return 'success';
            case 'connected':
            case 'connecting':
                return 'primary';
            case 'error':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'live':
            case 'connected':
                return <SignalWifi4Bar />;
            case 'error':
            case 'stopped':
                return <SignalWifiOff />;
            default:
                return null;
        }
    };

    return (
        <Card sx={{ maxWidth: '100%', height: '100%' }}>
            <CardContent>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Live Stream</Typography>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {/* Status Chip */}
                        <Chip
                            icon={getStatusIcon()}
                            label={status.toUpperCase()}
                            color={getStatusColor()}
                            size="small"
                        />

                        {/* Latency Indicator */}
                        {latency !== null && status === 'live' && (
                            <Chip
                                label={`${latency}ms`}
                                size="small"
                                variant="outlined"
                            />
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
                        paddingTop: '56.25%', // 16:9 aspect ratio
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
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(0,0,0,0.7)',
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    )}

                    {/* Controls Overlay */}
                    {status === 'live' && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: 1,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                opacity: 0,
                                '&:hover': {
                                    opacity: 1,
                                },
                                transition: 'opacity 0.3s',
                            }}
                        >
                            <Tooltip title="Fullscreen">
                                <IconButton onClick={toggleFullscreen} size="small" sx={{ color: 'white' }}>
                                    <Fullscreen />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                </Box>

                {/* Control Buttons */}
                <Grid container spacing={1} sx={{ mt: 2 }}>
                    <Grid item xs={6}>
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
                    </Grid>
                    <Grid item xs={6}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Settings />}
                            disabled={status === 'connecting' || status === 'live'}
                        >
                            Settings
                        </Button>
                    </Grid>
                </Grid>

                {/* Info */}
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
