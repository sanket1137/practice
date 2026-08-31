import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LockIcon from '@mui/icons-material/Lock';
import CampaignIcon from '@mui/icons-material/Campaign';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventIcon from '@mui/icons-material/Event';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import ImageIcon from '@mui/icons-material/Image';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import campaignWizardApi from '../../../services/campaignWizardApi';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';
import WalletTopUpDialog from '../../../components/wallet/WalletTopUpDialog';

interface Step6Props {
  onComplete: () => void;
}

const SLOTS_PER_DAY = 144; // 6 slots/hour × 24h

// Campaigns are currently booked without collecting payment; Razorpay checkout is
// planned but not implemented yet. While this is false the wallet balance is shown
// for reference only and never blocks launching. Must be kept in step with the
// backend's Payments:RequirePrepayment setting, which is what actually decides
// whether the wallet is debited (see CreateCampaignWizardCommandHandler).
const REQUIRE_PREPAYMENT = false;

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  onEdit: () => void;
}

function SectionHeader({ icon, title, onEdit }: SectionHeaderProps) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          {icon}
        </Avatar>
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
      </Stack>
      <Button
        size="small"
        variant="text"
        startIcon={<EditIcon fontSize="small" />}
        onClick={onEdit}
      >
        Edit
      </Button>
    </Stack>
  );
}

export function Step6ReviewPayment({ onComplete }: Step6Props) {
  const { enqueueSnackbar } = useSnackbar();
  const {
    step1,
    step2,
    step3,
    step4,
    step5,
    selectedScreens,
    setActiveStep,
    setCreatedCampaign,
    setCreatedBookings,
  } = useCampaignWizardStore();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [autoLaunchAfterTopUp, setAutoLaunchAfterTopUp] = useState(false);

  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useQuery({
    queryKey: ['wizard-wallet'],
    queryFn: campaignWizardApi.getWalletBalance,
    staleTime: 0,
  });

  const { data: creatives = [] } = useQuery({
    queryKey: ['wizard-creatives'],
    queryFn: campaignWizardApi.getCreatives,
    staleTime: 60 * 1000,
  });

  const selectedScreenIds = step4?.selectedScreenIds ?? [];
  const screenCreativeMap = step5?.screenCreativeMap ?? {};

  const estimatedDays = useMemo(() => {
    if (!step3?.startDate || !step3?.endDate) return 0;
    const start = new Date(step3.startDate).getTime();
    const end = new Date(step3.endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [step3]);

  const projection = useMemo(() => {
    let dailyImpressions = 0;
    let estimatedCost = 0;
    let counted = 0;
    for (const id of selectedScreenIds) {
      const s = selectedScreens.find((x) => x.id === id);
      if (!s) continue;
      if (typeof s.dailyTotalImpressions === 'number') {
        dailyImpressions += s.dailyTotalImpressions;
        counted++;
      }
      if (typeof s.pricePerSlot === 'number') {
        estimatedCost += s.pricePerSlot * SLOTS_PER_DAY * estimatedDays;
      }
    }
    if (counted > 0 && counted < selectedScreenIds.length) {
      dailyImpressions = (dailyImpressions / counted) * selectedScreenIds.length;
    }
    return {
      dailyImpressions,
      totalImpressions: dailyImpressions * estimatedDays,
      slotsPerDay: SLOTS_PER_DAY * selectedScreenIds.length,
      estimatedCost,
    };
  }, [selectedScreenIds, selectedScreens, estimatedDays]);

  const currency = step3?.currency ?? 'INR';
  const walletBalance = wallet?.balance ?? 0;
  const totalCost = projection.estimatedCost > 0 ? projection.estimatedCost : (step3?.budget ?? 0);
  const canAfford = !REQUIRE_PREPAYMENT || walletBalance >= totalCost;
  const budget = step3?.budget ?? 0;
  const overBudget = budget > 0 && projection.estimatedCost > budget;

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(n));

  const fmtCompact = (n: number) =>
    new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  const missingCreatives = selectedScreenIds.filter((id) => !screenCreativeMap[id]);
  const canSubmit = !!step1 && !!step3 && selectedScreenIds.length > 0 && missingCreatives.length === 0;

  const handleCreateAndPay = async () => {
    if (!step1 || !step3 || !step4 || !step5) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const bookings = selectedScreenIds
        .filter((screenId) => screenCreativeMap[screenId])
        .map((screenId) => ({
          screenId,
          creativeId: screenCreativeMap[screenId],
        }));

      if (bookings.length === 0) {
        setErrorMessage('No valid screen-creative assignments found. Please go back to step 5.');
        setSubmitting(false);
        return;
      }

      const result = await campaignWizardApi.createCampaignAtomic({
        name: step1.name,
        objective: step1.objective,
        description: step1.description,
        budget: step3.budget,
        currency: step3.currency,
        startDate: step3.startDate,
        endDate: step3.endDate,
        bookings,
      });

      setCreatedCampaign(result.campaignId);
      setCreatedBookings(
        result.bookings.map((b) => b.bookingId),
        result.totalCharged,
      );

      enqueueSnackbar(`Campaign "${result.campaignName}" created successfully!`, {
        variant: 'success',
      });
      onComplete();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (walletLoading) {
    return (
      <Box sx={{ py: 6 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
          Loading order summary…
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1, color: 'text.primary' }}>
        Review and confirm
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        One last check. Tap any section to edit. Payment is atomic — if any booking fails, you won't be charged.
      </Typography>

      <Grid container spacing={3}>
        {/* Left — review sections */}
        <Grid size={{ xs: 12, md: 7 }}>
          {/* Campaign */}
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}>
            <CardContent>
              <SectionHeader
                icon={<CampaignIcon fontSize="small" />}
                title="Campaign"
                onEdit={() => setActiveStep(0)}
              />
              <Typography variant="body1" fontWeight={600}>
                {step1?.name}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                {step1?.objective && (
                  <Chip size="small" variant="outlined" label={step1.objective} />
                )}
              </Stack>
              {step1?.description && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  {step1.description}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Audience */}
          {step2 && (
            <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}>
              <CardContent>
                <SectionHeader
                  icon={<LocationOnIcon fontSize="small" />}
                  title="Audience"
                  onEdit={() => setActiveStep(1)}
                />
                <Stack spacing={0.5}>
                  {(step2.city || step2.state) && (
                    <Typography variant="body2">
                      {step2.city || 'Any city'}
                      {step2.state ? `, ${step2.state}` : ''}
                      {step2.radiusKm ? ` · within ${step2.radiusKm} km` : ''}
                    </Typography>
                  )}
                  {step2.displayType && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {step2.displayType}
                      {step2.orientation ? ` · ${step2.orientation}` : ''}
                    </Typography>
                  )}
                  {step2.tagIds && step2.tagIds.length > 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {step2.tagIds.length} audience tag{step2.tagIds.length === 1 ? '' : 's'} selected
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Budget & dates */}
          {step3 && (
            <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}>
              <CardContent>
                <SectionHeader
                  icon={<EventIcon fontSize="small" />}
                  title="Budget & dates"
                  onEdit={() => setActiveStep(2)}
                />
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    {step3.startDate} → {step3.endDate} ({estimatedDays} day{estimatedDays === 1 ? '' : 's'})
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Budget {fmtMoney(budget)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Screens */}
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}>
            <CardContent>
              <SectionHeader
                icon={<ScreenshotMonitorIcon fontSize="small" />}
                title={`Screens (${selectedScreenIds.length})`}
                onEdit={() => setActiveStep(3)}
              />
              {selectedScreenIds.length === 0 ? (
                <Typography variant="body2" color="warning.main">
                  No screens selected yet.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {selectedScreenIds.map((id) => {
                    const s = selectedScreens.find((x) => x.id === id);
                    return (
                      <ListItem key={id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemAvatar sx={{ minWidth: 44 }}>
                          <Avatar
                            variant="rounded"
                            src={s?.primaryImage?.imageUrl}
                            sx={{ width: 36, height: 36, bgcolor: 'action.hover' }}
                          >
                            <ScreenshotMonitorIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={s?.name ?? id}
                          secondary={
                            s
                              ? `${s.location?.city ?? ''} · ${
                                  typeof s.pricePerSlot === 'number'
                                    ? fmtMoney(s.pricePerSlot * SLOTS_PER_DAY * estimatedDays)
                                    : 'pricing TBD'
                                }`
                              : 'Loading…'
                          }
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Creatives */}
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}>
            <CardContent>
              <SectionHeader
                icon={<ImageIcon fontSize="small" />}
                title="Creatives"
                onEdit={() => setActiveStep(4)}
              />
              {missingCreatives.length > 0 ? (
                <Alert severity="warning" icon={<WarningAmberIcon />}>
                  {missingCreatives.length} screen{missingCreatives.length === 1 ? '' : 's'}{' '}
                  still need{missingCreatives.length === 1 ? 's' : ''} a creative assigned.
                </Alert>
              ) : (
                <List dense disablePadding>
                  {selectedScreenIds.map((id) => {
                    const s = selectedScreens.find((x) => x.id === id);
                    const c = creatives.find((cc) => cc.id === screenCreativeMap[id]);
                    return (
                      <ListItem key={id} disableGutters sx={{ py: 0.5 }}>
                        <ListItemAvatar sx={{ minWidth: 44 }}>
                          <Avatar
                            variant="rounded"
                            src={c?.thumbnailUrl}
                            sx={{ width: 36, height: 36, bgcolor: 'action.hover' }}
                          >
                            <ImageIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={c?.name ?? 'Unknown creative'}
                          secondary={`for ${s?.name ?? id.slice(0, 8)}`}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right — payment summary */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: 'background.paper',
              position: { md: 'sticky' },
              top: { md: 220 },
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <AccountBalanceWalletIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Payment summary
                </Typography>
              </Stack>

              {/* Cost breakdown */}
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Screens × days
                  </Typography>
                  <Typography variant="body2">
                    {selectedScreenIds.length} × {estimatedDays || '–'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Total slots
                  </Typography>
                  <Typography variant="body2">{projection.slotsPerDay * estimatedDays || 0}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Projected impressions
                  </Typography>
                  <Typography variant="body2">~{fmtCompact(projection.totalImpressions)}</Typography>
                </Stack>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Estimated cost
                </Typography>
                <Typography variant="h5" fontWeight={700} color={overBudget ? 'error.main' : 'text.primary'}>
                  {fmtMoney(projection.estimatedCost)}
                </Typography>
              </Stack>
              {overBudget && (
                <Alert severity="warning" sx={{ mt: 1 }} icon={<WarningAmberIcon />}>
                  Exceeds your budget of {fmtMoney(budget)} by {fmtMoney(projection.estimatedCost - budget)}.
                </Alert>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Wallet section */}
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Wallet balance</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {fmtMoney(walletBalance)}
                  </Typography>
                </Stack>
                {REQUIRE_PREPAYMENT && (
                  <>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Charge to wallet
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        −{fmtMoney(totalCost)}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={600}>
                        Balance after
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={canAfford ? 'success.main' : 'error.main'}
                      >
                        {fmtMoney(walletBalance - totalCost)}
                      </Typography>
                    </Stack>
                  </>
                )}
              </Stack>

              {!REQUIRE_PREPAYMENT && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No payment is collected at this step. The campaign is booked now and{' '}
                  <strong>{fmtMoney(totalCost)}</strong> is recorded as due — online payment is
                  coming soon.
                </Alert>
              )}

              {!canAfford && (
                <Alert
                  severity="error"
                  sx={{ mt: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setAutoLaunchAfterTopUp(true);
                        setTopUpOpen(true);
                      }}
                    >
                      Top up {fmtMoney(Math.max(totalCost - walletBalance, 0))}
                    </Button>
                  }
                >
                  Insufficient wallet balance. Short by{' '}
                  <strong>{fmtMoney(Math.max(totalCost - walletBalance, 0))}</strong>. Top up now to launch
                  the campaign — we'll auto-continue once payment is confirmed.
                </Alert>
              )}

              {errorMessage && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errorMessage}
                </Alert>
              )}

              <Tooltip
                title={
                  !canSubmit
                    ? 'Complete all wizard steps and assign a creative to every screen first.'
                    : ''
                }
                arrow
              >
                <span>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    sx={{ mt: 3, py: 1.5 }}
                    onClick={handleCreateAndPay}
                    disabled={submitting || !canAfford || !canSubmit}
                    startIcon={
                      submitting ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <LockIcon fontSize="small" />
                      )
                    }
                  >
                    {submitting
                      ? 'Creating campaign…'
                      : REQUIRE_PREPAYMENT
                        ? `Pay ${fmtMoney(totalCost)} & launch`
                        : 'Launch campaign'}
                  </Button>
                </span>
              </Tooltip>

              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 1.5 }}>
                <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  Campaign, bookings, and payment are processed atomically.
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                sx={{ display: 'block', color: 'text.secondary', textAlign: 'center', mt: 0.5 }}
              >
                Need help?{' '}
                <Link href="/support" target="_blank" rel="noopener">
                  Contact support
                </Link>
              </Typography>
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                <Button size="small" variant="text" onClick={() => refetchWallet()}>
                  Refresh wallet
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <WalletTopUpDialog
        open={topUpOpen}
        onClose={() => {
          setTopUpOpen(false);
          setAutoLaunchAfterTopUp(false);
        }}
        currency={currency}
        suggestedAmount={Math.max(totalCost - walletBalance, 0)}
        onSuccess={async () => {
          // Refetch wallet to get the latest balance.
          const fresh = await refetchWallet();
          const newBalance = fresh.data?.balance ?? 0;
          if (autoLaunchAfterTopUp && newBalance >= totalCost && canSubmit) {
            // Auto-continue: launch the campaign now that funds are available.
            enqueueSnackbar('Top-up confirmed. Launching campaign…', { variant: 'info' });
            await handleCreateAndPay();
          }
          setAutoLaunchAfterTopUp(false);
        }}
      />
    </Box>
  );
}
