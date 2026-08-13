import LegalLayout from '../../components/legal/LegalLayout';

export default function CommunityGuidelines() {
  const sections = [
    { id: 'purpose', title: '1. Shared Ecosystem Purpose' },
    { id: 'respectful', title: '2. Professional Conduct & Communication' },
    { id: 'advertiser-guidelines', title: '3. Guidelines for Advertisers & Agencies' },
    { id: 'screen-owner-guidelines', title: '4. Guidelines for Screen Owners & Operators' },
    { id: 'coordinate-integrity', title: '5. Coordinate & Location Integrity' },
    { id: 'standards', title: '6. Advertising Standards & Public Space Ethics' },
    { id: 'pricing-ethics', title: '7. Dynamic Pricing & Marketplace Fairness' },
    { id: 'monitoring-reports', title: '8. Abuse, Spam, & Reporting Measures' },
    { id: 'consequences', title: '9. Enforcement Action & Accountability' },
    { id: 'contact', title: '10. Partner Support' },
  ];

  return (
    <LegalLayout title="Community Guidelines" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. Shared Ecosystem Purpose */}
      <section id="purpose" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Shared Ecosystem Purpose</h2>
        <p>
          PixelSpot operates as a shared, transparent, digital out-of-home (DOOH) marketplace that connects media screen owners with advertisers and agencies across India.
        </p>
        <p>
          These Community Guidelines outline the standard of conduct and ethical behavior expected from all platform participants. Our mission is to promote trust, ensure physical coordinate accuracy, keep displays functioning safely, and guarantee advertising standards.
        </p>
      </section>

      {/* 2. Professional Conduct & Communication */}
      <section id="respectful" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Professional Conduct & Communication</h2>
        <p>
          All partners (screen owners, advertisers, developers, support agents) must communicate respectfully. We do not tolerate threats, hate speech, abusive support chats, commercial harassment, or attempts to bribe partners for better placements.
        </p>
      </section>

      {/* 3. Guidelines for Advertisers & Agencies */}
      <section id="advertiser-guidelines" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Guidelines for Advertisers & Agencies</h2>
        <p>
          Advertisers using the console to execute campaign runs must agree to:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Quality Integrity:</strong> Submit high-resolution creatives formatted correctly for target displays.</li>
          <li><strong>Clear Claims:</strong> Avoid false product claims, misleading prices, or fake metrics on display loops.</li>
          <li><strong>Licensing:</strong> Ensure all trademarks, music tracks, and fonts are fully licensed.</li>
        </ul>
      </section>

      {/* 4. Guidelines for Screen Owners & Operators */}
      <section id="screen-owner-guidelines" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Guidelines for Screen Owners & Operators</h2>
        <p>
          Partners listing physical digital billboards, signage screens, or in-store displays must:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Hardware Maintenance:</strong> Keep media players online, clean physical display panels, and ensure power stability.</li>
          <li><strong>Playback Audits:</strong> Keep the playback loop functioning in accordance with platform logs and scheduling contracts.</li>
          <li><strong>Offline Management:</strong> Ensure local offline loops match the default playlists set in the console configuration.</li>
        </ul>
      </section>

      {/* 5. Coordinate & Location Integrity */}
      <section id="coordinate-integrity" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. Coordinate & Location Integrity</h2>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-3">
          <p className="text-white font-medium">Physical Accuracy Requirements:</p>
          <p className="text-sm text-gray-400">
            Falsifying coordinates or screen attributes is a serious violation. Screen Owners must:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-500 pl-4">
            <li>Ensure registered latitudes/longitudes represent the exact placement of the hardware screen.</li>
            <li>Maintain accurate display sizing, aspect ratios, and resolution metrics in the console profile.</li>
            <li>Declare true average traffic counts based on validated local demographic statistics.</li>
          </ul>
        </div>
      </section>

      {/* 6. Advertising Standards & Public Space Ethics */}
      <section id="standards" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. Advertising Standards & Public Space Ethics</h2>
        <p>
          Because DOOH media cannot be skipped or turned off by the public, advertisements must conform to public decency standards. Creatives should not display extreme strobe lights that pose a distraction to nearby drivers, or contain audio tracks exceeding local municipal decibel levels.
        </p>
      </section>

      {/* 7. Pricing & Marketplace Fairness */}
      <section id="pricing-ethics" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Dynamic Pricing & Marketplace Fairness</h2>
        <p>
          Dynamic loop auctions and spot bookings must follow marketplace parameters. Manipulation of bid pricing, executing sybil attack reviews, listing phantom screens, or artificially inflating playback logs using mock players is strictly prohibited.
        </p>
      </section>

      {/* 8. Abuse, Spam, & Reporting Measures */}
      <section id="monitoring-reports" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. Abuse, Spam, & Reporting Measures</h2>
        <p>
          We rely on our community to keep the marketplace clean. If you identify partners violating pricing ethics, listing false coordinates, or broadcasting unlicensed media, submit a ticket via the dashboard console to notify our safety desks.
        </p>
      </section>

      {/* 9. Enforcement Action & Accountability */}
      <section id="consequences" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. Enforcement Action & Accountability</h2>
        <p>
          PixelSpot audits compliance continuously. Enforcement actions for guideline violations include warnings, campaign audits, pricing restrictions, payout holds, device blocking, temporary account suspensions, or permanent blacklist status.
        </p>
      </section>

      {/* 10. Partner Support */}
      <section id="contact" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. Partner Support</h2>
        <p>
          For queries concerning partner guidelines or enforcement disputes, contact our partner desk:
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
