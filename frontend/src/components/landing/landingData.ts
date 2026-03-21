// Landing page constants and data

export const COLORS = {
  bg: '#080d18',
  surface: '#0f172a',
  surface2: '#1a2235',
  border: 'rgba(255,255,255,0.07)',
  indigo: '#6366f1',
  indigoGlow: 'rgba(99,102,241,0.20)',
  pink: '#ec4899',
  pinkGlow: 'rgba(236,72,153,0.15)',
  cyan: '#06b6d4',
  green: '#22c55e',
  amber: '#f59e0b',
  text1: '#f1f5f9',
  text2: '#94a3b8',
  text3: '#475569',
  red: '#ef4444',
} as const;

export const FONTS = {
  display: "'Syne', sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const TICKER_ITEMS = [
  '⚡ {ads} ads playing right now',
  '₹{revenue} earned today',
  '{bookings} new bookings in last hour',
  '{online} screens just came online',
  'Zomato campaign live on MG Road',
  '₹8,400 payout processed',
  'New screen listed in Connaught Place',
];

export const LOGO_BRANDS = [
  { initial: 'Z', name: 'Zomato', color: '#ef4444' },
  { initial: 'S', name: 'Swiggy', color: '#f97316' },
  { initial: 'B', name: 'BigBazaar', color: '#eab308' },
  { initial: 'O', name: 'OYO', color: '#ef4444' },
  { initial: 'M', name: 'Meesho', color: '#ec4899' },
  { initial: 'F', name: 'Flipkart', color: '#3b82f6' },
  { initial: 'L', name: 'Lenskart', color: '#06b6d4' },
  { initial: 'D', name: 'Decathlon', color: '#22c55e' },
];

export const MOCK_FEED_MESSAGES = [
  '✓ MG Road approved booking — ₹12,500',
  '📺 Koramangala playing Swiggy_Ad.mp4',
  '💰 Payout ₹8,400 sent to Rahul Kumar',
  '🔔 New booking request — Zomato campaign',
  '📊 Phoenix Mall: 200 impressions',
  '✓ Orion Mall Screen A online',
];

export const OWNER_FEATURES = [
  'List in 5 minutes',
  'Set your own price',
  'Preview all creatives',
  'Instant bank payouts',
  'Real-time monitoring',
];

export const ADVERTISER_FEATURES = [
  '500+ verified screens',
  'Book in minutes',
  'Pay after approval',
  'Live impression tracking',
  'Cancel anytime',
];

export const STORY_STEPS = [
  {
    number: '01',
    title: 'Upload your creative',
    desc: 'Drag in your video or image. MP4, MOV, JPG — we handle the rest. Automatic format conversion and quality optimization.',
    icon: 'CloudUpload' as const,
    visualLabel: 'Drop your creative here',
  },
  {
    number: '02',
    title: 'Perfect screen matching',
    desc: 'Filter by city, footfall, price. 500+ verified screens, real locations across India. AI-powered matching.',
    icon: 'Map' as const,
    visualLabel: '500+ India-wide locations',
  },
  {
    number: '03',
    title: 'Request sent instantly',
    desc: 'Screen owner is notified immediately. Review happens within 24 hours. No waiting, no uncertainty.',
    icon: 'Send' as const,
    visualLabel: 'Approval in < 24 hrs',
  },
  {
    number: '04',
    title: 'Owner reviews & approves',
    desc: 'Full creative preview before approving. You\'re always in control. Approve or reject with one click.',
    icon: 'CheckCircle' as const,
    visualLabel: 'Verified & approved',
  },
  {
    number: '05',
    title: 'Ad plays, money earned',
    desc: 'Real-time impression counting. Automatic payouts. Zero effort. Watch your campaign performance live.',
    icon: 'CurrencyRupee' as const,
    visualLabel: 'Passive revenue tracking',
  },
];

export interface TestimonialData {
  stars: number;
  text: string;
  initials: string;
  name: string;
  role: string;
}

export const TESTIMONIALS_ROW_1: TestimonialData[] = [
  { stars: 5, text: '"Listed my 3 lobby screens and started earning within a week. The approval flow is seamless and payments are always on time."', initials: 'RK', name: 'Rajesh Kumar', role: 'Mall Manager, Pune' },
  { stars: 5, text: '"Finally a platform where I can book screens digitally without calling anyone. Brilliant execution and great support."', initials: 'PS', name: 'Priya Sharma', role: 'Marketing, Bengaluru' },
  { stars: 5, text: '"Our Raspberry Pi setup was plug-and-play. Content syncs automatically and we haven\'t had a single downtime in 3 months."', initials: 'AM', name: 'Anil Mehta', role: 'Screen Owner, Mumbai' },
  { stars: 5, text: '"The slot-based pricing is genius. We earn more per screen than any static ad arrangement we had before."', initials: 'SK', name: 'Sneha Kulkarni', role: 'Retail Chain, Pune' },
];

export const TESTIMONIALS_ROW_2: TestimonialData[] = [
  { stars: 5, text: '"As a startup, every rupee counts. PixelSpot\'s transparent pricing and no hidden fees policy is refreshing. Highly recommend!"', initials: 'VP', name: 'Vikram Patel', role: 'Founder, D2C Brand' },
  { stars: 5, text: '"The targeting capabilities are impressive. We reached exactly the audience we wanted in Mumbai\'s prime locations."', initials: 'NG', name: 'Neha Gupta', role: 'Brand Manager, FMCG' },
  { stars: 5, text: '"Real-time impression data changed how we plan media spend. We can actually see our ads running and measure impact."', initials: 'RJ', name: 'Rohan Joshi', role: 'Media Planner, Agency' },
  { stars: 5, text: '"The map-based discovery is addictive. Found screens near our 5 store locations in under 10 minutes."', initials: 'DK', name: 'Deepa Krishnan', role: 'Marketing Head, Retail' },
];

export const OWNER_PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: '/month',
    desc: 'Perfect for getting started with 1-2 screens.',
    features: ['Up to 2 screens', 'Basic analytics', '15% platform fee', '7-day payout'],
    featured: false,
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '₹999',
    period: '/month',
    desc: 'For growing screen networks.',
    features: ['Up to 10 screens', 'Advanced analytics', '10% platform fee', '48-hour payout', 'Priority support'],
    featured: true,
    cta: 'Start Free Trial →',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For large networks and chains.',
    features: ['Unlimited screens', 'White-label option', 'Custom commission', 'Dedicated manager'],
    featured: false,
    cta: 'Contact Sales',
  },
];
