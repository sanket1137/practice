// Constants and structured data matching light/dark screenshots

export const COLORS = {
  // Theme-independent base accents
  primaryPurple: '#6366f1',
  primaryPurpleHover: '#4f46e5',
  electricBlue: '#0ea5e9',
  electricBlueHover: '#0284c7',
  success: '#22c55e',
  warning: '#f59e0b',

  // Light Mode Colors
  light: {
    bg: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceCard: '#FFFFFF',
    border: 'rgba(15, 23, 42, 0.08)',
    text1: '#0F172A',
    text2: '#475569',
    text3: '#64748B',
    accentText: '#6366f1',
    logoOpacity: 0.6,
  },

  // Dark Mode Colors
  dark: {
    bg: '#030712',
    surface: '#0F172A',
    surfaceCard: '#1E293B',
    border: 'rgba(255, 255, 255, 0.08)',
    text1: '#F8FAFC',
    text2: '#94A3B8',
    text3: '#64748B',
    accentText: '#818cf8',
    logoOpacity: 0.3,
  },
} as const;

export const FONTS = {
  display: "'Manrope', system-ui, sans-serif",
  body: "'Manrope', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const TRUSTED_LOGOS = [
  'lifestyle',
  'INOX',
  'PVR',
  'CROMPTON',
  'Reliance',
  'vijay sales',
  'Domino\'s',
];

/* Hero checklist items — free platform messaging */
export const HERO_CHECKLIST = [
  'Free Forever',
  'No Hidden Costs',
  'Unlimited Screens',
];

/* ── Problem → Solution Data for Pitch ─────────────────────── */
export const PROBLEM_SOLUTIONS = {
  advertiser: {
    headline: 'The Advertiser\u2019s Challenge',
    problems: [
      {
        pain: 'Reaching the right audience through physical screens is fragmented, expensive, and unmeasurable.',
        detail: 'Brands juggle multiple vendors, lack real-time performance data, and can\'t track ROI on outdoor spends.',
      },
    ],
    solutionHeadline: 'How PixelSpot Solves This',
    solutions: [
      'Launch high-impact campaigns in under 5 minutes — no vendor calls, no delays',
      'Target screens by location, time slot, and audience demographics',
      'Get real-time impression tracking and transparent performance reports',
      'Pay only for what you use — no minimum commitments, no hidden fees',
    ],
  },
  owner: {
    headline: 'The Screen Owner\u2019s Challenge',
    problems: [
      {
        pain: 'Screen owners have idle display inventory with no easy way to monetize or manage content remotely.',
        detail: 'Managing content across screens is manual, time-consuming, and offers zero revenue potential without advertiser connections.',
      },
    ],
    solutionHeadline: 'How PixelSpot Solves This',
    solutions: [
      'List your screens on India\'s first DOOH marketplace and receive bookings automatically',
      'Manage unlimited screens remotely — schedule, monitor, and update content in real time',
      'Earn passive revenue with automated ad slot filling and instant payouts',
      'Get full hardware telemetry — uptime alerts, temperature, and health monitoring',
    ],
  },
};

export const DUAL_ROLES = {
  advertiser: {
    title: 'For Advertisers',
    desc: 'Plan high-impact campaigns, reach the right audience at the right place, and measure every impression with precision.',
    benefits: [
      'Launch campaigns in minutes — not weeks',
      'Target by location, time, audience & footfall',
      'Real-time impression analytics & proof-of-play',
      'Transparent reporting with zero hidden costs',
      'Maximize ROI with data-driven optimization',
    ],
    cta: "I'm an Advertiser",
  },
  owner: {
    title: 'For Screen Owners',
    desc: 'Transform idle screens into revenue-generating assets. Manage, automate, and monetize your entire display network from one dashboard.',
    benefits: [
      'Manage unlimited screens from anywhere',
      'Automate content scheduling & playlists',
      'Monetize with direct advertiser bookings',
      'Real-time device monitoring & alerts',
      'Detailed earnings reports & payout tracking',
    ],
    cta: "I'm a Screen Owner",
  },
};

export const PLATFORM_FEATURES = [
  {
    icon: 'Monitor',
    title: 'Screen Management',
    desc: 'Add, organize & control screens remotely.',
  },
  {
    icon: 'FolderOpen',
    title: 'Content Management',
    desc: 'Upload, organize & schedule engaging content.',
  },
  {
    icon: 'Campaign',
    title: 'Campaign Management',
    desc: 'Create, schedule & run impactful campaigns.',
  },
  {
    icon: 'CalendarToday',
    title: 'Smart Scheduling',
    desc: 'Automate content based on time, location & rules.',
  },
  {
    icon: 'Assessment',
    title: 'Analytics & Reports',
    desc: 'Track performance and measure what matters.',
  },
  {
    icon: 'Payments',
    title: 'Monetization',
    desc: 'Monetize your screens with advertisements.',
  },
  {
    icon: 'SettingsSuggest',
    title: 'Automation Rules',
    desc: 'Trigger content based on events, conditions & more.',
  },
  {
    icon: 'Router',
    title: 'Multi-Location Support',
    desc: 'Manage multiple locations from one dashboard.',
  },
];

export const TIMELINE_STEPS = [
  {
    step: '1',
    title: 'Upload Content',
    desc: 'Add your images, videos, HTML, and more.',
  },
  {
    step: '2',
    title: 'Create Campaign',
    desc: 'Design layouts, playlists, and set your goals.',
  },
  {
    step: '3',
    title: 'Choose Screens',
    desc: 'Select screens or locations to target your audience.',
  },
  {
    step: '4',
    title: 'Go Live & Analyze',
    desc: 'Publish instantly and track real-time performance.',
  },
];

export const STATS = [
  { val: '10,000+', label: 'Active Screens' },
  { val: '2,000+', label: 'Happy Customers' },
  { val: '50M+', label: 'Monthly Impressions' },
  { val: '99.9%', label: 'Uptime & Reliability' },
];

export const TESTIMONIALS = [
  {
    text: 'PixelSpot helped us automate our entire network. The platform is powerful, yet so easy to use.',
    name: 'Rohit Sharma',
    role: 'Marketing Head, Lifestyle',
  },
  {
    text: 'We increased our ad revenue by 40% using PixelSpot. The analytics and automation are game-changing.',
    name: 'Neha Kapoor',
    role: 'Business Owner, Outdoor Media',
  },
  {
    text: 'Managing 500+ screens across India has never been this simple!',
    name: 'Arun Verma',
    role: 'Operations Manager, PVR',
  },
];

export const FAQS = [
  {
    q: 'Is PixelSpot really free to use?',
    a: 'Yes! PixelSpot CCMS is completely free for all users — screen owners and advertisers alike. There are no subscription fees, no hidden charges, and no feature gates. You get the full platform at zero cost.',
  },
  {
    q: 'What hardware devices are supported?',
    a: 'We support Raspberry Pi, Android TV, and ChromeOS players. They connect via a simple QR pairing code and synchronize content automatically.',
  },
  {
    q: 'How do screen owners earn money?',
    a: 'Once you list your screens on the PixelSpot marketplace, advertisers can book ad slots directly. Payments are processed securely via Razorpay with automated payouts — you earn passively while your screens display ads.',
  },
  {
    q: 'How quickly can I launch a campaign?',
    a: 'You can go from sign-up to a live campaign in under 5 minutes. Upload your creative, select target screens, set your schedule, and hit publish. It\'s that simple.',
  },
  {
    q: 'Can I manage screens across multiple cities?',
    a: 'Absolutely. PixelSpot is built for multi-location networks. Group screens by city, venue, or any custom tag and manage everything from a single dashboard.',
  },
];

export const WHY_PIXELSPOT = {
  headers: ['Features', 'Traditional Signage', 'PixelSpot DOOH'],
  rows: [
    { name: 'Content Distribution', trad: '❌ Manual USB uploads or slow server syncs', pixel: '✅ Real-time instant cloud updates in < 3s' },
    { name: 'Scheduling Control', trad: '❌ Basic linear looping playlists', pixel: '✅ Smart slots with conditional rules & triggers' },
    { name: 'Monetization Channels', trad: '❌ Static screen owner inventory', pixel: '✅ Direct programmatic marketplace bidding' },
    { name: 'Hardware Telemetry', trad: '❌ No remote debugging or reboot triggers', pixel: '✅ Active health monitoring with restart script' },
    { name: 'Cost', trad: '❌ Expensive licenses and vendor lock-in', pixel: '✅ 100% free platform — no hidden charges' },
  ],
};

// PRICING_PLANS kept for compile support of other pages/components — PixelSpot CCMS is free for all users on the index page
export const PRICING_PLANS = [
  {
    name: 'Free Starter',
    price: '₹0',
    desc: 'List your first screen and begin receiving direct bookings from advertisers.',
    features: ['1 connected screen player', 'Community support channels', '10% platform sales commission'],
    cta: 'Get Started Free',
  },
  {
    name: 'Professional Network',
    price: '₹1,490',
    period: 'mo',
    desc: 'For growing networks wanting premium layouts, analytics, and lower commissions.',
    features: ['Up to 10 connected players', 'Priority 24/7 ticket support', '5% platform sales commission', 'Custom layout zone splits'],
    cta: 'Upgrade to Pro',
    featured: true,
  },
  {
    name: 'Enterprise Scale',
    price: 'Custom',
    desc: 'For national agencies and massive display networks requiring dedicated setups.',
    features: ['Unlimited screens & nodes', 'Dedicated account manager', '2% custom sales commission', 'White-labeled player OS'],
    cta: 'Contact Sales',
  },
];
