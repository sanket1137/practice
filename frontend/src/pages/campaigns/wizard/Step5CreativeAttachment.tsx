import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import campaignWizardApi from '../../../services/campaignWizardApi';
import type { Creative } from '../../../services/campaignWizardApi';
import mediaApi from '../../../services/mediaApi';
import { step5Schema } from '../../../types/campaignWizard';
import type { Step5Values } from '../../../types/campaignWizard';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';
import type { Screen } from '../../../types/screen';

interface Step5Props {
  onNext: () => void;
}

type FitVerdict = 'perfect' | 'good' | 'crop' | 'stretch' | 'orientation' | 'unknown';

interface FitResult {
  verdict: FitVerdict;
  label: string;
  detail: string;
}

const SAFE_ZONE_RATIO_TOLERANCE = 0.02;
const ACCEPTABLE_RATIO_TOLERANCE = 0.08;

/**
 * Compute how well a creative fits a screen.
 * Compares resolution (upscale/downscale severity) and aspect ratio (orientation + cropping).
 */
function evaluateFit(creative: Creative, screen: Screen): FitResult {
  const cw = creative.width ?? 0;
  const ch = creative.height ?? 0;
  const sw = screen.resolutionWidth ?? 0;
  const sh = screen.resolutionHeight ?? 0;

  if (!cw || !ch || !sw || !sh) {
    return {
      verdict: 'unknown',
      label: 'Resolution not specified',
      detail: 'Either the creative or the screen has no dimensions on file.',
    };
  }

  const creativeOrientation = cw >= ch ? 'Landscape' : 'Portrait';
  const screenOrientation = sw >= sh ? 'Landscape' : 'Portrait';

  if (creativeOrientation !== screenOrientation) {
    return {
      verdict: 'orientation',
      label: 'Orientation mismatch',
      detail: `Creative is ${creativeOrientation.toLowerCase()} but screen is ${screenOrientation.toLowerCase()}. It will be heavily letterboxed.`,
    };
  }

  const creativeRatio = cw / ch;
  const screenRatio = sw / sh;
  const ratioDelta = Math.abs(creativeRatio - screenRatio) / screenRatio;

  const resolutionGap = Math.min(cw / sw, ch / sh);

  if (ratioDelta <= SAFE_ZONE_RATIO_TOLERANCE && resolutionGap >= 1) {
    return {
      verdict: 'perfect',
      label: 'Perfect fit',
      detail: `Matches ${sw}×${sh} exactly.`,
    };
  }

  if (ratioDelta <= ACCEPTABLE_RATIO_TOLERANCE && resolutionGap >= 0.66) {
    return {
      verdict: 'good',
      label: 'Good fit',
      detail:
        resolutionGap < 1
          ? `Slight upscale (${Math.round(resolutionGap * 100)}% of target resolution).`
          : 'Will fit with minimal letterboxing.',
    };
  }

  if (ratioDelta > ACCEPTABLE_RATIO_TOLERANCE) {
    return {
      verdict: 'crop',
      label: 'Aspect mismatch',
      detail: `Creative is ${creativeRatio.toFixed(2)}:1 but screen is ${screenRatio.toFixed(2)}:1. Content will be letterboxed or cropped.`,
    };
  }

  return {
    verdict: 'stretch',
    label: 'Low resolution',
    detail: `Creative is ${cw}×${ch} on a ${sw}×${sh} screen. It will look blurry.`,
  };
}

function fitColor(v: FitVerdict): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (v) {
    case 'perfect':
      return 'success';
    case 'good':
      return 'info';
    case 'crop':
    case 'orientation':
      return 'warning';
    case 'stretch':
      return 'error';
    default:
      return 'default';
  }
}

function fitIcon(v: FitVerdict) {
  if (v === 'perfect' || v === 'good') return <CheckCircleIcon fontSize="inherit" />;
  if (v === 'crop' || v === 'orientation') return <WarningAmberIcon fontSize="inherit" />;
  if (v === 'stretch') return <ErrorOutlineIcon fontSize="inherit" />;
  return null;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

function isVideo(creative: Creative): boolean {
  return creative.mimeType?.startsWith('video/') ?? false;
}

export function Step5CreativeAttachment({ onNext }: Step5Props) {
  const { step4, step5: savedData, selectedScreens, setStep5 } = useCampaignWizardStore();
  const selectedScreenIds = step4?.selectedScreenIds ?? [];
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: creatives = [], isLoading, error, refetch } = useQuery({
    queryKey: ['wizard-creatives'],
    queryFn: campaignWizardApi.getCreatives,
    staleTime: 60 * 1000,
  });

  // Show both Approved and PendingReview creatives. A freshly uploaded creative must be
  // selectable immediately so the user can complete the wizard; the campaign will simply
  // remain on hold until admin review approves the pending asset.
  const approvedCreatives = useMemo(
    () => creatives.filter((c) => c.status === 'Approved' || c.status === 'PendingReview'),
    [creatives],
  );

  // ── Inline upload ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      mediaApi.upload({
        file,
        name: file.name.replace(/\.[^.]+$/, ''),
        duration: 10,
        onProgress: setUploadProgress,
      }),
    onSuccess: (created) => {
      setUploadProgress(0);
      queryClient.invalidateQueries({ queryKey: ['wizard-creatives'] });
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      enqueueSnackbar('Creative uploaded — pending admin approval', { variant: 'success' });
      // Auto-assign the just-uploaded creative
      if (pickerTargetScreenId) {
        assignCreative(pickerTargetScreenId, created.id);
        setPickerOpen(false);
      } else if (pickerOpen) {
        // "Apply to all" picker was open → apply to every selected screen
        assignToAll(created.id);
        setPickerOpen(false);
      }
    },
    onError: (err: unknown) => {
      setUploadProgress(0);
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      enqueueSnackbar(message ?? 'Upload failed', { variant: 'error' });
    },
  });

  const handleUploadFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      enqueueSnackbar('File is larger than 200 MB. Please choose a smaller file.', { variant: 'error' });
      return;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      enqueueSnackbar('Only image or video files are supported.', { variant: 'error' });
      return;
    }
    uploadMutation.mutate(file);
  };

  const screensById = useMemo(() => {
    const m = new Map<string, Screen>();
    for (const s of selectedScreens) m.set(s.id, s);
    return m;
  }, [selectedScreens]);

  const { handleSubmit, watch, setValue } = useForm<Step5Values>({
    resolver: zodResolver(step5Schema),
    defaultValues: { screenCreativeMap: savedData?.screenCreativeMap ?? {} },
  });

  const screenCreativeMap = watch('screenCreativeMap');

  // Media library dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  // null = "apply to all", string = target a specific screen
  const [pickerTargetScreenId, setPickerTargetScreenId] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');

  // Preview overlay state
  const [previewCreative, setPreviewCreative] = useState<Creative | null>(null);
  const [previewScreen, setPreviewScreen] = useState<Screen | null>(null);

  const assignCreative = (screenId: string, creativeId: string) => {
    setValue(
      'screenCreativeMap',
      { ...screenCreativeMap, [screenId]: creativeId },
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const assignToAll = (creativeId: string) => {
    const next: Record<string, string> = { ...screenCreativeMap };
    for (const id of selectedScreenIds) next[id] = creativeId;
    setValue('screenCreativeMap', next, { shouldValidate: true, shouldDirty: true });
  };

  const clearAssignment = (screenId: string) => {
    const next = { ...screenCreativeMap };
    delete next[screenId];
    setValue('screenCreativeMap', next, { shouldValidate: true, shouldDirty: true });
  };

  const openPickerForScreen = (screenId: string) => {
    setPickerTargetScreenId(screenId);
    setPickerOpen(true);
  };

  const openPickerForAll = () => {
    setPickerTargetScreenId(null);
    setPickerOpen(true);
  };

  const handlePick = (creative: Creative) => {
    if (pickerTargetScreenId) {
      assignCreative(pickerTargetScreenId, creative.id);
    } else {
      assignToAll(creative.id);
    }
    setPickerOpen(false);
  };

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return approvedCreatives;
    return approvedCreatives.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.fileName.toLowerCase().includes(q) ||
        c.mimeType.toLowerCase().includes(q),
    );
  }, [approvedCreatives, librarySearch]);

  // Aggregate fit issues across selected screens
  const fitSummary = useMemo(() => {
    let assigned = 0;
    let perfect = 0;
    let warnings = 0;
    let errors = 0;
    for (const screenId of selectedScreenIds) {
      const creativeId = screenCreativeMap[screenId];
      if (!creativeId) continue;
      assigned++;
      const c = approvedCreatives.find((x) => x.id === creativeId);
      const s = screensById.get(screenId);
      if (!c || !s) continue;
      const fit = evaluateFit(c, s);
      if (fit.verdict === 'perfect' || fit.verdict === 'good') perfect++;
      else if (fit.verdict === 'crop' || fit.verdict === 'orientation') warnings++;
      else if (fit.verdict === 'stretch') errors++;
    }
    return {
      assigned,
      total: selectedScreenIds.length,
      perfect,
      warnings,
      errors,
    };
  }, [selectedScreenIds, screenCreativeMap, approvedCreatives, screensById]);

  const isComplete =
    selectedScreenIds.length > 0 &&
    selectedScreenIds.every((id) => !!screenCreativeMap[id]);

  const onSubmit = (data: Step5Values) => {
    setStep5(data);
    onNext();
  };

  if (selectedScreenIds.length === 0) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Please select at least one screen in the previous step before attaching creatives.
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ py: 6 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', textAlign: 'center' }}>
          Loading your creative library…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Couldn't load your creatives. Please try again.
      </Alert>
    );
  }

  if (approvedCreatives.length === 0) {
    return (
      <Box component="form" id="wizard-step-form" onSubmit={handleSubmit(onSubmit)}>
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            px: 3,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleUploadFile(e.dataTransfer.files?.[0]);
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Upload your first creative
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 480, mx: 'auto' }}>
            Drag a video or image here, or click below to choose a file. New uploads are reviewed
            by an admin before they go live — you can still finish creating your campaign now.
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*,video/*"
            onChange={(e) => {
              handleUploadFile(e.target.files?.[0]);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? `Uploading… ${uploadProgress}%` : 'Choose file to upload'}
          </Button>
          {uploadMutation.isPending && (
            <Box sx={{ mt: 2, maxWidth: 360, mx: 'auto' }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            Supported: JPG, PNG, MP4, WebM · Max 200 MB
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="form" id="wizard-step-form" onSubmit={handleSubmit(onSubmit)}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'flex-end' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h6" sx={{ color: 'text.primary' }}>
            Attach creatives to your screens
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pick from your approved media library. We'll check each pairing for resolution and aspect-ratio fit.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            onClick={openPickerForAll}
            disabled={approvedCreatives.length === 0}
          >
            Apply one to all
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*,video/*"
            onChange={(e) => {
              handleUploadFile(e.target.files?.[0]);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? `Uploading… ${uploadProgress}%` : 'Upload new'}
          </Button>
        </Stack>
      </Stack>

      {/* Fit summary banner */}
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          bgcolor: 'background.paper',
          borderColor: fitSummary.errors > 0 ? 'error.main' : fitSummary.warnings > 0 ? 'warning.main' : 'divider',
        }}
      >
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
              <Chip
                size="small"
                label={`${fitSummary.assigned}/${fitSummary.total} assigned`}
                color={fitSummary.assigned === fitSummary.total ? 'success' : 'default'}
              />
              {fitSummary.perfect > 0 && (
                <Chip
                  size="small"
                  color="success"
                  icon={<CheckCircleIcon />}
                  label={`${fitSummary.perfect} good fit`}
                />
              )}
              {fitSummary.warnings > 0 && (
                <Chip
                  size="small"
                  color="warning"
                  icon={<WarningAmberIcon />}
                  label={`${fitSummary.warnings} need attention`}
                />
              )}
              {fitSummary.errors > 0 && (
                <Chip
                  size="small"
                  color="error"
                  icon={<ErrorOutlineIcon />}
                  label={`${fitSummary.errors} low-quality`}
                />
              )}
            </Stack>
            {!isComplete && (
              <Typography variant="caption" color="warning.main">
                Assign a creative to every screen to continue.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Per-screen rows */}
      <Stack spacing={2}>
        {selectedScreenIds.map((screenId) => {
          const screen = screensById.get(screenId);
          const creativeId = screenCreativeMap[screenId];
          const creative = creativeId ? approvedCreatives.find((c) => c.id === creativeId) : undefined;
          const fit = creative && screen ? evaluateFit(creative, screen) : null;

          return (
            <Card
              key={screenId}
              variant="outlined"
              sx={{
                bgcolor: 'background.paper',
                borderColor: fit && (fit.verdict === 'stretch' || fit.verdict === 'orientation')
                  ? 'warning.main'
                  : 'divider',
              }}
            >
              <CardContent>
                <Grid container spacing={2} alignItems="stretch">
                  {/* Screen specs */}
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 96,
                          height: 64,
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: 'action.hover',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {screen?.primaryImage?.imageUrl ? (
                          <CardMedia
                            component="img"
                            image={screen.primaryImage.imageUrl}
                            alt={screen.name}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <ScreenshotMonitorIcon sx={{ color: 'text.secondary' }} />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" noWrap title={screen?.name}>
                          {screen?.name ?? 'Selected screen'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {screen?.location?.city ?? ''}
                          {screen?.location?.state ? `, ${screen.location.state}` : ''}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                          {screen?.resolutionWidth && screen?.resolutionHeight && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${screen.resolutionWidth}×${screen.resolutionHeight}`}
                            />
                          )}
                          {screen?.orientation && (
                            <Chip size="small" variant="outlined" label={screen.orientation} />
                          )}
                          {screen?.displayType && (
                            <Chip size="small" variant="outlined" label={screen.displayType} />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>

                  {/* Assigned creative or CTA */}
                  <Grid size={{ xs: 12, md: 7 }}>
                    {creative ? (
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            isVideo(creative) ? (
                              <VideocamIcon sx={{ fontSize: 14 }} />
                            ) : (
                              <ImageIcon sx={{ fontSize: 14 }} />
                            )
                          }
                        >
                          <Box
                            onClick={() => {
                              setPreviewCreative(creative);
                              setPreviewScreen(screen ?? null);
                            }}
                            sx={{
                              width: 96,
                              height: 64,
                              borderRadius: 1,
                              overflow: 'hidden',
                              bgcolor: 'action.hover',
                              flexShrink: 0,
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: 'divider',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {creative.thumbnailUrl ? (
                              <Box
                                component="img"
                                src={creative.thumbnailUrl}
                                alt={creative.name}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <ImageIcon sx={{ color: 'text.secondary' }} />
                            )}
                          </Box>
                        </Badge>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle2" noWrap title={creative.name}>
                            {creative.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {creative.width && creative.height
                              ? `${creative.width}×${creative.height}`
                              : 'Unknown size'}{' '}
                            · {formatFileSize(creative.fileSize)}
                            {creative.duration ? ` · ${formatDuration(creative.duration)}` : ''}
                          </Typography>
                          {fit && (
                            <Tooltip title={fit.detail} arrow placement="top">
                              <Chip
                                size="small"
                                color={fitColor(fit.verdict)}
                                icon={fitIcon(fit.verdict) ?? undefined}
                                label={fit.label}
                                sx={{ mt: 0.5 }}
                              />
                            </Tooltip>
                          )}
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityIcon />}
                              onClick={() => {
                                setPreviewCreative(creative);
                                setPreviewScreen(screen ?? null);
                              }}
                            >
                              Preview
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => openPickerForScreen(screenId)}
                            >
                              Change
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={() => clearAssignment(screenId)}
                            >
                              Remove
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    ) : (
                      <Card
                        variant="outlined"
                        sx={{
                          borderStyle: 'dashed',
                          height: '100%',
                          bgcolor: 'transparent',
                        }}
                      >
                        <CardActionArea
                          onClick={() => openPickerForScreen(screenId)}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            py: 2,
                          }}
                        >
                          <Stack alignItems="center" spacing={0.5}>
                            <CloudUploadIcon sx={{ color: 'primary.main' }} />
                            <Typography variant="body2" color="primary.main" fontWeight={600}>
                              Choose creative
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Pick from your media library
                            </Typography>
                          </Stack>
                        </CardActionArea>
                      </Card>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Media library picker dialog */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ pr: 6 }}>
          {pickerTargetScreenId
            ? `Choose creative for ${screensById.get(pickerTargetScreenId)?.name ?? 'screen'}`
            : 'Apply one creative to all selected screens'}
          <IconButton
            onClick={() => setPickerOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search creatives by name, file, or type"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {uploadMutation.isPending ? `Uploading… ${uploadProgress}%` : 'Upload new'}
            </Button>
          </Stack>
          {uploadMutation.isPending && (
            <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 2 }} />
          )}
          {filteredLibrary.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No creatives match "{librarySearch}".
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {filteredLibrary.map((c) => {
                // For per-screen picker, show fit verdict for that screen.
                // For "apply to all", show worst-case verdict across all selected screens.
                let fit: FitResult | null = null;
                if (pickerTargetScreenId) {
                  const s = screensById.get(pickerTargetScreenId);
                  if (s) fit = evaluateFit(c, s);
                } else {
                  let worstRank = -1;
                  const rankMap: Record<FitVerdict, number> = {
                    perfect: 0,
                    good: 1,
                    crop: 2,
                    orientation: 3,
                    stretch: 4,
                    unknown: 0,
                  };
                  for (const s of selectedScreens) {
                    const f = evaluateFit(c, s);
                    if (rankMap[f.verdict] > worstRank) {
                      worstRank = rankMap[f.verdict];
                      fit = f;
                    }
                  }
                }
                const isCurrent =
                  pickerTargetScreenId && screenCreativeMap[pickerTargetScreenId] === c.id;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        bgcolor: 'background.paper',
                        borderColor: isCurrent ? 'primary.main' : 'divider',
                        borderWidth: isCurrent ? 2 : 1,
                      }}
                    >
                      <CardActionArea onClick={() => handlePick(c)} sx={{ height: '100%' }}>
                        <Box
                          sx={{
                            position: 'relative',
                            aspectRatio: '16 / 9',
                            bgcolor: 'action.hover',
                            overflow: 'hidden',
                          }}
                        >
                          {c.thumbnailUrl ? (
                            <CardMedia
                              component="img"
                              image={c.thumbnailUrl}
                              alt={c.name}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                              {isVideo(c) ? (
                                <VideocamIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                              ) : (
                                <ImageIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                              )}
                            </Box>
                          )}
                          {fit && (
                            <Chip
                              size="small"
                              color={fitColor(fit.verdict)}
                              icon={fitIcon(fit.verdict) ?? undefined}
                              label={fit.label}
                              sx={{ position: 'absolute', top: 8, left: 8 }}
                            />
                          )}
                          {isCurrent && (
                            <Chip
                              size="small"
                              color="primary"
                              icon={<CheckCircleIcon />}
                              label="Selected"
                              sx={{ position: 'absolute', top: 8, right: 8 }}
                            />
                          )}
                        </Box>
                        <CardContent sx={{ py: 1.5 }}>
                          <Typography variant="subtitle2" noWrap title={c.name}>
                            {c.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {c.width && c.height ? `${c.width}×${c.height}` : 'Unknown'} ·{' '}
                            {formatFileSize(c.fileSize)}
                            {c.duration ? ` · ${formatDuration(c.duration)}` : ''}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Need a new creative? Use the “Upload new” button above. Pending uploads can be
            attached now — the campaign will go live once an admin approves the creative.
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Creative preview overlay */}
      <Dialog
        open={!!previewCreative}
        onClose={() => setPreviewCreative(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6 }}>
          {previewCreative?.name}
          {previewScreen && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Preview on {previewScreen.name} ({previewScreen.resolutionWidth}×
              {previewScreen.resolutionHeight})
            </Typography>
          )}
          <IconButton
            onClick={() => setPreviewCreative(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {previewCreative && (
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio:
                  previewScreen?.resolutionWidth && previewScreen?.resolutionHeight
                    ? `${previewScreen.resolutionWidth} / ${previewScreen.resolutionHeight}`
                    : '16 / 9',
                bgcolor: '#000',
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isVideo(previewCreative) ? (
                <video
                  src={previewCreative.fileUrl}
                  controls
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Box
                  component="img"
                  src={previewCreative.fileUrl}
                  alt={previewCreative.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
            </Box>
          )}
          {previewCreative && previewScreen && (() => {
            const fit = evaluateFit(previewCreative, previewScreen);
            return (
              <Alert
                severity={
                  fit.verdict === 'perfect' || fit.verdict === 'good'
                    ? 'success'
                    : fit.verdict === 'stretch'
                      ? 'error'
                      : fit.verdict === 'unknown'
                        ? 'info'
                        : 'warning'
                }
                sx={{ mt: 2 }}
                icon={fitIcon(fit.verdict) ?? undefined}
              >
                <Typography variant="subtitle2">{fit.label}</Typography>
                <Typography variant="caption">{fit.detail}</Typography>
              </Alert>
            );
          })()}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
            <Avatar sx={{ bgcolor: 'action.hover', width: 32, height: 32 }}>
              {isVideo(previewCreative ?? ({} as Creative)) ? <VideocamIcon /> : <ImageIcon />}
            </Avatar>
            <Box>
              <Typography variant="body2">
                {previewCreative?.width}×{previewCreative?.height} ·{' '}
                {formatFileSize(previewCreative?.fileSize ?? 0)}
                {previewCreative?.duration
                  ? ` · ${formatDuration(previewCreative.duration)}`
                  : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {previewCreative?.mimeType}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
