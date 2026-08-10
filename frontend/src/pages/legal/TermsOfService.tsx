import LegalLayout from '../../components/legal/LegalLayout';

export default function TermsOfService() {
  const sections = [
    { id: 'introduction', title: '1. Introduction & Acceptance' },
    { id: 'eligibility', title: '2. Eligibility & Verification' },
    { id: 'accounts', title: '3. Organization Accounts & Roles' },
    { id: 'subscriptions', title: '4. Subscriptions & Billing' },
    { id: 'campaign-credits', title: '5. Campaign Credits' },
    { id: 'ad-content', title: '6. Advertising Content Guidelines' },
    { id: 'prohibited-content', title: '7. Prohibited Content' },
    { id: 'roles-responsibilities', title: '8. Participant Responsibilities' },
    { id: 'player-software', title: '9. Player Software Licenses' },
    { id: 'api-usage', title: '10. API Access & Rate Limits' },
    { id: 'analytics-disclaimer', title: '11. Analytics & Accuracy Disclaimers' },
    { id: 'maintenance', title: '12. Platform Maintenance & Slates' },
    { id: 'termination', title: '13. Termination & Suspension' },
    { id: 'liability', title: '14. Liability Limitation' },
    { id: 'indemnity', title: '15. Indemnification' },
    { id: 'intellectual-property', title: '16. Intellectual Property & Open Source' },
    { id: 'force-majeure', title: '17. Force Majeure' },
    { id: 'disputes', title: '18. Governing Law & Arbitration' },
    { id: 'contact', title: '19. Contact Details' },
  ];

  return (
    <LegalLayout title="Terms of Service" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. Introduction */}
      <section id="introduction" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Introduction & Acceptance</h2>
        <p>
          Welcome to PixelSpot. These Terms of Service ("Terms") constitute a legally binding agreement between PIXELSPOT SOLUTIONS PRIVATE LIMITED ("PixelSpot", "we", "our", or "us") and the individual or legal entity accessing or using our cloud-based Digital Out-of-Home (DOOH) Advertising Operating System and platform ("Platform").
        </p>
        <p>
          By creating an account, connecting hardware screens, purchasing ad space, or using any services on the Platform, you accept and agree to be bound by these Terms, our Privacy Policy, Content Policy, and all applicable laws. If you do not agree, you must immediately cease using the Platform.
        </p>
      </section>

      {/* 2. Eligibility & Verification */}
      <section id="eligibility" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Eligibility & Verification</h2>
        <p>
          You must be at least 18 years of age and hold the legal authority to bind your organization to these Terms.
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
          <h3 className="text-lg font-medium text-white">Identity Verification Protocols</h3>
          <p className="text-sm text-gray-400">
            To maintain network integrity, PixelSpot reserves the right to request proof of identity and business registration documents (including GST registration, PAN cards, corporate certificates, or address proofs) at any time. Accounts that fail verification may be suspended immediately.
          </p>
        </div>
      </section>

      {/* 3. Organization Accounts & Roles */}
      <section id="accounts" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Organization Accounts & Roles</h2>
        <p>
          Users can set up Organization profiles to collaborate across workspaces:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Role Definitions:</strong> Accounts support hierarchy roles, including Organization Owner, Admin, Campaign Manager, Billing Manager, and Viewer. Owners are liable for all actions executed by their designated administrators.</li>
          <li><strong>Permissions:</strong> Access is controlled via strictly enforced Role-Based Access Control (RBAC). You are responsible for ensuring correct permission configurations inside your workspace.</li>
          <li><strong>Account Security:</strong> You must protect credentials and API keys. Any unauthorized session access should be reported to support immediately.</li>
        </ul>
      </section>

      {/* 4. Subscriptions & Billing */}
      <section id="subscriptions" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Subscriptions & Billing</h2>
        <p>
          Our platform operates on a SaaS licensing model with tiered subscription fees:
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-2">Free Trial / Starter</h4>
            <p className="text-sm text-gray-400">Limited to a single screen, basic layouts, and standard delivery metrics.</p>
          </div>
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-2">Professional</h4>
            <p className="text-sm text-gray-400">Multi-screen sync, diagnostic logs, custom loops, and standard support access.</p>
          </div>
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-2">Enterprise</h4>
            <p className="text-sm text-gray-400">Custom integrations, dedicated servers, custom SLAs, and custom analytical systems.</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          <strong>Taxation & GST:</strong> All purchases on the Platform are subject to standard GST (18%) inside India. Auto-renewals are applied to monthly and annual plans unless cancelled at least 48 hours prior to the next billing cycle. Failure to pay will result in account downgrade or suspension.
        </p>
      </section>

      {/* 5. Campaign Credits */}
      <section id="campaign-credits" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. Campaign Credits</h2>
        <p>
          Advertisers buy media placements utilizing Campaign Credits or direct billing transactions. Placed credits represent pre-purchased ad displays. Unused credits expire 365 days from the date of issuance unless stated otherwise in an enterprise invoice. Credits are non-transferable and hold no real monetary equivalent outside of PixelSpot.
        </p>
      </section>

      {/* 6. Advertising Content Guidelines */}
      <section id="ad-content" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. Advertising Content Guidelines</h2>
        <p>
          Advertisers retain the intellectual property rights to their uploaded creative media:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Upload Rules:</strong> Content must comply with specific screen specifications (resolution, frame rate, aspect ratios). Overly loud, flashy, or low-quality assets are rejected.</li>
          <li><strong>Campaign Approvals:</strong> To ensure public safety and compliance, every campaign is subject to an manual approval window (typically 24 hours) prior to display on external players.</li>
        </ul>
      </section>

      {/* 7. Prohibited Content */}
      <section id="prohibited-content" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Prohibited Content</h2>
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-3xl space-y-3">
          <p className="text-white font-medium">Content Restrictions:</p>
          <p className="text-sm text-gray-400">
            PixelSpot restricts the display of specific content types on the DOOH network. We do not permit:
          </p>
          <ul className="grid md:grid-cols-2 gap-2 list-none text-xs text-gray-400 pl-0">
            <li>&#10060; Political advertisements or election campaigns</li>
            <li>&#10060; Adult services or sexually explicit materials</li>
            <li>&#10060; Violent imagery, weapons, or hate speech</li>
            <li>&#10060; Tobacco, illicit drugs, or illegal substances</li>
            <li>&#10060; Content infringing copyright patents</li>
            <li>&#10060; Malware, scripts, or network exploit attempts</li>
          </ul>
        </div>
      </section>

      {/* 8. Participant Responsibilities */}
      <section id="roles-responsibilities" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. Participant Responsibilities</h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>
            <strong>Screen Owners</strong> must keep hardware players online, clean physical display modules, maintain internet connections, ensure electrical stability, and satisfy local zoning laws.
          </p>
          <p>
            <strong>Advertisers</strong> must guarantee that they own the intellectual rights to all creatives and hold active clearance certifications for trademarked logos.
          </p>
          <p>
            <strong>PixelSpot</strong> acts as a marketplace and technology host, coordinating player loops and distributing log certifications.
          </p>
        </div>
      </section>

      {/* 9. Player Software Licenses */}
      <section id="player-software" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. Player Software Licenses</h2>
        <p>
          We grant a limited, non-exclusive, revocable license to install the PixelSpot Player Client onto physical media players:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Offline Playback:</strong> The client stores ad schedules to ensure continuous playback when network connections drop.</li>
          <li><strong>Updates:</strong> Client players automatically download firmware patches and asset files. Bandwidth usage is controlled via player-side storage throttles.</li>
        </ul>
      </section>

      {/* 10. API Access & Rate Limits */}
      <section id="api-usage" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. API Access & Rate Limits</h2>
        <p>
          For developers accessing platform APIs:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Rate limits are applied (standard limit: 120 calls per minute per API token).</li>
          <li>We reserve the right to suspend API tokens that attempt server stress tests or try scraping data.</li>
        </ul>
      </section>

      {/* 11. Analytics & Accuracy Disclaimers */}
      <section id="analytics-disclaimer" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">11. Analytics & Accuracy Disclaimers</h2>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl text-sm space-y-3">
          <p><strong>Audience Traffic Statistics:</strong> Impressions, views, and audience reach graphs are statistical estimations generated using diagnostic loops, edge vision sensors, and local density records. They do not constitute absolute human tallies.</p>
          <p><strong>Revenue & ROI guarantees:</strong> PixelSpot does not guarantee that listing screens will earn revenue, nor do we promise that advertisers will achieve a specific return on investment (ROI) or sales conversion rate.</p>
        </div>
      </section>

      {/* 12. Platform Maintenance & Slates */}
      <section id="maintenance" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">12. Platform Maintenance & Slates</h2>
        <p>
          We execute scheduled system upgrades (typically between 02:00 AM and 04:00 AM IST) which may limit client dashboard functions. Emergency server maintenance is deployed when immediate security updates are required. Players continue running offline playlists during server maintenance periods.
        </p>
      </section>

      {/* 13. Termination & Suspension */}
      <section id="termination" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">13. Termination & Suspension</h2>
        <p>
          We may suspend or terminate your account access immediately if you violate these Terms, fail to pay invoices, upload prohibited content, run unauthorized API scripts, or damage the reputation of the digital network.
        </p>
      </section>

      {/* 14. Liability Limitation */}
      <section id="liability" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">14. Liability Limitation</h2>
        <p>
          To the maximum extent permitted by law, PIXELSPOT SOLUTIONS PRIVATE LIMITED shall not be liable for any indirect, incidental, consequential, special, or exemplary damages, including lost revenue, system downtime, physical screen blackouts, or corrupted media logs, arising out of the use of our services.
        </p>
      </section>

      {/* 15. Indemnification */}
      <section id="indemnity" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">15. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless PixelSpot, its directors, officers, employees, and agents from any claims, damages, liabilities, costs, and expenses (including legal fees) arising from your violation of these Terms or infringement of third-party intellectual property rights.
        </p>
      </section>

      {/* 16. Intellectual Property & Open Source */}
      <section id="intellectual-property" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">16. Intellectual Property & Open Source</h2>
        <p>
          The layout, dashboard design, core system codes, logo trademarks, and software databases are the exclusive property of PixelSpot. We leverage certain open-source software libraries, which are licensed under standard MIT or Apache 2.0 terms.
        </p>
      </section>

      {/* 17. Force Majeure */}
      <section id="force-majeure" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">17. Force Majeure</h2>
        <p>
          Neither party shall be liable for delays or failures in performance resulting from acts beyond their reasonable control, including power grid gridlock, country-wide telecom blackout, government regulations, natural disasters, or strikes.
        </p>
      </section>

      {/* 18. Governing Law & Arbitration */}
      <section id="disputes" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">18. Governing Law & Arbitration</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any dispute arising out of or in connection with these Terms shall be referred to and resolved by binding arbitration in Bangalore, Karnataka, India, under the provisions of the Arbitration and Conciliation Act, 1996.
        </p>
      </section>

      {/* 19. Contact Details */}
      <section id="contact" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">19. Contact Details</h2>
        <p>
          For formal inquiries or notices under these Terms, contact:
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2 text-sm text-gray-400">
          <p className="text-white font-medium">PIXELSPOT SOLUTIONS PRIVATE LIMITED</p>
          <p>Email: <a href="mailto:contact@pixelspot.in" className="text-[var(--accent)] hover:underline">contact@pixelspot.in</a></p>
          <p>Address: 17, 2nd Floor, 7th Main Road, Indiranagar Second Stage, Bangalore, Karnataka, 560038</p>
        </div>
      </section>

    </LegalLayout>
  );
}
