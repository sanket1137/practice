import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Button, Container, Paper, Typography, Alert, Collapse } from '@mui/material';
import { Refresh as RefreshIcon, ExpandMore as ExpandMoreIcon, BugReport as BugReportIcon, Home as HomeIcon } from '@mui/icons-material';

interface ErrorFallbackProps {
    error: Error;
    errorInfo?: ErrorInfo;
    resetError?: () => void;
    showDetails?: boolean;
}

/**
 * Fallback UI shown when an error occurs
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
    error, 
    errorInfo, 
    resetError,
    showDetails = false 
}) => {
    const [expanded, setExpanded] = React.useState(showDetails);
    const isDev = import.meta.env.DEV;

    const handleGoHome = () => {
        window.location.href = '/';
    };

    const handleRefresh = () => {
        if (resetError) {
            resetError();
        } else {
            window.location.reload();
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
            <Paper 
                elevation={3} 
                sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    borderTop: 4,
                    borderColor: 'error.main'
                }}
            >
                <BugReportIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                
                <Typography variant="h4" gutterBottom color="error.main">
                    Oops! Something went wrong
                </Typography>
                
                <Typography variant="body1" color="text.secondary" paragraph>
                    We apologize for the inconvenience. An unexpected error has occurred.
                </Typography>

                <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight="bold">
                        {error.name}: {error.message}
                    </Typography>
                </Alert>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<RefreshIcon />}
                        onClick={handleRefresh}
                    >
                        Try Again
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<HomeIcon />}
                        onClick={handleGoHome}
                    >
                        Go to Home
                    </Button>
                </Box>

                {/* Technical Details (for developers) */}
                {isDev && errorInfo && (
                    <Box sx={{ mt: 2, textAlign: 'left' }}>
                        <Button
                            size="small"
                            onClick={() => setExpanded(!expanded)}
                            endIcon={
                                <ExpandMoreIcon 
                                    sx={{ 
                                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.3s'
                                    }} 
                                />
                            }
                            sx={{ mb: 1 }}
                        >
                            {expanded ? 'Hide' : 'Show'} Technical Details
                        </Button>
                        <Collapse in={expanded}>
                            <Paper 
                                variant="outlined" 
                                sx={{ 
                                    p: 2, 
                                    bgcolor: 'grey.100',
                                    maxHeight: 300,
                                    overflow: 'auto'
                                }}
                            >
                                <Typography variant="subtitle2" gutterBottom color="error">
                                    Stack Trace:
                                </Typography>
                                <Box 
                                    component="pre" 
                                    sx={{ 
                                        fontSize: '0.75rem', 
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        m: 0
                                    }}
                                >
                                    {error.stack}
                                </Box>
                                {errorInfo?.componentStack && (
                                    <>
                                        <Typography variant="subtitle2" gutterBottom color="error" sx={{ mt: 2 }}>
                                            Component Stack:
                                        </Typography>
                                        <Box 
                                            component="pre" 
                                            sx={{ 
                                                fontSize: '0.75rem', 
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                m: 0
                                            }}
                                        >
                                            {errorInfo.componentStack}
                                        </Box>
                                    </>
                                )}
                            </Paper>
                        </Collapse>
                    </Box>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
                    If this problem persists, please contact support.
                </Typography>
            </Paper>
        </Container>
    );
};

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere in its child
 * component tree, logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * // With custom fallback:
 * <ErrorBoundary fallback={<CustomError />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * // With error reporting:
 * <ErrorBoundary onError={(error, info) => logErrorToService(error, info)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log the error to console
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        // Update state with error info
        this.setState({ errorInfo });

        // Call optional error handler (for error reporting services)
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    resetError = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });

        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            // Render custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Render default error fallback
            return (
                <ErrorFallback
                    error={this.state.error}
                    errorInfo={this.state.errorInfo || undefined}
                    resetError={this.resetError}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
