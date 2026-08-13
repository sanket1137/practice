import { useState, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  MenuItem,
  Select,
  Typography,
  Alert,
} from "@mui/material";
import CelebrationIcon from "@mui/icons-material/Celebration";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { festivalsApi } from "../../services/festivalsApi";
import type { PricingRuleDto } from "../../types/pricingRule";
import { useSnackbar } from "notistack";

interface FestivalSelection {
  festivalId: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
}

const MULTIPLIER_OPTIONS = [1.0, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6, 1.75, 1.8, 2.0, 2.5, 3.0];

function datesOverlap(aStart: string, aEnd: string, bStart: string | null, bEnd: string | null): boolean {
  if (!bStart || !bEnd) return false;
  const a1 = new Date(aStart);
  const a2 = new Date(aEnd);
  const b1 = new Date(bStart);
  const b2 = new Date(bEnd);
  return a1 <= b2 && a2 >= b1;
}

export function FestivePricingPage() {
  const { screenId } = useParams<{ screenId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [selections, setSelections] = useState<Record<string, FestivalSelection>>({});

  const { data: festivals, isLoading: festivalsLoading } = useQuery({
    queryKey: ["festivals", 2026],
    queryFn: () => festivalsApi.getFestivals(2026),
    staleTime: 60 * 60 * 1000,
  });

  const { data: existingRules } = useQuery<PricingRuleDto[]>({
    queryKey: ["pricing-rules", screenId],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/screens/${screenId}/pricing-rules`);
      return res.data?.data ?? res.data ?? [];
    },
    enabled: !!screenId,
    staleTime: 2 * 60 * 1000,
  });

  const conflicts = useMemo(() => {
    if (!existingRules) return [];
    const result: { festivalName: string; conflictingRule: string }[] = [];
    for (const sel of Object.values(selections)) {
      for (const rule of existingRules) {
        if (datesOverlap(sel.startDate, sel.endDate, rule.startDate, rule.endDate)) {
          result.push({ festivalName: sel.name, conflictingRule: rule.name });
        }
      }
    }
    return result;
  }, [selections, existingRules]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const rules = Object.values(selections).map((s) => ({
        name: `${s.name} Festive Pricing`,
        startDate: s.startDate,
        endDate: s.endDate,
        multiplier: s.multiplier,
      }));
      await axios.post(`/api/v1/screens/${screenId}/pricing-rules/bulk`, { rules });
    },
    onSuccess: () => {
      enqueueSnackbar(`${Object.keys(selections).length} festive pricing rules created!`, { variant: "success" });
      navigate(`/screens/${screenId}/pricing`);
    },
    onError: () => enqueueSnackbar("Failed to create pricing rules", { variant: "error" }),
  });

  const toggleFestival = (festival: { id: string; name: string; startDate: string; endDate: string; suggestedMultiplier: number }) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[festival.id]) {
        delete next[festival.id];
      } else {
        next[festival.id] = {
          festivalId: festival.id,
          name: festival.name,
          startDate: festival.startDate,
          endDate: festival.endDate,
          multiplier: festival.suggestedMultiplier,
        };
      }
      return next;
    });
  };

  const updateMultiplier = (festivalId: string, multiplier: number) => {
    setSelections((prev) =>
      prev[festivalId] ? { ...prev, [festivalId]: { ...prev[festivalId], multiplier } } : prev
    );
  };

  if (festivalsLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;

  const selectionCount = Object.keys(selections).length;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <CelebrationIcon sx={{ color: "secondary.main" }} />
        <Typography variant="h5" fontWeight={700}>Festive Pricing Calendar</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select festivals to apply premium pricing for your screen. Suggested multipliers are based on historical demand.
      </Typography>

      {conflicts.length > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2 }}
        >
          <strong>{conflicts.length} overlap(s) with existing rules:</strong>{" "}
          {conflicts.map((c) => `${c.festivalName} overlaps with "${c.conflictingRule}"`).join("; ")}.{" "}
          Date-specific festive rules take precedence over existing rules.
        </Alert>
      )}

      {selectionCount > 0 && conflicts.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {selectionCount} festival(s) selected — no conflicts with existing rules.
        </Alert>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(festivals ?? []).map((f) => {
          const selected = !!selections[f.id];
          return (
            <Card
              key={f.id}
              variant="outlined"
              sx={{
                border: selected ? "2px solid" : "1px solid",
                borderColor: selected ? "primary.main" : "divider",
              }}
            >
              <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <FormControlLabel
                  control={<Checkbox checked={selected} onChange={() => toggleFestival(f)} />}
                  label={
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{f.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {f.startDate} → {f.endDate}
                      </Typography>
                    </Box>
                  }
                />
                {selected && (
                  <Select
                    size="small"
                    value={selections[f.id].multiplier}
                    onChange={(e) => updateMultiplier(f.id, Number(e.target.value))}
                    sx={{ minWidth: 100 }}
                  >
                    {MULTIPLIER_OPTIONS.map((m) => (
                      <MenuItem key={m} value={m}>{m}×</MenuItem>
                    ))}
                  </Select>
                )}
                {!selected && (
                  <Typography variant="caption" color="text.secondary">
                    Suggested: {f.suggestedMultiplier}×
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
        <Button variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
        <Button
          variant="contained"
          disabled={selectionCount === 0 || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Saving..." : `Apply ${selectionCount} Festive Rule(s)`}
        </Button>
      </Box>
    </Container>
  );
}
