import { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventIcon from '@mui/icons-material/Event';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import ImageIcon from '@mui/icons-material/Image';
import PaidIcon from '@mui/icons-material/Paid';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';

/**
 * Sticky right-rail summary that mirrors the wizard state.
 *
 * Renders progressive detail as the user moves through the steps —
 * each card section only appears once its source step has been completed.
 */
export function WizardSummaryPanel() {
  const { step1, step2, step3, step4, step5, selectedScreens, activeStep } =
    useCampaignWizardStore();

  const estimatedDays = useMemo(() => {
    if (!step3?.startDate || !step3?.endDate) return 0;
    const start = new Date(step3.startDate).getTime();
    const end = new Date(step3.endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [step3]);

  const selectedScreenIds = step4?.selectedScreenIds ?? [];
  const numScreens = selectedScreenIds.length;

  const projection = useMemo(() => {
    if (!numScreens || !estimatedDays) {
      return { dailyImpressions: 0, totalImpressions: 0, slotsPerDay: 0, estimatedCost: 0 };
    }
    const SLOTS_PER_DAY = 144; // 6 slots/hour × 24 hours
    let dailyImpressions = 0;
    let estimatedCost = 0;
    let countedForImpressions = 0;
    for (const id of selectedScreenIds) {
      const s = selectedScreens.find((x) => x.id === id);
      if (!s) continue;
      if (typeof s.dailyTotalImpressions === 'number') {
        dailyImpressions += s.dailyTotalImpressions;
        countedForImpressions++;
      }
      if (typeof s.pricePerSlot === 'number') {
        estimatedCost += s.pricePerSlot * SLOTS_PER_DAY * estimatedDays;
      }
    }
    // If some screens didn't have impressions data, scale up so we don't undercount.
    if (countedForImpressions > 0 && countedForImpressions < numScreens) {
      dailyImpressions = (dailyImpressions / countedForImpressions) * numScreens;
    }
    const totalImpressions = dailyImpressions * estimatedDays;
    return {
      dailyImpressions,
      totalImpressions,
      slotsPerDay: SLOTS_PER_DAY * numScreens,
      estimatedCost,
    };
  }, [selectedScreenIds, selectedScreens, estimatedDays, numScreens]);

  const assignedCreatives = useMemo(() => {
    const map = step5?.screenCreativeMap ?? {};
    return selectedScreenIds.filter((id) => !!map[id]).length;
  }, [step5, selectedScreenIds]);

  const budget = step3?.budget ?? 0;
  const currency = step3?.currency ?? 'INR';
  const overBudget = budget > 0 && projection.estimatedCost > budget;
  const budgetUsedPct = budget > 0 ? Math.min(100, (projection.estimatedCost / budget) * 100) : 0;

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(n));

  const fmtCompact = (n: number) =>
    new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  // Don't render anything before Step 2 (no useful data yet).
  if (activeStep < 1 || !step1) return null;

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: 'background.paper',
        position: { md: 'sticky' },
        top: { md: 88 },
      }}
    >
      <CardContent>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          Campaign summary
        </Typography>

        {/* Step 1 — Objective */}
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CampaignIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600} noWrap title={step1.name}>
              {step1.name || 'Untitled campaign'}
            </Typography>
          </Stack>
          {step1.objective && (
            <Chip
              size="small"
              variant="outlined"
              label={step1.objective}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Stack>

        {/* Step 2 — Audience */}
        {step2 && (step2.city || step2.state || step2.tagIds?.length) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              {(step2.city || step2.state) && (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary', mt: '2px' }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" noWrap>
                      {step2.city || 'Anywhere'}
                      {step2.state ? `, ${step2.state}` : ''}
                    </Typography>
                    {step2.radiusKm && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        within {step2.radiusKm} km
                      </Typography>
                    )}
                  </Box>
                </Stack>
              )}
              {step2.tagIds && step2.tagIds.length > 0 && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocalOfferIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {step2.tagIds.length} audience tag{step2.tagIds.length === 1 ? '' : 's'}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </>
        )}

        {/* Step 3 — Budget & dates */}
        {step3 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {step3.startDate} → {step3.endDate}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', pl: 3 }}>
                {estimatedDays} day{estimatedDays === 1 ? '' : 's'} of campaign run
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <PaidIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2">
                  Budget {fmtMoney(budget)}
                </Typography>
              </Stack>
            </Stack>
          </>
        )}

        {/* Step 4 — Screens + projection */}
        {numScreens > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScreenshotMonitorIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {numScreens} screen{numScreens === 1 ? '' : 's'} selected
                </Typography>
              </Stack>
              {projection.totalImpressions > 0 && (
                <Typography variant="caption" sx={{ color: 'text.secondary', pl: 3 }}>
                  ~{fmtCompact(projection.totalImpressions)} projected impressions
                </Typography>
              )}
              {projection.estimatedCost > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Estimated cost
                    </Typography>
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      color={overBudget ? 'error.main' : 'text.primary'}
                    >
                      {fmtMoney(projection.estimatedCost)}
                    </Typography>
                  </Stack>
                  {budget > 0 && (
                    <LinearProgress
                      variant="determinate"
                      value={budgetUsedPct}
                      color={overBudget ? 'error' : 'primary'}
                      sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                    />
                  )}
                  {overBudget && (
                    <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                      Over budget by {fmtMoney(projection.estimatedCost - budget)}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          </>
        )}

        {/* Step 5 — Creatives */}
        {numScreens > 0 && activeStep >= 4 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1} alignItems="center">
              <ImageIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2">
                {assignedCreatives}/{numScreens} creatives assigned
              </Typography>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
