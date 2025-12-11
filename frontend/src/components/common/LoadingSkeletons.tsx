import { Box, Skeleton, Card, CardContent, Grid } from '@mui/material';
import { RESPONSIVE_GRID } from '../../constants/layout';

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 6 }: TableSkeletonProps) {
    return (
        <Box>
            {/* Header */}
            <Box display="flex" gap={2} mb={2}>
                {Array.from({ length: columns }).map((_, idx) => (
                    <Skeleton key={idx} variant="text" width="100%" height={40} />
                ))}
            </Box>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <Box key={rowIdx} display="flex" gap={2} mb={1}>
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <Skeleton key={colIdx} variant="text" width="100%" height={30} />
                    ))}
                </Box>
            ))}
        </Box>
    );
}

interface CardSkeletonProps {
    count?: number;
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
    return (
        <Grid container spacing={3}>
            {Array.from({ length: count }).map((_, idx) => (
                <Grid key={idx} item {...RESPONSIVE_GRID.cards}>
                    <Card>
                        <CardContent>
                            <Skeleton variant="text" width="60%" height={30} />
                            <Skeleton variant="text" width="100%" />
                            <Skeleton variant="text" width="80%" />
                            <Box display="flex" gap={1} mt={2}>
                                <Skeleton variant="rectangular" width={80} height={32} />
                                <Skeleton variant="rectangular" width={80} height={32} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );
}

interface StatCardSkeletonProps {
    count?: number;
}

export function StatCardSkeleton({ count = 4 }: StatCardSkeletonProps) {
    return (
        <Grid container spacing={3}>
            {Array.from({ length: count }).map((_, idx) => (
                <Grid key={idx} item {...RESPONSIVE_GRID.stats}>
                    <Card>
                        <CardContent>
                            <Skeleton variant="text" width="50%" height={20} />
                            <Skeleton variant="text" width="40%" height={48} />
                            <Skeleton variant="text" width="60%" height={16} />
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );
}

export function PageSkeleton() {
    return (
        <Box p={3}>
            <Skeleton variant="text" width="30%" height={48} sx={{ mb: 3 }} />
            <StatCardSkeleton />
            <Box mt={4}>
                <TableSkeleton />
            </Box>
        </Box>
    );
}
