import { Box, Button, Container, Stack, Typography } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const NotFoundPage = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const homePath = isAuthenticated ? '/dashboard' : '/';

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: 2,
                }}
            >
                <SearchOffIcon sx={{ fontSize: 72, color: 'text.disabled' }} />
                <Typography variant="h2" component="h1" fontWeight={700}>
                    404
                </Typography>
                <Typography variant="h5" component="h2">
                    Page not found
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    The page you are looking for doesn&apos;t exist or may have been moved.
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Button component={RouterLink} to={homePath} variant="contained">
                        {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
                    </Button>
                    <Button component={RouterLink} to="/explore" variant="outlined">
                        Explore Screens
                    </Button>
                </Stack>
            </Box>
        </Container>
    );
};

export default NotFoundPage;
