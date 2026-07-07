import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useSnackbar } from 'notistack';

interface PlanInfo {
  currentPlan: string;
  nextRenewal: string | null;
  screensUsed: number;
  screensLimit: number;
  monthlyPrice: number;
  features: Record<string, string | boolean | number>;
}

const PLANS = [
  {
    name: 'Free',
    price: 0,
    screens: 1,
    features: ['1 Screen', 'Basic remote control', 'Standard analytics'],
  },
  {
    name: 'Starter',
    price: 999,
    screens: 5,
    features: ['5 Screens', 'Brightness & volume control', 'Standard analytics', 'Email support'],
  },
  {
    name: 'Professional',
    price: 2499,
    screens: 20,
    features: ['20 Screens', 'Full remote control', 'Day-parting scheduling', 'Full analytics + CSV export', 'Priority support'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 7499,
    screens: -1,
    features: ['Unlimited Screens', 'Bulk remote control', 'Day-parting scheduling', 'Full analytics + PDF export', 'Dedicated account manager', 'API access'],
  },
];

export function CmsBillingPage() {
  const { enqueueSnackbar } = useSnackbar();

  const { data: planInfo, isLoading } = useQuery<{ data: PlanInfo }>({
    queryKey: ['cms-billing-plan'],
    queryFn: () => axios.get('/api/v1/cms/billing/plan').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const upgradeMutation = useMutation({
    mutationFn: (targetPlan: string) =>
      axios.post('/api/v1/cms/billing/upgrade', { targetPlan }).then((r) => r.data),
    onSuccess: (data) => {
      enqueueSnackbar(data.message ?? 'Upgrade initiated', { variant: 'info' });
    },
    onError: () => enqueueSnackbar('Upgrade request failed', { variant: 'error' }),
  });

  const current = planInfo?.data;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <CreditCardIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={700}>
          CMS Billing & Plans
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {current && (
            <Card variant="outlined" sx={{ mb: 4, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Current Plan:{' '}
                <Chip label={current.currentPlan} color="primary" size="small" />
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Screens: {current.screensUsed} /{' '}
                {current.screensLimit === -1 ? 'Unlimited' : current.screensLimit}
                {current.nextRenewal &&
                  ` · Renews: ${new Date(current.nextRenewal).toLocaleDateString()}`}
              </Typography>
            </Card>
          )}

          <Grid container spacing={3}>
            {PLANS.map((plan) => {
              const isCurrentPlan = current?.currentPlan === plan.name;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={plan.name}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      border: plan.highlighted ? '2px solid' : '1px solid',
                      borderColor: plan.highlighted
                        ? 'primary.main'
                        : isCurrentPlan
                          ? 'success.main'
                          : 'divider',
                      position: 'relative',
                    }}
                  >
                    {plan.highlighted && (
                      <Chip
                        label="Most Popular"
                        color="primary"
                        size="small"
                        sx={{ position: 'absolute', top: 12, right: 12 }}
                      />
                    )}
                    <CardContent>
                      <Typography variant="h6" fontWeight={700}>
                        {plan.name}
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight={800}
                        sx={{ my: 1, color: 'primary.main' }}
                      >
                        {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
                        {plan.price > 0 && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            /mo
                          </Typography>
                        )}
                      </Typography>
                      <List dense disablePadding>
                        {plan.features.map((f) => (
                          <ListItem key={f} disableGutters>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <CheckCircleIcon fontSize="small" color="success" />
                            </ListItemIcon>
                            <ListItemText
                              primary={f}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                      <Box sx={{ mt: 2 }}>
                        {isCurrentPlan ? (
                          <Button variant="outlined" disabled fullWidth>
                            Current Plan
                          </Button>
                        ) : plan.name === 'Free' ? (
                          <Button variant="outlined" disabled fullWidth>
                            Downgrade
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            fullWidth
                            color={plan.highlighted ? 'primary' : 'inherit'}
                            disabled={upgradeMutation.isPending}
                            onClick={() => upgradeMutation.mutate(plan.name)}
                          >
                            Upgrade to {plan.name}
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </Container>
  );
}
