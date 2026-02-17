import {
    Card,
    CardContent,
    Typography,
    Box,
    LinearProgress,
    Stack,
    Divider,
} from '@mui/material';
import {
    Campaign as CampaignIcon,
    CalendarToday,
} from '@mui/icons-material';
import { format } from 'date-fns';
import StatusChip from '../common/StatusChip';
import type { CampaignStatus } from '../../constants/statusConfig';

interface Campaign {
    id: string;
    name: string;
    status: CampaignStatus;
    budget: number;
    spent: number;
    currency: string;
    startDate: string;
    endDate: string;
    impressions?: number;
    expectedImpressions?: number;
}

interface CampaignCardProps {
    campaign: Campaign;
    onClick?: () => void;
}

export default function EnhancedCampaignCard({ campaign, onClick }: CampaignCardProps) {
    const budgetPercentage = (campaign.spent / campaign.budget) * 100;
    const impressionPercentage = campaign.expectedImpressions
        ? ((campaign.impressions || 0) / campaign.expectedImpressions) * 100
        : 0;

    const daysTotal = Math.ceil(
        (new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.max(
        0,
        Math.ceil(
            (Date.now() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24)
        )
    );
    const timeProgress = Math.min(100, (daysElapsed / daysTotal) * 100);

    return (
        <Card
            sx={{
                cursor: onClick ? 'pointer' : 'default',
                '&:hover': onClick ? { boxShadow: 4 } : {},
                transition: 'box-shadow 0.3s',
            }}
            onClick={onClick}
        >
            <CardContent>
                {/* Header */}
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <CampaignIcon color="primary" />
                        <Typography variant="h6" noWrap>
                            {campaign.name}
                        </Typography>
                    </Box>
                    <StatusChip status={campaign.status} type="campaign" />
                </Box>

                {/* Metrics */}
                <Stack spacing={2}>
                    {/* Budget */}
                    <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                Budget
                            </Typography>
                            <Typography variant="caption" fontWeight="medium">
                                {campaign.currency}{campaign.spent.toLocaleString()} / {campaign.currency}
                                {campaign.budget.toLocaleString()}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(budgetPercentage, 100)}
                            color={budgetPercentage > 90 ? 'warning' : 'primary'}
                            sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {budgetPercentage.toFixed(1)}% spent
                        </Typography>
                    </Box>

                    {/* Impressions (if available) */}
                    {campaign.expectedImpressions && (
                        <Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                    Impressions
                                </Typography>
                                <Typography variant="caption" fontWeight="medium">
                                    {(campaign.impressions || 0).toLocaleString()} /{' '}
                                    {campaign.expectedImpressions.toLocaleString()}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(impressionPercentage, 100)}
                                color="success"
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>
                    )}

                    {/* Timeline */}
                    <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                Timeline
                            </Typography>
                            <Typography variant="caption" fontWeight="medium">
                                Day {Math.min(daysElapsed, daysTotal)} of {daysTotal}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={timeProgress}
                            color="info"
                            sx={{ height: 6, borderRadius: 3 }}
                        />
                    </Box>

                    <Divider />

                    {/* Date Range */}
                    <Box display="flex" alignItems="center" gap={1}>
                        <CalendarToday fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                            {format(new Date(campaign.startDate), 'MMM dd, yyyy')} -{' '}
                            {format(new Date(campaign.endDate), 'MMM dd, yyyy')}
                        </Typography>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}
