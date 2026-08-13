import LegalLayout from '../../components/legal/LegalLayout';

export default function PrivacyPolicy() {
  const sections = [
    { id: 'introduction', title: '1. Introduction' },
    { id: 'definitions', title: '2. Definitions' },
    { id: 'info-collect', title: '3. Information We Collect' },
    { id: 'account-info', title: '4. Account Information' },
    { id: 'campaign-info', title: '5. Campaign Information' },
    { id: 'media-files', title: '6. Media Files' },
    { id: 'player-device', title: '7. Player & Device Information' },
    { id: 'location-data', title: '8. Location Data' },
    { id: 'usage-analytics', title: '9. Usage Analytics' },
    { id: 'payment-info', title: '10. Payment Information' },
    { id: 'cookies', title: '11. Cookies' },
    { id: 'third-party', title: '12. Third Party Services' },
    { id: 'ai-features', title: '13. AI Features' },
    { id: 'audience-analytics', title: '14. Audience Analytics' },
    { id: 'data-sharing', title: '15. Data Sharing' },
    { id: 'security', title: '16. Security Protocols' },
    { id: 'data-retention', title: '17. Data Retention' },
    { id: 'user-rights', title: '18. User Rights' },
    { id: 'children', title: '19. Children\'s Privacy' },
    { id: 'international-transfers', title: '20. International Transfers' },
    { id: 'policy-updates', title: '21. Policy Updates' },
    { id: 'contact-info', title: '22. Contact Information' },
  ];

  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. Introduction */}
      <section id="introduction" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Introduction</h2>
        <p>
          At PixelSpot, we are committed to safeguarding the privacy and security of your data. This Privacy Policy outlines how PIXELSPOT SOLUTIONS PRIVATE LIMITED ("PixelSpot", "we", "our", or "us") collects, uses, processes, and stores information when you use our cloud-based Digital Out-of-Home (DOOH) Advertising Operating System, applications, and associated services (collectively, the "Platform").
        </p>
        <p>
          We operate under strict compliance with the Digital Personal Data Protection (DPDP) Act of India, general global data protection regulations, and advertising industry standards. By registering an account or executing campaigns on our Platform, you acknowledge the terms of this Policy.
        </p>
      </section>

      {/* 2. Definitions */}
      <section id="definitions" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Definitions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Platform</h4>
            <p className="text-sm text-gray-400">The centralized cloud-based DOOH operating system, software integrations, and tools provided by PixelSpot.</p>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Account</h4>
            <p className="text-sm text-gray-400">A registered profile giving access to the Platform configuration for Screen Owners, Advertisers, or Agencies.</p>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Campaign</h4>
            <p className="text-sm text-gray-400">A structured advertising run containing media, scheduling, budget, and targeting criteria to display content on screens.</p>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Advertiser</h4>
            <p className="text-sm text-gray-400">An individual or organization purchasing ad slots to display brand messages across digital screens.</p>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Screen Owner</h4>
            <p className="text-sm text-gray-400">A partner who registers physical digital screens with PixelSpot to monetize inventory and manage displays.</p>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Personal Data</h4>
            <p className="text-sm text-gray-400">Any information relating to an identified or identifiable natural person.</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Additionally, <strong>Player</strong> refers to the physical hardware running the PixelSpot client software, <strong>Content</strong> denotes files uploaded to screens, <strong>Processing</strong> describes any operation performed on data, <strong>Cookies</strong> are identifiers stored on your devices, and <strong>Analytics</strong> means performance metric systems.
        </p>
      </section>

      {/* 3. Information We Collect */}
      <section id="info-collect" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Information We Collect</h2>
        <p>
          We collect various types of information to provide, maintain, and optimize the DOOH network features.
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
          <h3 className="text-lg font-medium text-white">Categories of Personal Information</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li><strong>Identify Details:</strong> First Name, Last Name, and Profile Photo.</li>
            <li><strong>Contact Details:</strong> Business Email Address and Direct Phone Number.</li>
            <li><strong>Corporate Info:</strong> Company Name, GSTIN Registration, Billing Address, and Business Address.</li>
            <li><strong>Identity Verification:</strong> Government IDs (e.g., PAN Card, Aadhaar, or Corporate Registration) when required for invoicing compliance and fraud prevention.</li>
            <li><strong>Support Conversations:</strong> Transcript records of interactions, emails, and direct chat support.</li>
          </ul>
        </div>
      </section>

      {/* 4. Account Information */}
      <section id="account-info" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Account Information</h2>
        <p>
          To secure your profile and define access limits, we collect and store:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Credentials:</strong> Account usernames and passwords. All passwords are encrypted and hashed before storage; we can never view your password.</li>
          <li><strong>OAuth Providers:</strong> Login keys when you sign in via Google, LinkedIn, or Microsoft Authentication.</li>
          <li><strong>Workspace Details:</strong> Assigned user roles (Admin, Moderator, Campaign Manager), specific feature permissions, organization links, and workspace team boundaries.</li>
        </ul>
      </section>

      {/* 5. Campaign Information */}
      <section id="campaign-info" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. Campaign Information</h2>
        <p>
          We store operational records related to advertising campaigns, which includes campaign name, allocated budgets, schedule durations, location filters, target media formats, and real-time campaign performance logs (such as played counts, conversions, impressions, and verified analytics reports).
        </p>
      </section>

      {/* 6. Media Files */}
      <section id="media-files" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. Media Files</h2>
        <p>
          PixelSpot processes creative files uploaded to our cloud servers for delivery to physical players:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Formats:</strong> Videos, images, HTML widgets, document assets, and file metadata (aspect ratio, duration, frame rate).</li>
          <li><strong>Optimization:</strong> Creative files are automatically transcoded and compressed to ensure stable offline play on player hardware.</li>
          <li><strong>Retention:</strong> Active media is retained indefinitely while a campaign is running. Archive files can be deleted manually or automatically according to account retention rules.</li>
        </ul>
      </section>

      {/* 7. Player & Device Information */}
      <section id="player-device" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Player & Device Information</h2>
        <p>
          To monitor device health and ensure correct playback of advertisements, our player client software gathers:
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
          <ul className="grid md:grid-cols-2 gap-4 list-none text-sm text-gray-400 pl-0">
            <li className="flex gap-2"><span>&#10003;</span> Player ID & MAC Address</li>
            <li className="flex gap-2"><span>&#10003;</span> Device model, OS type & browser version</li>
            <li className="flex gap-2"><span>&#10003;</span> Heartbeat packets & network connection speed</li>
            <li className="flex gap-2"><span>&#10003;</span> Operating status (Android, Windows, Fire TV, Raspberry Pi, Linux)</li>
            <li className="flex gap-2"><span>&#10003;</span> Diagnostics, screen health, storage space, and app versions</li>
            <li className="flex gap-2"><span>&#10003;</span> Real-time playback logs for campaign validation</li>
          </ul>
        </div>
      </section>

      {/* 8. Location Data */}
      <section id="location-data" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. Location Data</h2>
        <p>
          We capture geographic location records to allow advertisers to map displays. This includes approximate location, GPS coordinates (if explicitly configured on the hardware player), IP addresses, city, country, and local timezone settings.
        </p>
      </section>

      {/* 9. Usage Analytics */}
      <section id="usage-analytics" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. Usage Analytics</h2>
        <p>
          To optimize dashboard navigation, we collect event records on your interactive sessions, including logins, clicked links, dashboard searches, features used, pages viewed, loading times, browser crash incidents, and dashboard configurations.
        </p>
      </section>

      {/* 10. Payment Information */}
      <section id="payment-info" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. Payment Information</h2>
        <p>
          All transaction payments on the platform are handled via encrypted payment integrations:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>We issue invoices reflecting transaction histories, subscription records, taxes, and GST details.</li>
          <li><strong>No Card Data Storage:</strong> PixelSpot does not store credit card numbers, CVVs, or bank logins. All transactions are securely outsourced to PCI-DSS compliant third-party processors (Razorpay and Stripe).</li>
        </ul>
      </section>

      {/* 11. Cookies */}
      <section id="cookies" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">11. Cookies</h2>
        <p>
          We use browser cookies to optimize platform performance. These are divided into Essential Cookies (for authentication and keeping you logged in), Preference Cookies (saving layout styles), Analytics Cookies (aggregating usage data), and Session Cookies (deleted automatically when you close the browser tab). For full details, please refer to our Cookies Policy.
        </p>
      </section>

      {/* 12. Third Party Services */}
      <section id="third-party" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">12. Third Party Services</h2>
        <p>
          We share metadata with selected SaaS integrations to maintain platform operations:
        </p>
        <div className="space-y-4 text-sm text-gray-400">
          <p><strong>Microsoft Azure:</strong> Primary secure cloud hosting, media databases, and database storage.</p>
          <p><strong>Firebase:</strong> Dashboard usage analysis and push notification updates.</p>
          <p><strong>Cloudflare:</strong> DDOS shield, security firewall, and global content delivery network (CDN) routing.</p>
          <p><strong>Razorpay & Stripe:</strong> Handling encrypted transaction payments, subscriptions, and payouts.</p>
          <p><strong>Google Maps:</strong> Translating screen locations to interactive search maps.</p>
        </div>
      </section>

      {/* 13. AI Features */}
      <section id="ai-features" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">13. AI Features</h2>
        <p>
          PixelSpot utilizes machine learning algorithms to audit campaign creatives, suggest optimal pricing structures, schedule content, and forecast audience traffic.
        </p>
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-3xl">
          <p className="text-white font-medium">Important Privacy Protections:</p>
          <p className="text-sm mt-1">Our AI systems do not process personal identities, do not deploy facial recognition systems, and never collect biometric templates.</p>
        </div>
      </section>

      {/* 14. Audience Analytics */}
      <section id="audience-analytics" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">14. Audience Analytics</h2>
        <p>
          For select premium displays, screen owners may enable local camera devices to calculate viewing counts:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Scope:</strong> Real-time estimation of footfall numbers, general traffic, age-bracket estimation, gender percentages, gaze direction, attention duration, and vehicle classification.</li>
          <li><strong>Privacy Protection:</strong> Computations are executed locally at the edge (on the player hardware). No image or video stream is ever sent to or stored in our cloud database. All outputs are converted to pure numerical aggregated charts.</li>
          <li><strong>No Face Recognition:</strong> Our technology does not capture facial identities, does not register individual faces, and never creates biometric signatures. All audience measurements are completely anonymous.</li>
        </ul>
      </section>

      {/* 15. Data Sharing */}
      <section id="data-sharing" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">15. Data Sharing</h2>
        <p>
          PixelSpot does not sell, trade, or rent user personal data to third parties. We share information only when necessary to process payments, coordinate logistics, comply with legal warrants, enforce platform security, or satisfy government audits.
        </p>
      </section>

      {/* 16. Security Protocols */}
      <section id="security" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">16. Security Protocols</h2>
        <p>
          We employ industry-leading mechanisms to keep your data secure, including HTTPS web traffic, TLS 1.3 socket encryption, Argon2id password hashing, strict role-based access control (RBAC), database transaction audit logs, daily cloud database backups, and network threat monitors.
        </p>
      </section>

      {/* 17. Data Retention */}
      <section id="data-retention" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">17. Data Retention</h2>
        <p>
          We retain active account metrics only as long as needed to fulfill legal compliance:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Campaign Metrics & Played Logs:</strong> Stored for 7 years to facilitate advertiser reporting and audit trails.</li>
          <li><strong>Media Files:</strong> Deleted 90 days after campaign expiration unless archived by the user.</li>
          <li><strong>Invoices & Payment Ledgers:</strong> Kept for 8 financial years in accordance with Indian tax regulations.</li>
          <li><strong>Support Tickets:</strong> Retained for 3 years to maintain historical support context.</li>
        </ul>
      </section>

      {/* 18. User Rights */}
      <section id="user-rights" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">18. User Rights</h2>
        <p>
          Under active DPDP legislation, you hold specific rights over your information, including the right to request access to your profile data, edit incorrect details, demand file deletion, request account data exports, restrict automated processing, or withdraw platform consent at any time.
        </p>
      </section>

      {/* 19. Children's Privacy */}
      <section id="children" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">19. Children's Privacy</h2>
        <p>
          Our platform is exclusively intended for corporate commercial use and is not designed for individuals under the age of 18. We do not knowingly collect personal details from minors.
        </p>
      </section>

      {/* 20. International Transfers */}
      <section id="international-transfers" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">20. International Transfers</h2>
        <p>
          While our core databases are hosted in data centers in India, system tasks and CDNs may route static media packages across global servers. We enforce strict data protection agreements with all infrastructure suppliers.
        </p>
      </section>

      {/* 21. Policy Updates */}
      <section id="policy-updates" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">21. Policy Updates</h2>
        <p>
          We may modify this Privacy Policy from time to time. When edits are made, the "Last Updated" date at the top of this page will be revised, and significant updates will be notified via email or dashboard alert.
        </p>
      </section>

      {/* 22. Contact Information */}
      <section id="contact-info" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">22. Contact Information</h2>
        <p>
          For queries or assistance, contact our Data Protection Officer:
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2 text-sm text-gray-400">
          <p className="text-white font-medium">PIXELSPOT SOLUTIONS PRIVATE LIMITED</p>
          <p>Email: <a href="mailto:contact@pixelspot.in" className="text-[var(--accent)] hover:underline">contact@pixelspot.in</a></p>
          <p>Phone: +91 90826 04430</p>
          <p>Address: 17, 2nd Floor, 7th Main Road, Indiranagar Second Stage, Bangalore, Karnataka, 560038</p>
        </div>
      </section>

    </LegalLayout>
  );
}
