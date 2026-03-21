import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Grid,
    IconButton,
    TextField,
    InputAdornment,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    ViewModule as GridViewIcon,
    ViewList as ListViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';
import { getAdvertiserCampaigns } from '../../services/analyticsApi';
import type { CampaignPerformanceSummary } from '../../services/analyticsApi';
import EnhancedCampaignCard from '../../components/campaigns/EnhancedCampaignCard';
import { CardSkeleton } from '../../components/common/LoadingSkeletons';
import EmptyState from '../../components/common/EmptyState';
import StatusChip from '../../components/common/StatusChip';
import type { CampaignStatus } from '../../constants/statusConfig';

interface Campaign {
    id: string;
    name: string;
    description: string;
    status: CampaignStatus;
    budget: number;
    currency: string;
    startDate: string;
    endDate: string;
    createdAt: string;
}

export default function CampaignsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Fetch campaigns
    const { data: campaigns, isLoading } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            return response.data.data;
        },
    });

    // Fetch campaign analytics
    const { data: campaignAnalytics } = useQuery<CampaignPerformanceSummary[]>({
        queryKey: ['campaignAnalytics'],
        queryFn: getAdvertiserCampaigns,
        enabled: !!campaigns?.length,
    });

    // Build analytics lookup map
    const analyticsMap = new Map<string, CampaignPerformanceSummary>();
    campaignAnalytics?.forEach((a) => analyticsMap.set(a.campaignId, a));

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/campaigns/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            enqueueSnackbar('Campaign deleted successfully', { variant: 'success' });
            setDeleteDialogOpen(false);
        },
        onError: () => {
            enqueueSnackbar('Failed to delete campaign', { variant: 'error' });
        },
    });

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, campaign: Campaign) => {
        setAnchorEl(event.currentTarget);
        setSelectedCampaign(campaign);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleDeleteConfirm = () => {
        if (selectedCampaign) {
            deleteMutation.mutate(selectedCampaign.id);
        }
    };

    const filteredCampaigns = campaigns?.filter((campaign) =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h4">Campaigns</Typography>
                </Box>
                <CardSkeleton count={6} />
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4">Campaigns</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/campaigns/new')}
                >
                    Create Campaign
                </Button>
            </Box>
            {/* Search & View Toggle */}
            <Box display="flex" gap={2} mb={3}>
                <TextField
                    fullWidth
                    placeholder="Search campaigns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(_, newMode) => newMode && setViewMode(newMode)}
                    size="small"
                >
                    <ToggleButton value="grid">
                        <GridViewIcon />
                    </ToggleButton>
                    <ToggleButton value="list">
                        <ListViewIcon />
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>
            {/* Campaign Grid/List */}
            {!filteredCampaigns || filteredCampaigns.length === 0 ? (
                <EmptyState
                    title="No campaigns yet"
                    message={
                        searchQuery
                            ? 'Try adjusting your search'
                            : 'Create your first campaign to start advertising'
                    }
                    action={{
                        label: 'Create Campaign',
                        onClick: () => navigate('/campaigns/new'),
                    }}
                />
            ) : viewMode === 'grid' ? (
                <Grid container spacing={3}>
                    {filteredCampaigns.map((campaign) => (
                        <Grid
                            key={campaign.id}
                            size={{
                                xs: 12,
                                sm: 6,
                                md: 4
                            }}>
                            <EnhancedCampaignCard
                                campaign={{
                                    ...campaign,
                                    spent: analyticsMap.get(campaign.id)?.spent ?? 0,
                                    impressions: analyticsMap.get(campaign.id)?.deliveredImpressions ?? 0,
                                    expectedImpressions: analyticsMap.get(campaign.id)?.expectedImpressions ?? 0,
                                }}
                                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Grid container spacing={2}>
                    {filteredCampaigns.map((campaign) => (
                        <Grid key={campaign.id} size={12}>
                            <Box
                                display="flex"
                                alignItems="center"
                                gap={2}
                                p={2}
                                border={1}
                                borderColor="divider"
                                borderRadius={1}
                                sx={{
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            >
                                <Box flex={1}>
                                    <Typography variant="h6">{campaign.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {campaign.description.length > 100
                                            ? `${campaign.description.substring(0, 100)}...`
                                            : campaign.description}
                                    </Typography>
                                    <Box display="flex" gap={2} mt={1}>
                                        <Typography variant="caption" color="text.secondary">
                                            Budget: {campaign.currency} {campaign.budget.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(campaign.startDate).toLocaleDateString()} -{' '}
                                            {new Date(campaign.endDate).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                </Box>
                                <StatusChip status={campaign.status} type="campaign" />
                                <IconButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleMenuOpen(e, campaign);
                                    }}
                                >
                                    <ViewIcon />
                                </IconButton>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            )}
            {/* Action Menu */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem onClick={() => {
                    if (selectedCampaign) navigate(`/campaigns/${selectedCampaign.id}`);
                    handleMenuClose();
                }}>
                    <ViewIcon sx={{ mr: 1 }} fontSize="small" />
                    View Details
                </MenuItem>
                <MenuItem onClick={() => {
                    if (selectedCampaign) navigate(`/campaigns/${selectedCampaign.id}/edit`);
                    handleMenuClose();
                }}>
                    <EditIcon sx={{ mr: 1 }} fontSize="small" />
                    Edit
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setDeleteDialogOpen(true);
                        handleMenuClose();
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
                    Delete
                </MenuItem>
            </Menu>
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Campaign</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{selectedCampaign?.name}"? This action cannot
                        be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
