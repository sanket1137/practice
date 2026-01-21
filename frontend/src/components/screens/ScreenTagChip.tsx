import { Chip, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PersonIcon from '@mui/icons-material/Person';
import { TAG_CATEGORY_COLORS } from '../../types/screen';
import type { ScreenTagSummary, ScreenTagDetail } from '../../types/screen';

interface ScreenTagChipProps {
    tag: ScreenTagSummary | ScreenTagDetail;
    size?: 'small' | 'medium';
    onDelete?: () => void;
    onClick?: () => void;
    showSource?: boolean;
}

const StyledChip = styled(Chip)<{ categorycolor?: string }>(({ categorycolor }) => ({
    backgroundColor: categorycolor ? `${categorycolor}20` : undefined,
    borderColor: categorycolor || undefined,
    '&:hover': {
        backgroundColor: categorycolor ? `${categorycolor}30` : undefined,
    },
    '& .MuiChip-icon': {
        color: categorycolor || undefined,
    },
}));

function getSourceIcon(source: string) {
    switch (source) {
        case 'Auto':
            return <AutoFixHighIcon fontSize="small" />;
        case 'Manual':
        case 'Admin':
            return <PersonIcon fontSize="small" />;
        default:
            return <LocalOfferIcon fontSize="small" />;
    }
}

function getTooltipText(tag: ScreenTagSummary | ScreenTagDetail): string {
    const parts: string[] = [];
    
    // Category
    parts.push(`Category: ${tag.category}`);
    
    // Source
    parts.push(`Source: ${tag.source === 'Auto' ? 'Auto-generated' : 'Manual'}`);
    
    // Score and distance if available (ScreenTagDetail)
    if ('score' in tag && tag.score) {
        parts.push(`Confidence Score: ${tag.score}/1000`);
    }
    if ('distanceMeters' in tag && tag.distanceMeters) {
        parts.push(`Distance: ${tag.distanceMeters}m`);
    }
    if ('poiCount' in tag && tag.poiCount) {
        parts.push(`POI Count: ${tag.poiCount}`);
    }
    
    // Description if available
    if ('description' in tag && tag.description) {
        parts.push(`\n${tag.description}`);
    }
    
    return parts.join('\n');
}

export default function ScreenTagChip({
    tag,
    size = 'small',
    onDelete,
    onClick,
    showSource = true,
}: ScreenTagChipProps) {
    const categoryColor = tag.colorCode || TAG_CATEGORY_COLORS[tag.category] || '#9e9e9e';
    
    return (
        <Tooltip title={getTooltipText(tag)} arrow>
            <StyledChip
                label={tag.displayName}
                size={size}
                variant={tag.isPrimary ? 'filled' : 'outlined'}
                categorycolor={categoryColor}
                icon={showSource ? getSourceIcon(tag.source) : undefined}
                onDelete={onDelete}
                onClick={onClick}
                sx={{
                    fontWeight: tag.isPrimary ? 600 : 400,
                    borderWidth: tag.isPrimary ? 2 : 1,
                }}
            />
        </Tooltip>
    );
}
