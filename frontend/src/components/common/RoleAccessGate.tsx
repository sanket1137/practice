import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAccountVisibility } from '../../hooks/useAccountVisibility';
import { canAccessAdmin, canAccessBookings, canAccessPayouts } from '../../constants/roleRouteMatrix';
import { useToast } from '../../hooks/useToast';

type GuardRule = 'bookings' | 'payouts' | 'admin';

interface RoleAccessGateProps {
  rule: GuardRule;
  fallbackPath?: string;
  children: React.ReactNode;
}

export function RoleAccessGate({ rule, fallbackPath = '/dashboard', children }: RoleAccessGateProps) {
  const user = useAuthStore((state) => state.user);
  const { isPrivate } = useAccountVisibility();
  const location = useLocation();
  const toast = useToast();
  const lastBlockedKeyRef = useRef<string>('');

  const accessContext = {
    role: user?.role,
    isPrivate,
  };

  const allowed = (() => {
    if (rule === 'bookings') return canAccessBookings(accessContext);
    if (rule === 'payouts') return canAccessPayouts(accessContext);
    if (rule === 'admin') return canAccessAdmin(accessContext);
    return true;
  })();

  useEffect(() => {
    if (allowed) return;

    const blockedKey = `${rule}:${location.pathname}`;
    if (lastBlockedKeyRef.current === blockedKey) return;
    lastBlockedKeyRef.current = blockedKey;

    const message = (() => {
      if (rule === 'bookings') return 'Bookings are available only in marketplace mode.';
      if (rule === 'payouts') return 'Payouts are available only in marketplace mode.';
      return 'You do not have access to this section.';
    })();

    toast.warning(message);
  }, [allowed, rule, location.pathname, toast]);

  if (!allowed) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

export default RoleAccessGate;
