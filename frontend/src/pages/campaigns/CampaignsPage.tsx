import { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    TextField,
    InputAdornment,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

interface Campaign {
    id: string;
    name: string;
    description: string;
    status: string;
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
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Fetch campaigns
    const { data: campaigns, isLoading } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            return response.data.data; // ApiResponse wrapper
        },
    });

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

    const handleView = () => {
        if (selectedCampaign) {
            navigate(`/campaigns/${selectedCampaign.id}`);
        }
        handleMenuClose();
    };

    const handleEdit = () => {
        if (selectedCampaign) {
            navigate(`/campaigns/${selectedCampaign.id}/edit`);
        }
        handleMenuClose();
    };

    const handleDeleteClick = () => {
        setDeleteDialogOpen(true);
        handleMenuClose();
    };

    const handleDeleteConfirm = () => {
        if (selectedCampaign) {
            deleteMutation.mutate(selectedCampaign.id);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active':
                return 'success';
            case 'Completed':
                return 'default';
            case 'Draft':
                return 'warning';
            default:
                return 'default';
        }
    };

    const filteredCampaigns = campaigns?.filter((campaign) =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <LinearProgress />
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

            {/* Search */}
            <Box mb={3}>
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
            </Box>

            {/* Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Budget</TableCell>
                            <TableCell>Start Date</TableCell>
                            <TableCell>End Date</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredCampaigns && filteredCampaigns.length > 0 ? (
                            filteredCampaigns.map((campaign) => (
                                <TableRow
                                    key={campaign.id}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                                >
                                    <TableCell>
                                        <Typography variant="subtitle2">{campaign.name}</Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            {campaign.description.substring(0, 50)}
                                            {campaign.description.length > 50 ? '...' : ''}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={campaign.status}
                                            color={getStatusColor(campaign.status) as any}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {campaign.currency} {campaign.budget.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(campaign.startDate).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(campaign.endDate).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(campaign.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMenuOpen(e, campaign);
                                            }}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Box py={4}>
                                        <Typography color="textSecondary" gutterBottom>
                                            No campaigns found
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            onClick={() => navigate('/campaigns/new')}
                                            sx={{ mt: 2 }}
                                        >
                                            Create Your First Campaign
                                        </Button>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleView}>
                    <ViewIcon sx={{ mr: 1 }} fontSize="small" />
                    View Details
                </MenuItem>
                <MenuItem onClick={handleEdit}>
                    <EditIcon sx={{ mr: 1 }} fontSize="small" />
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                    <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
                    Delete
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Campaign</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{selectedCampaign?.name}"? This action cannot be
                        undone.
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
