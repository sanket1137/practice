import { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Card,
    CardContent,
    Divider,
    Skeleton,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PeopleIcon from '@mui/icons-material/People';
import PlaceIcon from '@mui/icons-material/Place';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import { useQuery } from '@tanstack/react-query';
import { getScreenTags } from '../../services/screenTagsService';
import ScreenTagChip from './ScreenTagChip';
import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS } from '../../types/screen';
import type { ScreenTagDetail } from '../../types/screen';

interface ScreenTagsTabProps {
    screenId: string;
}

// Group tags by category
function groupTagsByCategory(tags: ScreenTagDetail[]): Record<string, ScreenTagDetail[]> {
    return tags.reduce((acc, tag) => {
        const category = tag.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(tag);
        return acc;
    }, {} as Record<string, ScreenTagDetail[]>);
}

// Get audience insights from tags
function getAudienceInsights(tags: ScreenTagDetail[]): string[] {
    const insights: string[] = [];
    
    const categoryMap = groupTagsByCategory(tags);
    
    // Transportation insights
    if (categoryMap['Transportation']?.length) {
        const transportTags = categoryMap['Transportation'].map(t => t.displayName.toLowerCase());
        if (transportTags.some(t => t.includes('airport') || t.includes('flight'))) {
            insights.push('High exposure to travelers and business professionals');
        }
        if (transportTags.some(t => t.includes('metro') || t.includes('subway') || t.includes('bus') || t.includes('transit'))) {
            insights.push('Daily commuter audience with repeat exposure potential');
        }
        if (transportTags.some(t => t.includes('train') || t.includes('railway'))) {
            insights.push('Inter-city travelers and commuters');
        }
    }
    
    // Food & Beverage insights
    if (categoryMap['FoodAndBeverage']?.length) {
        const foodTags = categoryMap['FoodAndBeverage'].map(t => t.displayName.toLowerCase());
        if (foodTags.some(t => t.includes('cafe') || t.includes('coffee'))) {
            insights.push('Young professionals and students frequent this area');
        }
        if (foodTags.some(t => t.includes('restaurant') || t.includes('dining'))) {
            insights.push('Dining audience - ideal for F&B and lifestyle brands');
        }
    }
    
    // Retail insights
    if (categoryMap['Retail']?.length) {
        insights.push('Active shopping district with high purchase intent');
    }
    
    // Education insights
    if (categoryMap['Education']?.length) {
        insights.push('Student and academic audience concentration');
    }
    
    // Healthcare insights
    if (categoryMap['Healthcare']?.length) {
        insights.push('Health-conscious audience and medical professionals');
    }
    
    // Corporate insights
    if (categoryMap['Corporate']?.length) {
        insights.push('Business district with professional audience');
    }
    
    // Entertainment insights
    if (categoryMap['Entertainment']?.length) {
        insights.push('Entertainment seekers and leisure audience');
    }
    
    return insights;
}

// Category order for display
const CATEGORY_DISPLAY_ORDER = [
    'AudienceProfile',
    'Transportation',
    'FoodAndBeverage',
    'Retail',
    'Corporate',
    'Education',
    'Healthcare',
    'Entertainment',
    'Hospitality',
    'Financial',
    'Religious',
    'Government',
    'Residential',
    'Industrial',
    'TimeBased',
    'Economic',
    'Lifestyle',
];

export default function ScreenTagsTab({ screenId }: ScreenTagsTabProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | false>('AudienceProfile');

    const { data: tags, isLoading, error } = useQuery({
        queryKey: ['screen-tags', screenId],
        queryFn: () => getScreenTags(screenId),
    });

    if (isLoading) {
        return (
            <Box>
                <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={150} />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Failed to load screen tags. Please try again.
            </Alert>
        );
    }

    if (!tags || tags.length === 0) {
        return (
            <Alert severity="info" icon={<LocalOfferIcon />}>
                No tags available for this screen yet. Tags help you understand the audience and context of this advertising location.
            </Alert>
        );
    }

    const groupedTags = groupTagsByCategory(tags);
    const primaryTags = tags.filter(t => t.isPrimary);
    const audienceInsights = getAudienceInsights(tags);

    // Sort categories by display order
    const sortedCategories = Object.keys(groupedTags).sort((a, b) => {
        const indexA = CATEGORY_DISPLAY_ORDER.indexOf(a);
        const indexB = CATEGORY_DISPLAY_ORDER.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return (
        <Box>
            {/* Primary Tags Summary */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <LocalOfferIcon color="primary" />
                    <Typography variant="h6">Primary Location Tags</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                    These are the key characteristics of this screen's location, helping you target the right audience.
                </Typography>
                
                <Box display="flex" flexWrap="wrap" gap={1}>
                    {primaryTags.length > 0 ? (
                        primaryTags.map(tag => (
                            <ScreenTagChip key={tag.tagId} tag={tag} size="medium" />
                        ))
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            No primary tags assigned
                        </Typography>
                    )}
                </Box>
            </Paper>

            {/* Audience Insights */}
            {audienceInsights.length > 0 && (
                <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50', borderLeft: 4, borderColor: 'primary.main' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <PeopleIcon color="primary" />
                        <Typography variant="h6">Audience Insights</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Based on the location context, here's what you can expect from this screen's audience:
                    </Typography>
                    <Grid container spacing={2}>
                        {audienceInsights.map((insight, index) => (
                            <Grid key={index} size={{ xs: 12, sm: 6 }}>
                                <Box display="flex" alignItems="flex-start" gap={1}>
                                    <TrendingUpIcon fontSize="small" color="success" sx={{ mt: 0.3 }} />
                                    <Typography variant="body2">{insight}</Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Paper>
            )}

            {/* All Tags by Category */}
            <Paper sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <CategoryIcon color="primary" />
                    <Typography variant="h6">All Tags by Category</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Complete breakdown of location context and nearby points of interest.
                </Typography>

                {sortedCategories.map(category => (
                    <Accordion
                        key={category}
                        expanded={expandedCategory === category}
                        onChange={(_, isExpanded) => setExpandedCategory(isExpanded ? category : false)}
                        sx={{ 
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:not(:last-child)': { mb: 1 },
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box display="flex" alignItems="center" gap={2} width="100%">
                                <Chip
                                    size="small"
                                    label={groupedTags[category].length}
                                    sx={{
                                        bgcolor: TAG_CATEGORY_COLORS[category] || '#9e9e9e',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        minWidth: 32,
                                    }}
                                />
                                <Typography variant="subtitle1" fontWeight={500}>
                                    {TAG_CATEGORY_LABELS[category as keyof typeof TAG_CATEGORY_LABELS] || category}
                                </Typography>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {groupedTags[category].map(tag => (
                                    <ScreenTagChip key={tag.tagId} tag={tag} />
                                ))}
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Paper>

            {/* Location Context Summary */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <PlaceIcon color="primary" />
                        <Typography variant="h6">Location Summary</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="body2" color="text.secondary">Total Tags</Typography>
                            <Typography variant="h5">{tags.length}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="body2" color="text.secondary">Categories</Typography>
                            <Typography variant="h5">{sortedCategories.length}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="body2" color="text.secondary">Primary Tags</Typography>
                            <Typography variant="h5">{primaryTags.length}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Typography variant="body2" color="text.secondary">Auto-generated</Typography>
                            <Typography variant="h5">{tags.filter(t => t.source === 'Auto').length}</Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Box>
    );
}
