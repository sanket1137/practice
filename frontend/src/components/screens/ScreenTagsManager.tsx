import { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Chip,
    Autocomplete,
    TextField,
    CircularProgress,
    Alert,
    Paper,
    Divider,
    IconButton,
    Tooltip,
    Skeleton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
    getScreenTags,
    getAllTags,
    generateScreenTags,
    addScreenTag,
    removeScreenTag,
} from '../../services/screenTagsService';
import ScreenTagChip from './ScreenTagChip';
import type { MasterTag, ScreenTagDetail } from '../../types/screen';
import { TAG_CATEGORY_LABELS } from '../../types/screen';

interface ScreenTagsManagerProps {
    screenId: string;
    readOnly?: boolean;
    compact?: boolean;
}

export default function ScreenTagsManager({
    screenId,
    readOnly = false,
    compact = false,
}: ScreenTagsManagerProps) {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [selectedTagToAdd, setSelectedTagToAdd] = useState<MasterTag | null>(null);

    // Fetch screen's current tags
    const {
        data: screenTags,
        isLoading: tagsLoading,
        error: tagsError,
    } = useQuery({
        queryKey: ['screen-tags', screenId],
        queryFn: () => getScreenTags(screenId),
        enabled: !!screenId,
    });

    // Fetch all available master tags (for adding manual tags)
    const { data: allTags } = useQuery({
        queryKey: ['all-tags'],
        queryFn: () => getAllTags(),
        enabled: !readOnly,
    });

    // Generate tags mutation
    const generateMutation = useMutation({
        mutationFn: (forceRefresh: boolean) => generateScreenTags(screenId, forceRefresh),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['screen-tags', screenId] });
            queryClient.invalidateQueries({ queryKey: ['screen', screenId] });
            enqueueSnackbar(
                `Generated ${result.tagsGenerated} tags (${result.fromCache ? 'from cache' : 'fresh data'})`,
                { variant: 'success' }
            );
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to generate tags',
                { variant: 'error' }
            );
        },
    });

    // Add tag mutation
    const addTagMutation = useMutation({
        mutationFn: (tagId: string) => addScreenTag(screenId, tagId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['screen-tags', screenId] });
            setSelectedTagToAdd(null);
            enqueueSnackbar('Tag added successfully', { variant: 'success' });
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to add tag',
                { variant: 'error' }
            );
        },
    });

    // Remove tag mutation
    const removeTagMutation = useMutation({
        mutationFn: (tagId: string) => removeScreenTag(screenId, tagId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['screen-tags', screenId] });
            enqueueSnackbar('Tag removed', { variant: 'success' });
        },
        onError: (error: any) => {
            enqueueSnackbar(
                error.response?.data?.message || 'Failed to remove tag',
                { variant: 'error' }
            );
        },
    });

    // Get tags not already assigned to screen
    const availableTags = allTags?.filter(
        (tag) => !screenTags?.some((st) => st.tagId === tag.id)
    ) || [];

    // Group tags by category for display
    const groupedTags = screenTags?.reduce((acc, tag) => {
        if (!acc[tag.category]) {
            acc[tag.category] = [];
        }
        acc[tag.category].push(tag);
        return acc;
    }, {} as Record<string, ScreenTagDetail[]>) || {};

    const handleAddTag = () => {
        if (selectedTagToAdd) {
            addTagMutation.mutate(selectedTagToAdd.id);
        }
    };

    if (tagsLoading) {
        return (
            <Box>
                <Skeleton variant="rectangular" height={100} />
            </Box>
        );
    }

    if (tagsError) {
        return (
            <Alert severity="error">
                Failed to load tags. Please try again.
            </Alert>
        );
    }

    // Compact view - just show chips
    if (compact) {
        return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {screenTags?.slice(0, 8).map((tag) => (
                    <ScreenTagChip key={tag.tagId} tag={tag} size="small" showSource={false} />
                ))}
                {(screenTags?.length || 0) > 8 && (
                    <Chip
                        label={`+${(screenTags?.length || 0) - 8} more`}
                        size="small"
                        variant="outlined"
                    />
                )}
            </Box>
        );
    }

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Screen Tags</Typography>
                {!readOnly && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Generate tags based on location">
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={generateMutation.isPending ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                                onClick={() => generateMutation.mutate(false)}
                                disabled={generateMutation.isPending}
                            >
                                Auto-Generate
                            </Button>
                        </Tooltip>
                        <Tooltip title="Force refresh from Google Places">
                            <IconButton
                                size="small"
                                onClick={() => generateMutation.mutate(true)}
                                disabled={generateMutation.isPending}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>

            {/* Tag display by category */}
            {Object.keys(groupedTags).length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    No tags assigned yet. {!readOnly && 'Click "Auto-Generate" to create tags based on location, or add tags manually below.'}
                </Alert>
            ) : (
                <Box sx={{ mb: 2 }}>
                    {Object.entries(groupedTags).map(([category, tags]) => (
                        <Box key={category} sx={{ mb: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                {TAG_CATEGORY_LABELS[category as keyof typeof TAG_CATEGORY_LABELS] || category}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {tags.map((tag) => (
                                    <ScreenTagChip
                                        key={tag.tagId}
                                        tag={tag}
                                        onDelete={
                                            !readOnly && tag.source === 'Manual'
                                                ? () => removeTagMutation.mutate(tag.tagId)
                                                : undefined
                                        }
                                    />
                                ))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Add manual tag */}
            {!readOnly && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                        Add Manual Tag
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Autocomplete
                            size="small"
                            sx={{ flexGrow: 1 }}
                            options={availableTags}
                            groupBy={(option) => TAG_CATEGORY_LABELS[option.category as keyof typeof TAG_CATEGORY_LABELS] || option.category}
                            getOptionLabel={(option) => option.displayName}
                            value={selectedTagToAdd}
                            onChange={(_, value) => setSelectedTagToAdd(value)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="Search tags..."
                                    helperText="Manual tags can be removed. Auto-generated tags will refresh when you regenerate."
                                />
                            )}
                            renderOption={(props, option) => (
                                <Box component="li" {...props}>
                                    <Box>
                                        <Typography variant="body2">{option.displayName}</Typography>
                                        {option.description && (
                                            <Typography variant="caption" color="text.secondary">
                                                {option.description}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            )}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={addTagMutation.isPending ? <CircularProgress size={16} /> : <AddIcon />}
                            onClick={handleAddTag}
                            disabled={!selectedTagToAdd || addTagMutation.isPending}
                        >
                            Add
                        </Button>
                    </Box>
                </>
            )}
        </Paper>
    );
}
