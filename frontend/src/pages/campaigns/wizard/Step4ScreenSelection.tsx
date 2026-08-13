import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VerifiedIcon from '@mui/icons-material/Verified';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import StayCurrentLandscapeIcon from '@mui/icons-material/StayCurrentLandscape';
import StayCurrentPortraitIcon from '@mui/icons-material/StayCurrentPortrait';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import GridViewIcon from '@mui/icons-material/GridView';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Grid from '@mui/material/Grid';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { recommendationsApi } from '../../../services/recommendationsApi';
import { useScreenSearch } from '../../../hooks/useCampaignWizardData';
import { step4Schema } from '../../../types/campaignWizard';
import type { Step4Values } from '../../../types/campaignWizard';
import type { Screen, SearchScreensRequest } from '../../../types/screen';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const selectedIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Step4Props {
  onNext: () => void;
}

type SortKey = 'recommended' | 'distance' | 'priceAsc' | 'priceDesc' | 'impressions' | 'cpm';

const SORT_OPTIONS: { value: SortKey; label: string; backend?: string; direction?: 'asc' | 'desc' }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'distance', label: 'Nearest first', backend: 'distance', direction: 'asc' },
  { value: 'priceAsc', label: 'Price · low to high', backend: 'price', direction: 'asc' },
  { value: 'priceDesc', label: 'Price · high to low', backend: 'price', direction: 'desc' },
  { value: 'impressions', label: 'Most impressions', backend: 'impressions', direction: 'desc' },
  { value: 'cpm', label: 'Best CPM', backend: 'cpm', direction: 'asc' },
];

const SLOTS_PER_DAY = 6 * 24; // 6 ten-minute slots per hour × 24 hours

export function Step4ScreenSelection({ onNext }: Step4Props) {
  const { step1, step2, step3, step4: savedData, setStep4, setSelectedScreens } = useCampaignWizardStore();
  const [selectedIds, setSelectedIds] = useState<string[]>(savedData?.selectedScreenIds ?? []);
  const [activeTab, setActiveTab] = useState<'recommended' | 'all' | 'map'>('recommended');
  const [sortKey, setSortKey] = useState<SortKey>('recommended');
  const [searchText, setSearchText] = useState('');

  // Build search filters from step2 + local sort/search
  const sortOpt = SORT_OPTIONS.find((s) => s.value === sortKey);
  const searchFilters: SearchScreensRequest = useMemo(
    () => ({
      searchText: searchText || undefined,
      city: step2?.city || undefined,
      state: step2?.state || undefined,
      country: step2?.country || undefined,
      latitude: step2?.latitude,
      longitude: step2?.longitude,
      radiusKm:
        step2?.latitude != null && step2?.longitude != null ? step2?.radiusKm : undefined,
      requiredTagIds: step2?.tagIds?.length ? step2.tagIds : undefined,
      displayType: step2?.displayType || undefined,
      orientation: step2?.orientation || undefined,
      minDailyImpressions: step2?.minDailyImpressions,
      operatingAtHour: step2?.operatingAtHour,
      onlineOnly: step2?.onlineOnly || undefined,
      availableFrom: step3?.startDate,
      availableTo: step3?.endDate,
      status: 'Active',
      page: 1,
      pageSize: 100,
      sortBy: sortOpt?.backend,
      sortDirection: sortOpt?.direction,
    }),
    [step2, step3, searchText, sortOpt],
  );

  const { data: searchResult, isFetching: searchLoading } = useScreenSearch(searchFilters, true);
  // Memoized so `screens` has a stable reference across renders when there's no
  // result yet (`searchResult?.screens ?? []` would otherwise create a new
  // array every render, breaking memoization of everything derived from it).
  const screens = useMemo(() => searchResult?.screens ?? [], [searchResult]);

  const { data: recommendations = [], isLoading: recLoading } = useQuery({
    queryKey: ['wizard-recommendations', step1, step2, step3],
    queryFn: () =>
      recommendationsApi.getRecommendations({
        objective: step1?.objective,
        targetCity: step2?.city,
        targetLat: step2?.latitude,
        targetLng: step2?.longitude,
        targetRadius: step2?.radiusKm,
        budget: step3?.budget,
        dateFrom: step3?.startDate,
        dateTo: step3?.endDate,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'recommended',
  });

  // Build a fast lookup from screenId -> rec score for badge rendering on cards
  const recommendationByScreen = useMemo(() => {
    const m = new Map<string, { score: number; reasons: string[] }>();
    recommendations.forEach((r) =>
      m.set(r.screen.id, { score: r.matchScore, reasons: r.matchReasons }),
    );
    return m;
  }, [recommendations]);

  // Hydrate full Screen objects for recommended IDs by merging search results, falling
  // back to the lightweight rec payload when the screen isn't in the current page.
  const recommendedScreens: Screen[] = useMemo(() => {
    return recommendations.map((r) => {
      const full = screens.find((s) => s.id === r.screen.id);
      if (full) return full;
      return {
        id: r.screen.id,
        name: r.screen.name,
        description: r.screen.description ?? '',
        status: r.screen.status,
        pricePerSlot: r.screen.pricePerSlot,
        currency: r.screen.currency,
        latitude: r.screen.latitude,
        longitude: r.screen.longitude,
        location: r.screen.location
          ? {
              city: r.screen.location.city ?? '',
              state: r.screen.location.state ?? '',
              street: '',
              country: '',
              postalCode: '',
            }
          : undefined,
        audienceQualityScore: r.screen.audienceQualityScore,
        primaryImage: r.screen.primaryImageUrl
          ? {
              id: 'rec-' + r.screen.id,
              imageUrl: r.screen.primaryImageUrl,
              imageType: 'Screen' as const,
              displayOrder: 0,
              isPrimary: true,
              uploadedAt: new Date().toISOString(),
            }
          : undefined,
        createdAt: new Date().toISOString(),
      } as Screen;
    });
  }, [recommendations, screens]);

  const visibleScreens = activeTab === 'recommended' ? recommendedScreens : screens;

  const { handleSubmit, setValue, formState: { errors } } = useForm<Step4Values>({
    resolver: zodResolver(step4Schema),
    defaultValues: { selectedScreenIds: selectedIds },
  });

  useEffect(() => {
    setValue('selectedScreenIds', selectedIds);
  }, [selectedIds, setValue]);

  const toggleScreen = (screen: Screen | { id: string }) => {
    setSelectedIds((prev) =>
      prev.includes(screen.id) ? prev.filter((id) => id !== screen.id) : [...prev, screen.id],
    );
  };

  const onSubmit = (data: Step4Values) => {
    setStep4(data);
    // Persist full Screen objects for the selected IDs so downstream steps
    // (creative attachment, review) can render specs without re-fetching.
    const picked: Screen[] = [];
    const seen = new Set<string>();
    for (const id of data.selectedScreenIds) {
      if (seen.has(id)) continue;
      const s = allKnownScreens.get(id);
      if (s) {
        picked.push(s);
        seen.add(id);
      }
    }
    setSelectedScreens(picked);
    onNext();
  };

  // Lookup of all screens we've seen (search + recommendations) so the summary
  // panel can render details for screens selected on different tabs. React
  // Compiler can't verify this memoization even though `screens` and
  // `recommendedScreens` are both themselves stably memoized above; this Map
  // merge is cheap and correctness doesn't depend on the compiler's auto-memo.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- see comment above
  const allKnownScreens = useMemo(() => {
    const m = new Map<string, Screen>();
    screens.forEach((s) => m.set(s.id, s));
    recommendedScreens.forEach((s) => {
      if (!m.has(s.id)) m.set(s.id, s);
    });
    return m;
  }, [screens, recommendedScreens]);

  const estimatedDays = step3?.startDate && step3?.endDate
    ? Math.max(
        1,
        Math.round(
          (new Date(step3.endDate).getTime() - new Date(step3.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1,
      )
    : 7;

  const selectionStats = useMemo(() => {
    let cost = 0;
    let impressions = 0;
    for (const id of selectedIds) {
      const s = allKnownScreens.get(id);
      if (!s) continue;
      cost += (s.pricePerSlot ?? 0) * SLOTS_PER_DAY * estimatedDays;
      impressions += (s.dailyTotalImpressions ?? 0) * estimatedDays;
    }
    const budget = step3?.budget ?? 0;
    return { cost, impressions, budget, pctOfBudget: budget > 0 ? (cost / budget) * 100 : 0 };
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- cascades from allKnownScreens above, which the compiler already can't auto-memo; see comment there
  }, [selectedIds, allKnownScreens, estimatedDays, step3?.budget]);

  const mapCenter: [number, number] = useMemo(() => {
    const anchored = visibleScreens.find((s) => s.latitude != null && s.longitude != null);
    if (anchored) return [anchored.latitude!, anchored.longitude!];
    if (step2?.latitude != null && step2?.longitude != null) {
      return [step2.latitude, step2.longitude];
    }
    return [20.5937, 78.9629];
  }, [visibleScreens, step2]);

  return (
    <Box component="form" id="wizard-step-form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.primary' }}>
          Choose your screens
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Browse screens that match your audience targeting. Click to select — your campaign will run on every selected screen.
        </Typography>
      </Stack>

      {errors.selectedScreenIds && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {errors.selectedScreenIds.message}
        </Typography>
      )}

      <Grid container spacing={3}>
        {/* ───────── LEFT: tabs + filters + cards ───────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              value="recommended"
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <AutoAwesomeIcon fontSize="small" />
                  <span>Recommended</span>
                </Stack>
              }
            />
            <Tab
              value="all"
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <GridViewIcon fontSize="small" />
                  <span>All screens ({searchResult?.totalCount ?? screens.length})</span>
                </Stack>
              }
            />
            <Tab
              value="map"
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MapOutlinedIcon fontSize="small" />
                  <span>Map</span>
                </Stack>
              }
            />
          </Tabs>

          {activeTab !== 'map' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search screen name…"
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                size="small"
                label="Sort by"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                sx={{ minWidth: { xs: '100%', sm: 220 } }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <MenuItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.value === 'recommended' && activeTab !== 'recommended'}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {(searchLoading || (activeTab === 'recommended' && recLoading)) && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          {activeTab === 'map' ? (
            <Box
              sx={{
                height: 540,
                borderRadius: 1,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MarkerClusterGroup chunkedLoading>
                  {screens
                    .filter((s) => s.latitude != null && s.longitude != null)
                    .map((s) => (
                      <Marker
                        key={s.id}
                        position={[s.latitude!, s.longitude!]}
                        icon={selectedIds.includes(s.id) ? selectedIcon : new L.Icon.Default()}
                        eventHandlers={{ click: () => toggleScreen(s) }}
                      >
                        <Popup>
                          <Typography variant="subtitle2">{s.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {s.location?.city ?? ''}
                            {s.distanceKm != null ? ` · ${s.distanceKm.toFixed(1)} km` : ''}
                          </Typography>
                          <Typography variant="body2">
                            ₹{(s.pricePerSlot ?? 0).toFixed(0)} / slot
                          </Typography>
                          <Button
                            size="small"
                            variant={selectedIds.includes(s.id) ? 'outlined' : 'contained'}
                            onClick={() => toggleScreen(s)}
                            sx={{ mt: 1 }}
                          >
                            {selectedIds.includes(s.id) ? 'Remove' : 'Add to campaign'}
                          </Button>
                        </Popup>
                      </Marker>
                    ))}
                </MarkerClusterGroup>
              </MapContainer>
            </Box>
          ) : (
            <ScreenCardGrid
              screens={visibleScreens}
              selectedIds={selectedIds}
              onToggle={toggleScreen}
              recommendationByScreen={recommendationByScreen}
              loading={
                activeTab === 'recommended'
                  ? recLoading && recommendedScreens.length === 0
                  : searchLoading && screens.length === 0
              }
              emptyHint={
                activeTab === 'recommended'
                  ? 'No recommendations yet — adjust your audience targeting in Step 2 to see suggestions.'
                  : 'No screens match. Loosen the audience filters or expand the search radius.'
              }
            />
          )}
        </Grid>

        {/* ───────── RIGHT: selection summary ───────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Your selection
                  </Typography>
                  <Badge
                    badgeContent={selectedIds.length}
                    color="primary"
                    showZero
                    sx={{ '& .MuiBadge-badge': { right: -4, top: 4 } }}
                  >
                    <ScreenshotMonitorIcon color="action" />
                  </Badge>
                </Stack>

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Estimated campaign cost ({estimatedDays} days)
                    </Typography>
                    <Typography variant="h4" color="primary.main" sx={{ lineHeight: 1.1 }}>
                      ₹{selectionStats.cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Typography>
                  </Box>

                  {selectionStats.budget > 0 && (
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          of ₹{selectionStats.budget.toLocaleString('en-IN')} budget
                        </Typography>
                        <Typography
                          variant="caption"
                          color={selectionStats.pctOfBudget > 100 ? 'error.main' : 'text.secondary'}
                          fontWeight={600}
                        >
                          {selectionStats.pctOfBudget.toFixed(0)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, selectionStats.pctOfBudget)}
                        color={selectionStats.pctOfBudget > 100 ? 'error' : 'primary'}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  )}

                  <Divider />

                  <Stack direction="row" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Projected impressions
                      </Typography>
                      <Typography variant="h6">
                        {selectionStats.impressions >= 1000
                          ? `${(selectionStats.impressions / 1000).toFixed(1)}K`
                          : selectionStats.impressions.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Total slots
                      </Typography>
                      <Typography variant="h6">
                        {(selectedIds.length * SLOTS_PER_DAY * estimatedDays).toLocaleString()}
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  {selectedIds.length === 0 ? (
                    <Box sx={{ py: 2, textAlign: 'center' }}>
                      <ScreenshotMonitorIcon sx={{ color: 'text.disabled', fontSize: 36 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        No screens selected yet
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Click any card to add it to your campaign.
                      </Typography>
                    </Box>
                  ) : (
                    <List dense disablePadding sx={{ maxHeight: 280, overflow: 'auto' }}>
                      {selectedIds.map((id) => {
                        const s = allKnownScreens.get(id);
                        return (
                          <ListItem
                            key={id}
                            disableGutters
                            secondaryAction={
                              <IconButton size="small" onClick={() => toggleScreen({ id })}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar
                                variant="rounded"
                                src={s?.primaryImage?.imageUrl}
                                sx={{ width: 36, height: 36 }}
                              >
                                <ScreenshotMonitorIcon fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Typography variant="body2" fontWeight={500} noWrap>
                                  {s?.name ?? 'Screen'}
                                </Typography>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {s?.location?.city ?? ''} · ₹{(s?.pricePerSlot ?? 0).toFixed(0)}/slot
                                </Typography>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

/* ─────────────────────────── Card grid + Card ─────────────────────────── */

interface ScreenCardGridProps {
  screens: Screen[];
  selectedIds: string[];
  onToggle: (s: Screen) => void;
  recommendationByScreen: Map<string, { score: number; reasons: string[] }>;
  loading: boolean;
  emptyHint: string;
}

function ScreenCardGrid({
  screens,
  selectedIds,
  onToggle,
  recommendationByScreen,
  loading,
  emptyHint,
}: ScreenCardGridProps) {
  if (loading) {
    return (
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid size={{ xs: 12, sm: 6 }} key={i}>
            <Card variant="outlined">
              <Skeleton variant="rectangular" height={140} />
              <CardContent>
                <Skeleton width="80%" />
                <Skeleton width="50%" />
                <Skeleton width="60%" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }
  if (screens.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <ScreenshotMonitorIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="body1" sx={{ mt: 1 }} color="text.secondary">
          {emptyHint}
        </Typography>
      </Box>
    );
  }
  return (
    <Grid container spacing={2}>
      {screens.map((s) => (
        <Grid size={{ xs: 12, sm: 6 }} key={s.id}>
          <ScreenCard
            screen={s}
            selected={selectedIds.includes(s.id)}
            onToggle={() => onToggle(s)}
            recommendation={recommendationByScreen.get(s.id)}
          />
        </Grid>
      ))}
    </Grid>
  );
}

interface ScreenCardProps {
  screen: Screen;
  selected: boolean;
  onToggle: () => void;
  recommendation?: { score: number; reasons: string[] };
}

function ScreenCard({ screen, selected, onToggle, recommendation }: ScreenCardProps) {
  const cpm = screen.cpm;
  const imp = screen.dailyTotalImpressions;
  const primaryTags = screen.primaryTags ?? screen.tags?.slice(0, 3) ?? [];

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'rgba(99,102,241,0.06)' : 'background.paper',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
      }}
    >
      {/* Selection check overlay */}
      {selected && (
        <CheckCircleIcon
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'primary.main',
            bgcolor: 'background.paper',
            borderRadius: '50%',
            zIndex: 2,
            fontSize: 26,
          }}
        />
      )}

      {/* Recommendation score badge */}
      {recommendation && (
        <Tooltip title={recommendation.reasons.join(' • ')} arrow placement="top">
          <Chip
            icon={<StarRoundedIcon sx={{ fontSize: 16 }} />}
            label={`${Math.round(recommendation.score)} match`}
            size="small"
            color={recommendation.score >= 80 ? 'primary' : 'default'}
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              fontWeight: 600,
              bgcolor:
                recommendation.score >= 80 ? 'primary.main' : 'rgba(15,23,42,0.85)',
              color: 'common.white',
            }}
          />
        </Tooltip>
      )}

      <CardActionArea
        onClick={onToggle}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Image / placeholder */}
        <Box
          sx={{
            position: 'relative',
            aspectRatio: '16 / 9',
            bgcolor: 'background.default',
            overflow: 'hidden',
          }}
        >
          {screen.primaryImage?.imageUrl ? (
            <Box
              component="img"
              src={screen.primaryImage.imageUrl}
              alt={screen.name}
              loading="lazy"
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScreenshotMonitorIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
            </Box>
          )}

          {/* Bottom-right online + orientation indicators */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
            }}
          >
            {screen.orientation === 'Portrait' ? (
              <Tooltip title="Portrait">
                <StayCurrentPortraitIcon
                  fontSize="small"
                  sx={{ color: 'common.white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
                />
              </Tooltip>
            ) : screen.orientation === 'Landscape' ? (
              <Tooltip title="Landscape">
                <StayCurrentLandscapeIcon
                  fontSize="small"
                  sx={{ color: 'common.white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
                />
              </Tooltip>
            ) : null}
            {screen.isOnline && (
              <Tooltip title="Online now">
                <OnlinePredictionIcon
                  fontSize="small"
                  sx={{ color: 'success.light', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
                />
              </Tooltip>
            )}
          </Stack>
        </Box>

        <CardContent sx={{ flex: 1, pb: '12px !important' }}>
          {/* Title + verified */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {screen.name}
            </Typography>
            {screen.verificationStatus === 'Verified' && (
              <Tooltip title="Verified screen">
                <VerifiedIcon sx={{ color: 'primary.main', fontSize: 16 }} />
              </Tooltip>
            )}
          </Stack>

          {/* Owner + location */}
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ color: 'text.secondary', mb: 1 }}
          >
            {screen.ownerDisplayName && (
              <Typography variant="caption" noWrap>
                {screen.ownerDisplayName}
                {screen.ownerIsVerified && (
                  <VerifiedIcon
                    sx={{ fontSize: 12, color: 'primary.main', ml: 0.25, verticalAlign: 'middle' }}
                  />
                )}
                {' · '}
              </Typography>
            )}
            <PlaceOutlinedIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" noWrap sx={{ flex: 1 }}>
              {screen.location?.city ?? '—'}
              {screen.distanceKm != null ? ` · ${screen.distanceKm.toFixed(1)} km` : ''}
            </Typography>
          </Stack>

          {/* Stats grid: impressions / cpm / price */}
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid size={4}>
              <StatPair
                icon={<VisibilityOutlinedIcon sx={{ fontSize: 14 }} />}
                label="Imp/day"
                value={
                  imp == null
                    ? '—'
                    : imp >= 1000
                    ? `${(imp / 1000).toFixed(1)}K`
                    : imp.toLocaleString()
                }
              />
            </Grid>
            <Grid size={4}>
              <StatPair
                icon={<CurrencyRupeeIcon sx={{ fontSize: 14 }} />}
                label="CPM"
                value={cpm == null ? '—' : `₹${cpm.toFixed(0)}`}
              />
            </Grid>
            <Grid size={4}>
              <StatPair
                icon={<CurrencyRupeeIcon sx={{ fontSize: 14 }} />}
                label="/ slot"
                value={`₹${(screen.pricePerSlot ?? 0).toFixed(0)}`}
              />
            </Grid>
          </Grid>

          {/* Tags row */}
          {primaryTags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {primaryTags.slice(0, 3).map((t) => (
                <Chip
                  key={t.tagId}
                  label={t.displayName}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              ))}
              {(screen.tags?.length ?? 0) > 3 && (
                <Chip
                  label={`+${(screen.tags?.length ?? 0) - 3}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function StatPair({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: 'text.secondary' }}>
        {icon}
        <Typography variant="caption">{label}</Typography>
      </Stack>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
