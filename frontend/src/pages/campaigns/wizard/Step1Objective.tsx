import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import { step1Schema, CAMPAIGN_OBJECTIVES } from '../../../types/campaignWizard';
import type { Step1Values } from '../../../types/campaignWizard';
import { useCampaignWizardStore } from '../../../store/campaignWizardStore';

const ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUpIcon fontSize="large" />,
  DirectionsWalk: <DirectionsWalkIcon fontSize="large" />,
  ShoppingCart: <ShoppingCartIcon fontSize="large" />,
  People: <PeopleIcon fontSize="large" />,
};

interface Step1Props {
  onNext: () => void;
}

export function Step1Objective({ onNext }: Step1Props) {
  const { step1: savedData, setStep1 } = useCampaignWizardStore();

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: savedData ?? { name: '', objective: 'brand_awareness', description: '' },
  });

  const selectedObjective = watch('objective');

  const onSubmit = (data: Step1Values) => {
    setStep1(data);
    onNext();
  };

  return (
    <Box component="form" id="wizard-step-form" onSubmit={handleSubmit(onSubmit)}>
      <Typography variant="h6" sx={{ mb: 3, color: 'text.primary' }}>
        What''s the goal of your campaign?
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {CAMPAIGN_OBJECTIVES.map((obj) => (
          <Grid size={{ xs: 12, sm: 6 }} key={obj.value}>
            <Card
              variant="outlined"
              sx={{
                border: selectedObjective === obj.value
                  ? '2px solid'
                  : '1px solid',
                borderColor: selectedObjective === obj.value ? 'primary.main' : 'divider',
                bgcolor: selectedObjective === obj.value ? 'primary.main' : 'background.paper',
                transition: 'all 0.2s',
              }}
            >
              <CardActionArea onClick={() => setValue('objective', obj.value as Step1Values['objective'])}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                  <Box sx={{ color: selectedObjective === obj.value ? 'white' : 'primary.main' }}>
                    {ICONS[obj.icon]}
                  </Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{ color: selectedObjective === obj.value ? 'white' : 'text.primary' }}
                  >
                    {obj.label}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {errors.objective && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {errors.objective.message}
        </Typography>
      )}

      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Campaign name"
            fullWidth
            error={!!errors.name}
            helperText={errors.name?.message}
            sx={{ mb: 2 }}
          />
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            error={!!errors.description}
            helperText={errors.description?.message}
          />
        )}
      />
    </Box>
  );
}
