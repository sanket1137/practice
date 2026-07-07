import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Grid, InputAdornment, TextField, Typography } from '@mui/material';
import { step3Schema } from '../../../types/campaignWizard';
import type { Step3Values } from '../../../types/campaignWizard';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';
import { format, addDays } from 'date-fns';

interface Step3Props {
  onNext: () => void;
}

const toDateString = (d: Date) => format(d, 'yyyy-MM-dd');

export function Step3Budget({ onNext }: Step3Props) {
  const { step3: savedData, setStep3 } = useCampaignWizardStore();

  const today = toDateString(new Date());
  const nextWeek = toDateString(addDays(new Date(), 7));

  const { control, handleSubmit, formState: { errors } } = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: savedData ?? { budget: 5000, currency: 'INR', startDate: today, endDate: nextWeek },
  });

  const onSubmit = (data: Step3Values) => {
    setStep3(data);
    onNext();
  };

  return (
    <Box component="form" id="wizard-step-form" onSubmit={handleSubmit(onSubmit)}>
      <Typography variant="h6" sx={{ mb: 3, color: 'text.primary' }}>
        Set your budget and schedule
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Controller
            name="budget"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                label="Total campaign budget"
                type="number"
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">?</InputAdornment>,
                }}
                error={!!errors.budget}
                helperText={errors.budget?.message ?? 'This is your maximum spend across all bookings'}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="startDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Campaign start date"
                type="date"
                fullWidth
                inputProps={{ min: today }}
                InputLabelProps={{ shrink: true }}
                error={!!errors.startDate}
                helperText={errors.startDate?.message}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Campaign end date"
                type="date"
                fullWidth
                inputProps={{ min: today }}
                InputLabelProps={{ shrink: true }}
                error={!!errors.endDate}
                helperText={errors.endDate?.message}
              />
            )}
          />
        </Grid>
      </Grid>

      <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary' }}>
        Actual spend depends on screens selected and daily slot rates.
      </Typography>
    </Box>
  );
}
