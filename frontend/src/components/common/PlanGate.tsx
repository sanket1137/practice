import React from '\''react'\'';
import { Box, Button, Chip, Typography } from '\''@mui/material'\'';
import LockIcon from '\''@mui/icons-material/Lock'\'';
import { useNavigate } from '\''react-router-dom'\'';

type CmsPlanTier = '\''Free'\'' | '\''Starter'\'' | '\''Professional'\'' | '\''Enterprise'\'';

const PLAN_ORDER: CmsPlanTier[] = ['\''Free'\'', '\''Starter'\'', '\''Professional'\'', '\''Enterprise'\''];

export interface PlanGateProps {
  requiredPlan: CmsPlanTier;
  currentPlan?: CmsPlanTier;
  feature: string;
  children: React.ReactNode;
}

export function PlanGate({ requiredPlan, currentPlan = '\''Free'\'', feature, children }: PlanGateProps) {
  const navigate = useNavigate();
  const hasAccess = PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(requiredPlan);

  if (hasAccess) return <>{children}</>;

  return (
    <Box
      sx={{
        position: '\''relative'\'',
        borderRadius: 2,
        overflow: '\''hidden'\'',
      }}
    >
      <Box sx={{ filter: '\''blur(4px)'\'', pointerEvents: '\''none'\'', userSelect: '\''none'\'' }}>
        {children}
      </Box>
      <Box
        sx={{
          position: '\''absolute'\'',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: '\''rgba(15,23,42,0.85)'\'',
          display: '\''flex'\'',
          flexDirection: '\''column'\'',
          alignItems: '\''center'\'',
          justifyContent: '\''center'\'',
          gap: 1.5,
          p: 3,
        }}
      >
        <LockIcon sx={{ color: '\''primary.main'\'', fontSize: 40 }} />
        <Typography variant="h6" fontWeight={700} textAlign="center">
          {feature}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          This feature requires the <Chip label={requiredPlan} size="small" color="primary" sx={{ mx: 0.5 }} /> plan.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('\''/cms/billing'\'')}>
          Upgrade Plan
        </Button>
      </Box>
    </Box>
  );
}
