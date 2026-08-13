import LegalLayout from '../../components/legal/LegalLayout';

export default function Disclaimer() {
  const sections = [
    { id: 'general', title: '1. General Platform Information' },
    { id: 'diagnostics', title: '2. Hardware & Diagnostic Accuracy Disclaimer' },
    { id: 'offline-playback', title: '3. Offline Caching & Playback Issues' },
    { id: 'screen-availability', title: '4. Dynamic Screen Availability Fluctuations' },
    { id: 'no-revenue', title: '5. No Revenue Guarantees for Screen Owners' },
    { id: 'no-roi', title: '6. No ROI or Conversions Guarantees for Advertisers' },
    { id: 'third-party-links', title: '7. Third-Party Integrations & Services' },
    { id: 'warranties', title: '8. No Warranties ("As-Is" Status)' },
    { id: 'liability-cap', title: '9. Liability Cap Exemption' },
    { id: 'contact', title: '10. Legal Desk' },
  ];

  return (
    <LegalLayout title="Legal Disclaimer" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. General Platform Information */}
      <section id="general" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. General Platform Information</h2>
        <p>
          The information, services, and diagnostic reports available through the PixelSpot platform (including the operating system, applications, dashboards, API services, and associated websites) are provided by PIXELSPOT SOLUTIONS PRIVATE LIMITED for commercial out-of-home advertising management.
        </p>
        <p>
          By accessing the Platform, you acknowledge that you have read and understood the technical limits, operational constraints, and liability limitations detailed below.
        </p>
      </section>

      {/* 2. Hardware & Diagnostic Accuracy Disclaimer */}
      <section id="diagnostics" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Hardware & Diagnostic Accuracy Disclaimer</h2>
        <p>
          PixelSpot collects screen status records, play logs, network latency rates, temperature metrics, and hardware diagnostics from third-party media players:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong>Data Sources:</strong> Platform diagnostic charts rely on sensors, operating system logs, and player reporting software. We do not guarantee that these logs represent absolute, error-free physical measurements.</li>
          <li><strong>Traffic Estimates:</strong> All footfall, demographic estimations, attention measurements, and gaze durations are statistical indicators based on local algorithms. They are not direct, manual human census audits.</li>
        </ul>
      </section>

      {/* 3. Offline Caching & Playback Issues */}
      <section id="offline-playback" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Offline Caching & Playback Issues</h2>
        <p>
          To ensure stable ad delivery, the PixelSpot player client caches media files locally to play offline when network connections drop:
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-3">
          <p className="text-white font-medium">Caching & Offline Disclosures:</p>
          <p className="text-sm text-gray-400">
            During internet outages or player disconnections:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-500 pl-4">
            <li>Media player loops will repeat local cache files. We are not liable for delayed updates during local network outages.</li>
            <li>Play logs are saved locally and synced back to the servers when connections resume. Log updates may be delayed due to player connection issues.</li>
          </ul>
        </div>
      </section>

      {/* 4. Dynamic Screen Availability Fluctuations */}
      <section id="screen-availability" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Dynamic Screen Availability Fluctuations</h2>
        <p>
          PixelSpot acts as a DOOH media marketplace. Physical screens are owned, operated, and powered by third-party Screen Owners. Consequently, screen availability, active screen loops, physical display resolutions, operational business hours, and placement coordinates are subject to change. PixelSpot is not liable for temporary screen shutdowns, power outages, local code blackouts, or lease terminations.
        </p>
      </section>

      {/* 5. No Revenue Guarantees for Screen Owners */}
      <section id="no-revenue" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. No Revenue Guarantees for Screen Owners</h2>
        <p>
          Screen Owners listing hardware on the marketplace understand that listings do not guarantee campaign bookings or advertising revenue. Earning rates depend on market demand, display size, target coordinates, loop competitive pricing, and advertiser budgets.
        </p>
      </section>

      {/* 6. No ROI or Conversions Guarantees for Advertisers */}
      <section id="no-roi" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. No ROI or Conversions Guarantees for Advertisers</h2>
        <p>
          Advertisers booking screen loops acknowledge that PixelSpot makes no guarantees regarding campaign return on investment (ROI), audience response rates, business sales conversions, or specific brand awareness metrics.
        </p>
      </section>

      {/* 7. Third-Party Integrations & Services */}
      <section id="third-party-links" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Third-Party Integrations & Services</h2>
        <p>
          The Platform integrates with third-party software, including payment providers (Razorpay, Stripe), map APIs (Google Maps), notification services, and cloud hosting (Microsoft Azure). PixelSpot is not liable for service outages, billing errors, or data issues originating from these third-party platforms.
        </p>
      </section>

      {/* 8. No Warranties ("As-Is" Status) */}
      <section id="warranties" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. No Warranties ("As-Is" Status)</h2>
        <p>
          The Platform is provided on an "As-Is" and "As-Available" basis without warranties of any kind, whether express, implied, or statutory. We disclaim all warranties of merchantability, fitness for a particular purpose, non-infringement, security reliability, and error-free operation.
        </p>
      </section>

      {/* 9. Liability Cap Exemption */}
      <section id="liability-cap" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. Liability Cap Exemption</h2>
        <p>
          Under no circumstances shall PixelSpot or PIXELSPOT SOLUTIONS PRIVATE LIMITED be liable for system downtime, revenue loss, client data deletion, or player hardware failures, except as provided under the specific liability caps in our Terms of Service.
        </p>
      </section>

      {/* 10. Legal Desk */}
      <section id="contact" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. Legal Desk</h2>
        <p>
          For queries concerning our Legal Disclaimer or platform limits:
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
