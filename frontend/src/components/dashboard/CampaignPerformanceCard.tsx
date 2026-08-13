import { Box, Paper, Typography, Grid, Chip, Skeleton, Button, Avatar } from '@mui/material';
import { Campaign as CampaignIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

interface Campaign {
    id: string;
    name: string;
    status: string;
    budget: number;
    currency: string;
    startDate: string;
    endDate: string;
}

export default function CampaignPerformanceCard() {
    const navigate = useNavigate();

    const { data: campaigns, isLoading } = useQuery<Campaign[]>({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const response = await api.get('/campaigns');
            return response.data?.data || [];
        },
    });

    if (isLoading) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Campaign Performance</Typography>
                <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
            </Paper>
        );
    }

    const activeCampaigns = campaigns?.filter(c => c.status === 'Active') || [];
    const draftCampaigns = campaigns?.filter(c => c.status === 'Draft') || [];
    const totalBudget = activeCampaigns.reduce((sum, c) => sum + c.budget, 0);
    const currency = activeCampaigns[0]?.currency || 'INR';

    const getStatusColor = (status: string): 'success' | 'default' | 'warning' | 'info' => {
        switch (status) {
            case 'Active': return 'success';
            case 'Draft': return 'default';
            case 'Paused': return 'warning';
            case 'Completed': return 'info';
            default: return 'default';
        }
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">Campaign Performance</Typography>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<CampaignIcon />}
                    onClick={() => navigate('/campaigns/new')}
                >
                    New Campaign
                </Button>
            </Box>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 4 }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'primary.lighter',
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" color="primary.dark" fontWeight="bold">
                            {campaigns?.length || 0}
                        </Typography>
                        <Typography variant="body2" color="primary.dark">
                            Total
                        </Typography>
                    </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'success.lighter',
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" color="success.dark" fontWeight="bold">
                            {activeCampaigns.length}
                        </Typography>
                        <Typography variant="body2" color="success.dark">
                            Active
                        </Typography>
                    </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'grey.100',
                            borderRadius: 2,
                        }}
                    >
                        <Typography variant="h4" color="text.primary" fontWeight="bold">
                            {draftCampaigns.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Drafts
                        </Typography>
                    </Box>
                </Grid>
            </Grid>

            {/* Active Budget */}
            {activeCampaigns.length > 0 && (
                <Box
                    sx={{
                        p: 2,
                        mb: 3,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Active Campaign Budget
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                        {currency} {totalBudget.toLocaleString()}
                    </Typography>
                </Box>
            )}

            {/* Campaign List */}
            {campaigns?.length === 0 ? (
                <Box textAlign="center" py={4}>
                    <CampaignIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No campaigns yet</Typography>
                    <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={() => navigate('/campaigns/new')}
                    >
                        Create Your First Campaign
                    </Button>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {campaigns?.slice(0, 4).map((campaign) => (
                        <Box
                            key={campaign.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'action.hover',
                                },
                            }}
                            onClick={() => navigate(`/campaigns/${campaign.id}`)}
                        >
                            <Avatar sx={{ bgcolor: 'primary.light' }}>
                                <CampaignIcon />
                            </Avatar>
                            <Box flex={1}>
                                <Typography variant="subtitle2" fontWeight="medium">
                                    {campaign.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {campaign.currency} {campaign.budget.toLocaleString()} budget
                                </Typography>
                            </Box>
                            <Chip
                                label={campaign.status}
                                color={getStatusColor(campaign.status)}
                                size="small"
                            />
                        </Box>
                    ))}
                </Box>
            )}

            {(campaigns?.length || 0) > 4 && (
                <Box textAlign="center" mt={2}>
                    <Button size="small" onClick={() => navigate('/campaigns')}>
                        View All {campaigns?.length} Campaigns
                    </Button>
                </Box>
            )}
        </Paper>
    );
}
