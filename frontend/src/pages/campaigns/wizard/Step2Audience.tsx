import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Autocomplete,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  ListSubheader,
  MenuItem,
  Skeleton,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import StayCurrentLandscapeIcon from '@mui/icons-material/StayCurrentLandscape';
import StayCurrentPortraitIcon from '@mui/icons-material/StayCurrentPortrait';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import OnlinePredictionIcon from '@mui/icons-material/OnlinePrediction';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import { MapContainer, TileLayer, Circle, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { step2Schema } from '../../../types/campaignWizard';
import type { Step2Values } from '../../../types/campaignWizard';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';
import {
  useLocationSuggestions,
  useTagCatalog,
  useScreenSearch,
} from '../../../hooks/useCampaignWizardData';
import type { LocationSuggestion, SearchScreensRequest } from '../../../types/screen';

// Leaflet default icon fix
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

const DISPLAY_TYPES = [
  { value: 'Outdoor', label: 'Outdoor', icon: <WbSunnyOutlinedIcon fontSize="small" /> },
  { value: 'Indoor', label: 'Indoor', icon: <HomeOutlinedIcon fontSize="small" /> },
  { value: 'SemiIndoor', label: 'Semi-indoor', icon: <StorefrontOutlinedIcon fontSize="small" /> },
];

const ORIENTATIONS = [
  { value: 'Landscape', label: 'Landscape', icon: <StayCurrentLandscapeIcon fontSize="small" /> },
  { value: 'Portrait', label: 'Portrait', icon: <StayCurrentPortraitIcon fontSize="small" /> },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${h.toString().padStart(2, '0')}:00`,
}));

interface Step2Props {
  onNext: () => void;
}

/**
 * Recenters the map whenever the lat/lng/radius changes — keeps the preview
 * focused on the current targeting anchor without remounting the MapContainer.
 */
function MapAutoFocus({
  lat,
  lng,
  radiusKm,
}: {
  lat?: number;
  lng?: number;
  radiusKm: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    const zoom = Math.max(6, Math.min(14, Math.round(Math.log2(40000 / Math.max(1, radiusKm * 2)))));
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, radiusKm, map]);
  return null;
}

export function Step2Audience({ onNext }: Step2Props) {
  const { step2: savedData, setStep2 } = useCampaignWizardStore();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues:
      savedData ?? {
        city: '',
        state: '',
        country: 'India',
        radiusKm: 5,
        tagIds: [],
        displayType: undefined,
        orientation: undefined,
        minDailyImpressions: undefined,
        operatingAtHour: undefined,
        onlineOnly: false,
      },
  });

  const values = watch();
  const radiusKm = values.radiusKm ?? 5;

  // Location autocomplete
  const [locationQuery, setLocationQuery] = useState(savedData?.city ?? '');
  const { data: locationSuggestions = [], isFetching: locationLoading } =
    useLocationSuggestions(locationQuery, 'city', 12);

  // Tag catalog (with marketplace counts)
  const { data: tagCatalog = [], isLoading: tagsLoading } = useTagCatalog(true);

  const tagsByCategory = useMemo(() => {
    const groups: Record<string, typeof tagCatalog> = {};
    for (const t of tagCatalog) {
      (groups[t.category] ??= []).push(t);
    }
    return groups;
  }, [tagCatalog]);

  // Live match search
  const searchFilters: SearchScreensRequest = useMemo(
    () => ({
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || undefined,
      latitude: values.latitude,
      longitude: values.longitude,
      radiusKm: values.latitude != null && values.longitude != null ? radiusKm : undefined,
      requiredTagIds: values.tagIds?.length ? values.tagIds : undefined,
      displayType: values.displayType || undefined,
      orientation: values.orientation || undefined,
      minDailyImpressions: values.minDailyImpressions,
      operatingAtHour: values.operatingAtHour,
      onlineOnly: values.onlineOnly || undefined,
      status: 'Active',
      page: 1,
      pageSize: 100,
      sortBy: values.latitude != null ? 'distance' : 'impressions',
    }),
    [values, radiusKm],
  );

  const hasAnchor = !!values.city || !!values.state || values.latitude != null;
  const { data: searchResult, isFetching: searchLoading } = useScreenSearch(
    searchFilters,
    hasAnchor,
  );
  const matchedScreens = searchResult?.screens ?? [];
  const matchCount = searchResult?.totalCount ?? 0;
  const projectedDailyImpressions = matchedScreens.reduce(
    (sum, s) => sum + (s.dailyTotalImpressions ?? 0),
    0,
  );

  const handleSelectLocation = (suggestion: LocationSuggestion | null) => {
    if (!suggestion) return;
    setValue('city', suggestion.city ?? '', { shouldValidate: true });
    setValue('state', suggestion.state ?? '', { shouldValidate: true });
    // Auto-anchor the map on the centroid so the radius slider is meaningful immediately.
    if (suggestion.centerLatitude != null && suggestion.centerLongitude != null) {
      setValue('latitude', suggestion.centerLatitude, { shouldValidate: true });
      setValue('longitude', suggestion.centerLongitude, { shouldValidate: true });
    }
  };

  const toggleTag = (tagId: string) => {
    const current = values.tagIds ?? [];
    setValue(
      'tagIds',
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
      { shouldValidate: true },
    );
  };

  const onSubmit = (data: Step2Values) => {
    setStep2(data);
    onNext();
  };

  const mapAnchor: [number, number] = useMemo(() => {
    if (values.latitude != null && values.longitude != null) {
      return [values.latitude, values.longitude];
    }
    const firstWithCoords = matchedScreens.find((s) => s.latitude && s.longitude);
    if (firstWithCoords) return [firstWithCoords.latitude!, firstWithCoords.longitude!];
    return INDIA_CENTER;
  }, [values.latitude, values.longitude, matchedScreens]);

  const selectedTags = values.tagIds ?? [];

  return (
    <Box component="form" id="wizard-step-form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ color: 'text.primary' }}>
          Who do you want to reach?
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Target by location, audience tags and screen environment. The preview on the right updates live as you refine.
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        {/* ────────── LEFT: filters ────────── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            {/* Location card */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PlaceIcon sx={{ color: 'primary.main' }} fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>
                      Location
                    </Typography>
                  </Stack>

                  <Autocomplete<LocationSuggestion, false, false, true>
                    freeSolo
                    options={locationSuggestions}
                    loading={locationLoading}
                    getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
                    filterOptions={(x) => x}
                    inputValue={locationQuery}
                    onInputChange={(_, v) => setLocationQuery(v)}
                    onChange={(_, v) => {
                      if (typeof v === 'string') {
                        setValue('city', v);
                        setValue('state', '');
                      } else {
                        handleSelectLocation(v);
                      }
                    }}
                    renderOption={(props, opt) => (
                      <MenuItem {...props} key={opt.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <Typography variant="body2">{opt.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {opt.screenCount} screens
                          </Typography>
                        </Box>
                      </MenuItem>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="City"
                        placeholder="Start typing a city — e.g. Mumbai"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <>
                              {locationLoading ? <CircularProgress size={16} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="state"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="State"
                            fullWidth
                            placeholder="Maharashtra"
                            error={!!errors.state}
                            helperText={errors.state?.message}
                          />
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="country"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Country"
                            fullWidth
                            error={!!errors.country}
                            helperText={errors.country?.message}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>

                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Search radius
                      </Typography>
                      <Chip
                        label={`${radiusKm} km`}
                        size="small"
                        sx={{ fontWeight: 600 }}
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                    <Slider
                      value={radiusKm}
                      min={0.5}
                      max={50}
                      step={0.5}
                      onChange={(_, v) => setValue('radiusKm', v as number)}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v} km`}
                      marks={[
                        { value: 1, label: '1' },
                        { value: 10, label: '10' },
                        { value: 25, label: '25' },
                        { value: 50, label: '50' },
                      ]}
                      sx={{ color: 'primary.main' }}
                    />
                    {values.latitude == null && (
                      <Typography variant="caption" color="text.secondary">
                        Tip: pick a city above or click a marker on the map to anchor the radius.
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Audience tags card */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LabelOutlinedIcon sx={{ color: 'primary.main' }} fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>
                      Audience tags
                    </Typography>
                    {selectedTags.length > 0 && (
                      <Chip size="small" label={`${selectedTags.length} selected`} color="primary" />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Pick the contexts where your audience spends time. Numbers show active marketplace screens carrying each tag.
                  </Typography>

                  {tagsLoading ? (
                    <Stack spacing={1}>
                      <Skeleton variant="rounded" height={28} />
                      <Skeleton variant="rounded" height={28} />
                      <Skeleton variant="rounded" height={28} />
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      {Object.entries(tagsByCategory).map(([category, tags]) => (
                        <Box key={category}>
                          <ListSubheader
                            disableSticky
                            sx={{ p: 0, lineHeight: 1.5, color: 'text.secondary', bgcolor: 'transparent' }}
                          >
                            <Typography variant="overline">{category}</Typography>
                          </ListSubheader>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                            {tags
                              .slice()
                              .sort((a, b) => (b.screenCount ?? 0) - (a.screenCount ?? 0))
                              .map((tag) => {
                                const isSelected = selectedTags.includes(tag.id);
                                return (
                                  <Chip
                                    key={tag.id}
                                    label={
                                      tag.screenCount != null && tag.screenCount > 0
                                        ? `${tag.displayName} · ${tag.screenCount}`
                                        : tag.displayName
                                    }
                                    onClick={() => toggleTag(tag.id)}
                                    color={isSelected ? 'primary' : 'default'}
                                    variant={isSelected ? 'filled' : 'outlined'}
                                    size="small"
                                    disabled={tag.screenCount === 0 && !isSelected}
                                  />
                                );
                              })}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Screen environment card */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ScreenshotMonitorIcon sx={{ color: 'primary.main' }} fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>
                      Screen environment
                    </Typography>
                  </Stack>

                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Display type
                    </Typography>
                    <ToggleButtonGroup
                      value={values.displayType ?? null}
                      exclusive
                      size="small"
                      onChange={(_, v) => setValue('displayType', v ?? undefined)}
                    >
                      {DISPLAY_TYPES.map((dt) => (
                        <ToggleButton key={dt.value} value={dt.value} sx={{ px: 2 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {dt.icon}
                            <Typography variant="body2">{dt.label}</Typography>
                          </Stack>
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Orientation
                    </Typography>
                    <ToggleButtonGroup
                      value={values.orientation ?? null}
                      exclusive
                      size="small"
                      onChange={(_, v) => setValue('orientation', v ?? undefined)}
                    >
                      {ORIENTATIONS.map((o) => (
                        <ToggleButton key={o.value} value={o.value} sx={{ px: 2 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {o.icon}
                            <Typography variant="body2">{o.label}</Typography>
                          </Stack>
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>

                  <Divider />

                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Minimum daily impressions
                      </Typography>
                      <Chip
                        label={
                          values.minDailyImpressions
                            ? `${values.minDailyImpressions.toLocaleString()}+`
                            : 'Any'
                        }
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Slider
                      value={values.minDailyImpressions ?? 0}
                      min={0}
                      max={100000}
                      step={1000}
                      onChange={(_, v) =>
                        setValue('minDailyImpressions', (v as number) || undefined)
                      }
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => (v === 0 ? 'Any' : `${(v / 1000).toFixed(0)}K+`)}
                      sx={{ color: 'primary.main' }}
                    />
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Controller
                      name="operatingAtHour"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          select
                          label="Operating at hour"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                          }
                          fullWidth
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <AccessTimeIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                        >
                          <MenuItem value="">Any time</MenuItem>
                          {HOUR_OPTIONS.map((h) => (
                            <MenuItem key={h.value} value={h.value}>
                              {h.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />

                    <FormControlLabel
                      sx={{ minWidth: 180 }}
                      control={
                        <Switch
                          checked={!!values.onlineOnly}
                          onChange={(e) => setValue('onlineOnly', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <OnlinePredictionIcon fontSize="small" color="success" />
                          <Typography variant="body2">Online now only</Typography>
                        </Stack>
                      }
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* ────────── RIGHT: live preview ────────── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>
            <Card variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Live matches
                  </Typography>
                  {searchLoading && <CircularProgress size={14} />}
                </Stack>
                {!hasAnchor ? (
                  <Typography variant="body2" color="text.secondary">
                    Pick a city above to see matching screens here.
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                    <Box>
                      <Typography variant="h4" color="primary.main" sx={{ lineHeight: 1 }}>
                        {matchCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        screens match
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                        {projectedDailyImpressions.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        impressions / day (combined)
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </CardContent>

              <Box sx={{ height: 320, position: 'relative' }}>
                <MapContainer
                  center={mapAnchor}
                  zoom={values.latitude != null ? 12 : 5}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapAutoFocus lat={values.latitude} lng={values.longitude} radiusKm={radiusKm} />
                  {values.latitude != null && values.longitude != null && (
                    <Circle
                      center={[values.latitude, values.longitude]}
                      radius={radiusKm * 1000}
                      pathOptions={{
                        color: '#6366f1',
                        fillColor: '#6366f1',
                        fillOpacity: 0.1,
                        weight: 2,
                      }}
                    />
                  )}
                  <MarkerClusterGroup chunkedLoading>
                    {matchedScreens
                      .filter((s) => s.latitude != null && s.longitude != null)
                      .map((s) => (
                        <Marker
                          key={s.id}
                          position={[s.latitude!, s.longitude!]}
                          eventHandlers={{
                            click: () => {
                              setValue('latitude', s.latitude);
                              setValue('longitude', s.longitude);
                              setValue('city', s.location?.city ?? values.city);
                              setValue('state', s.location?.state ?? values.state);
                            },
                          }}
                        />
                      ))}
                  </MarkerClusterGroup>
                </MapContainer>
              </Box>

              <CardContent sx={{ pt: 1.5 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Top matching screens
                  </Typography>
                  {searchLoading && matchedScreens.length === 0 ? (
                    <>
                      <Skeleton height={28} />
                      <Skeleton height={28} />
                      <Skeleton height={28} />
                    </>
                  ) : matchedScreens.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No screens match yet. Loosen the filters or expand the radius.
                    </Typography>
                  ) : (
                    matchedScreens.slice(0, 4).map((s) => (
                      <Stack
                        key={s.id}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                        <Avatar
                          variant="rounded"
                          src={s.primaryImage?.imageUrl}
                          sx={{ width: 32, height: 32, bgcolor: 'background.default' }}
                        >
                          <ScreenshotMonitorIcon fontSize="small" />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Tooltip title={s.name} placement="top">
                            <Typography variant="body2" noWrap fontWeight={500}>
                              {s.name}
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {s.location?.city ?? ''}
                            {s.distanceKm != null ? ` · ${s.distanceKm.toFixed(1)} km` : ''}
                            {s.dailyTotalImpressions
                              ? ` · ${(s.dailyTotalImpressions / 1000).toFixed(1)}K imp/day`
                              : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    ))
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
