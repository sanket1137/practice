import type { User } from '../types/auth';

export type RoleRouteMatrixVersion = 'v1.0';

export const ROLE_ROUTE_MATRIX_VERSION: RoleRouteMatrixVersion = 'v1.0';

export type NavIconKey =
  | 'dashboard'
  | 'campaigns'
  | 'screens'
  | 'bookings'
  | 'logs'
  | 'monitor'
  | 'analytics'
  | 'settings'
  | 'discover'
  | 'payouts'
  | 'machines'
  | 'verifications'
  | 'visibility'
  | 'media';

export interface NavigationItem {
  text: string;
  path: string;
  iconKey: NavIconKey;
}

interface RoleContext {
  role?: User['role'];
  isPrivate?: boolean;
  accountType?: User['accountType'];
}

export function getSidebarNavigation(context: RoleContext): NavigationItem[] {
  const { role, isPrivate = false } = context;

  if (role === 'ScreenOwner') {
    const items: NavigationItem[] = [
      { text: 'Dashboard', iconKey: 'dashboard', path: '/dashboard' },
      { text: 'My Screens', iconKey: 'screens', path: '/screens' },
    ];

    if (!isPrivate) {
      items.push(
        { text: 'Booking Requests', iconKey: 'bookings', path: '/bookings' },
        { text: 'Earnings', iconKey: 'payouts', path: '/payouts' },
      );
    }

    items.push(
      { text: isPrivate ? 'Screen Analytics' : 'Earnings & Analytics', iconKey: 'analytics', path: '/analytics' },
      { text: 'Play Logs', iconKey: 'logs', path: '/logs' },
      { text: 'Settings', iconKey: 'settings', path: '/profile' },
    );

    return items;
  }

  if (role === 'Advertiser') {
    return [
      { text: 'Dashboard', iconKey: 'dashboard', path: '/dashboard' },
      { text: 'Campaigns', iconKey: 'campaigns', path: '/campaigns' },
      { text: 'Monitor', iconKey: 'monitor', path: '/monitor' },
      { text: 'Media', iconKey: 'media', path: '/media' },
      { text: 'Discover Screens', iconKey: 'discover', path: '/screens/discover' },
      { text: 'My Bookings', iconKey: 'bookings', path: '/bookings' },
      { text: 'Campaign Analytics', iconKey: 'analytics', path: '/analytics' },
      { text: 'Settings', iconKey: 'settings', path: '/profile' },
    ];
  }

  return [
    { text: 'Dashboard', iconKey: 'dashboard', path: '/dashboard' },
    { text: 'All Campaigns', iconKey: 'campaigns', path: '/campaigns' },
    { text: 'All Screens', iconKey: 'screens', path: '/screens' },
    { text: 'All Bookings', iconKey: 'bookings', path: '/bookings' },
    { text: 'Payouts', iconKey: 'payouts', path: '/admin/payouts' },
    { text: 'Machines', iconKey: 'machines', path: '/admin/machines' },
    { text: 'Verifications', iconKey: 'verifications', path: '/admin/verifications' },
    { text: 'Visibility Requests', iconKey: 'visibility', path: '/admin/visibility-requests' },
    { text: 'Platform Analytics', iconKey: 'analytics', path: '/analytics' },
    { text: 'Settings', iconKey: 'settings', path: '/profile' },
  ];
}

export function getMobileNavigation(context: RoleContext): NavigationItem[] {
  const { role, isPrivate = false } = context;

  if (role === 'Advertiser') {
    return [
      { text: 'Dashboard', iconKey: 'dashboard', path: '/dashboard' },
      { text: 'Campaigns', iconKey: 'campaigns', path: '/campaigns' },
      { text: 'Monitor', iconKey: 'monitor', path: '/monitor' },
      { text: 'Media', iconKey: 'media', path: '/media' },
      { text: 'Screens', iconKey: 'discover', path: '/screens/discover' },
      { text: 'Analytics', iconKey: 'analytics', path: '/analytics' },
    ];
  }

  if (role === 'ScreenOwner') {
    const items: NavigationItem[] = [
      { text: 'Dashboard', iconKey: 'dashboard', path: '/dashboard' },
      { text: 'Screens', iconKey: 'screens', path: '/screens' },
      { text: 'Analytics', iconKey: 'analytics', path: '/analytics' },
    ];

    if (!isPrivate) {
      items.splice(2, 0, { text: 'Bookings', iconKey: 'bookings', path: '/bookings' });
    }

    return items;
  }

  return [
    { text: 'Dashboard', iconKey: 'dashboard', path: '/dashboard' },
    { text: 'Screens', iconKey: 'screens', path: '/screens' },
    { text: 'Bookings', iconKey: 'bookings', path: '/bookings' },
    { text: 'Analytics', iconKey: 'analytics', path: '/analytics' },
  ];
}

export interface AccessContext {
  role?: User['role'];
  isPrivate?: boolean;
}

export function canAccessBookings(context: AccessContext): boolean {
  return !(context.role === 'ScreenOwner' && context.isPrivate);
}

export function canAccessPayouts(context: AccessContext): boolean {
  return !(context.role === 'ScreenOwner' && context.isPrivate);
}

export function canAccessAdmin(context: AccessContext): boolean {
  return context.role === 'Admin';
}
