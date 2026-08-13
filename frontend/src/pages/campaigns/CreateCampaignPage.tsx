import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import { useCampaignWizardStore } from '../../store/campaignWizardStore';
import { Step1Objective } from './wizard/Step1Objective';
import { Step2Audience } from './wizard/Step2Audience';
import { Step3Budget } from './wizard/Step3Budget';
import { Step4ScreenSelection } from './wizard/Step4ScreenSelection';
import { Step5CreativeAttachment } from './wizard/Step5CreativeAttachment';
import { Step6ReviewPayment } from './wizard/Step6ReviewPayment';
import { WizardSummaryPanel } from './wizard/WizardSummaryPanel';

const STEPS = [
  'Objective',
  'Audience',
  'Budget & Dates',
  'Screens',
  'Creatives',
  'Review & Pay',
];

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { activeStep, setActiveStep, reset } = useCampaignWizardStore();

  useEffect(() => {
    reset();
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => setActiveStep(Math.min(activeStep + 1, STEPS.length - 1));
  const handleBack = () => setActiveStep(Math.max(activeStep - 1, 0));
  const handleComplete = () => navigate('/campaigns');
  const handleJumpToStep = (idx: number) => {
    // Allow jumping back to any completed step; do not allow leaping forward.
    if (idx <= activeStep) setActiveStep(idx);
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <Step1Objective onNext={handleNext} />;
      case 1:
        return <Step2Audience onNext={handleNext} />;
      case 2:
        return <Step3Budget onNext={handleNext} />;
      case 3:
        return <Step4ScreenSelection onNext={handleNext} />;
      case 4:
        return <Step5CreativeAttachment onNext={handleNext} />;
      case 5:
        return <Step6ReviewPayment onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  const showSummary = activeStep >= 1;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sticky header + stepper */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.appBar,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'saturate(180%) blur(8px)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, md: 2 } }}>
            <Button
              size="small"
              variant="text"
              startIcon={<CloseIcon />}
              onClick={() => navigate('/campaigns')}
            >
              Exit
            </Button>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: 'text.primary' }}
                noWrap
              >
                Create campaign
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Step {activeStep + 1} of {STEPS.length} · {STEPS[activeStep]}
              </Typography>
            </Box>
          </Box>
          <Stepper
            activeStep={activeStep}
            alternativeLabel={isMdUp}
            sx={{
              '& .MuiStepLabel-label': {
                fontSize: { xs: '0.7rem', md: '0.8rem' },
              },
            }}
          >
            {STEPS.map((label, idx) => (
              <Step key={label} completed={idx < activeStep}>
                <StepLabel
                  onClick={() => handleJumpToStep(idx)}
                  sx={{
                    cursor: idx <= activeStep ? 'pointer' : 'default',
                    '&:hover': idx < activeStep ? { opacity: 0.85 } : undefined,
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Grid container spacing={3}>
          {/* Main panel */}
          <Grid size={{ xs: 12, md: showSummary ? 8 : 12 }}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2, md: 3.5 },
                bgcolor: 'background.paper',
                minHeight: 400,
                borderRadius: 2,
              }}
            >
              {renderStep()}
            </Paper>

            {activeStep < STEPS.length - 1 && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mt: 3,
                  gap: 2,
                }}
              >
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBack}
                  disabled={activeStep === 0}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  form="wizard-step-form"
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                >
                  {activeStep === STEPS.length - 2 ? 'Review order' : 'Continue'}
                </Button>
              </Box>
            )}
          </Grid>

          {/* Summary rail */}
          {showSummary && (
            <Grid size={{ xs: 12, md: 4 }}>
              <WizardSummaryPanel />
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  );
}
