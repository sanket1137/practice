import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Alert,
    Divider,
} from '@mui/material';
import { Add as AddIcon, Campaign as CampaignIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCampaignsPaged, type CampaignDto } from '../../services/paginatedApi';

interface BookScreenDialogProps {
    open: boolean;
    onClose: () => void;
    screenId: string;
    screenName: string;
}

export default function BookScreenDialog({ open, onClose, screenId, screenName }: BookScreenDialogProps) {
    const navigate = useNavigate();
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

    // Fetch user's campaigns (only Active and Draft campaigns are bookable)
    const { data: campaignsData, isLoading, error } = useQuery({
        queryKey: ['campaigns-for-booking'],
        queryFn: () => getCampaignsPaged({ pageSize: 100 }), // Get all campaigns
        enabled: open,
    });

    // Filter to only show Active and Draft campaigns
    const bookableCampaigns = campaignsData?.items?.filter(
        (c: CampaignDto) => c.status === 'Active' || c.status === 'Draft'
    ) || [];

    const handleCreateNewCampaign = () => {
        onClose();
        navigate(`/campaigns/new?screenId=${screenId}`);
    };

    const handleAddToExistingCampaign = () => {
        if (!selectedCampaignId) return;
        onClose();
        navigate(`/bookings/new?campaignId=${selectedCampaignId}&screenId=${screenId}`);
    };

    const handleClose = () => {
        setSelectedCampaignId('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Book Screen</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                    Book <strong>{screenName}</strong> for your advertising campaign
                </Typography>

                <Divider sx={{ my: 2 }} />

                {/* Option 1: Create New Campaign */}
                <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                        Option 1: Create a New Campaign
                    </Typography>
                    <Typography variant="body2" color="textSecondary" mb={2}>
                        Start fresh with a new campaign that includes this screen
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={handleCreateNewCampaign}
                        fullWidth
                    >
                        Create New Campaign
                    </Button>
                </Box>

                <Divider sx={{ my: 2 }}>
                    <Typography variant="caption" color="textSecondary">OR</Typography>
                </Divider>

                {/* Option 2: Add to Existing Campaign */}
                <Box>
                    <Typography variant="subtitle2" gutterBottom>
                        Option 2: Add to Existing Campaign
                    </Typography>
                    <Typography variant="body2" color="textSecondary" mb={2}>
                        Book this screen for one of your existing campaigns
                    </Typography>

                    {isLoading ? (
                        <Box display="flex" justifyContent="center" py={2}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : error ? (
                        <Alert severity="error">Failed to load campaigns</Alert>
                    ) : bookableCampaigns.length === 0 ? (
                        <Alert severity="info">
                            You don't have any active campaigns yet. Create a new campaign first.
                        </Alert>
                    ) : (
                        <>
                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Select Campaign</InputLabel>
                                <Select
                                    value={selectedCampaignId}
                                    label="Select Campaign"
                                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                                >
                                    {bookableCampaigns.map((campaign: CampaignDto) => (
                                        <MenuItem key={campaign.id} value={campaign.id}>
                                            <Box>
                                                <Typography variant="body2">{campaign.name}</Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {campaign.status} • {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Button
                                variant="contained"
                                startIcon={<CampaignIcon />}
                                onClick={handleAddToExistingCampaign}
                                disabled={!selectedCampaignId}
                                fullWidth
                            >
                                Book for Selected Campaign
                            </Button>
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}
