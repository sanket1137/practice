import LegalLayout from '../../components/legal/LegalLayout';

export default function ContentPolicy() {
  const sections = [
    { id: 'purpose', title: '1. Purpose & Scope' },
    { id: 'political', title: '2. Political & Social Advertisements' },
    { id: 'adult', title: '3. Adult & Sexually Explicit Content' },
    { id: 'violence-weapons', title: '4. Violence, Weapons, & Hate Speech' },
    { id: 'illegal-substances', title: '5. Illegal Substances & Drugs' },
    { id: 'intellectual-property', title: '6. Copyright Infringement & Intellectual Property' },
    { id: 'malware-spam', title: '7. Malware, Spam, & Network Exploits' },
    { id: 'moderation-approval', title: '8. Campaign Approval & Moderation Process' },
    { id: 'violations', title: '9. Violations & Account Suspensions' },
    { id: 'contact', title: '10. Report Violations' },
  ];

  return (
    <LegalLayout title="Content Policy" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. Purpose & Scope */}
      <section id="purpose" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Purpose & Scope</h2>
        <p>
          PixelSpot operates a nationwide Digital Out-of-Home (DOOH) network, delivering campaigns to thousands of screens in public spaces, commercial complexes, transit hubs, and outdoor screens. Because DOOH media is highly visible to audiences of all ages, strict standards must be maintained.
        </p>
        <p>
          This Content Policy defines acceptable and prohibited creatives, ensuring a safe, legal, and respectful experience for the public. All advertisers, agencies, and partners must strictly adhere to these guidelines.
        </p>
      </section>

      {/* 2. Political & Social Advertisements */}
      <section id="political" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Political & Social Advertisements</h2>
        <p>
          To maintain neutral, safe, and commercial focus in public spaces, we do not permit:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Political party campaigns, candidate promotion, or election materials.</li>
          <li>Lobbying content, controversial political statements, or materials targeting government policy debates.</li>
          <li>Advocacy messages that provoke public distress, social division, or community friction.</li>
        </ul>
      </section>

      {/* 3. Adult & Sexually Explicit Content */}
      <section id="adult" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Adult & Sexually Explicit Content</h2>
        <p>
          We do not permit the broadcast of sexually suggestive, crude, or adult-themed creatives:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Nudity, graphic sexuality, or depictions of explicit sexual behaviors.</li>
          <li>Promotions for adult entertainment, clubs, escort services, or highly suggestive dating portals.</li>
          <li>Vulgar, offensive, or obscene text and audio messages.</li>
        </ul>
      </section>

      {/* 4. Violence, Weapons, & Hate Speech */}
      <section id="violence-weapons" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Violence, Weapons, & Hate Speech</h2>
        <p>
          We enforce a zero-tolerance policy against violent, aggressive, or discriminatory content:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Images showing physical violence, blood, torture, or bodily harm.</li>
          <li>Advertisements showcasing guns, assault weapons, explosive materials, or direct weapons sales.</li>
          <li>Hate speech targeting racial groups, religions, castes, nationalities, genders, or sexual orientations.</li>
        </ul>
      </section>

      {/* 5. Illegal Substances & Drugs */}
      <section id="illegal-substances" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. Illegal Substances & Drugs</h2>
        <p>
          Creatives promoting controlled or illegal products are banned from our network. This includes tobacco products, electronic cigarettes, vaping setups, cannabis, narcotics, and prescription drugs without license validation. Inside specific Indian states, alcohol advertisements are restricted to surrogacy guidelines.
        </p>
      </section>

      {/* 6. Copyright Infringement & Intellectual Property */}
      <section id="intellectual-property" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. Copyright Infringement & Intellectual Property</h2>
        <p>
          Advertisers must ensure they hold the copyright, license, or explicit authorization to use all text, videos, images, logos, and audio tracks in their uploaded media. Any ad containing pirated, unlicensed, or counterfeit assets will be flagged and removed.
        </p>
      </section>

      {/* 7. Malware, Spam, & Network Exploits */}
      <section id="malware-spam" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Malware, Spam, & Network Exploits</h2>
        <p>
          For digital displays running interactive web widgets:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>We do not permit the execution of obfuscated JavaScript, cryptomining scripts, network exploits, or data scraping loops.</li>
          <li>Redirect pages linked from displays (such as QR codes) must not link to malware, spam, phishing websites, or credential theft portals.</li>
        </ul>
      </section>

      {/* 8. Campaign Approval & Moderation Process */}
      <section id="moderation-approval" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. Campaign Approval & Moderation Process</h2>
        <p>
          Every uploaded ad campaign is held in a "Pending Audit" state prior to broadcast on hardware players:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Our audits team reviews files to check resolution sizing, visual speed loops, frame rates, and guidelines compliance.</li>
          <li>The standard review window takes 24 hours. The approval status is updated on your dashboard console.</li>
        </ul>
      </section>

      {/* 9. Violations & Account Suspensions */}
      <section id="violations" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. Violations & Account Suspensions</h2>
        <p>
          Violations of this Content Policy will result in the immediate suspension of active campaigns, deletion of the violating media, and forfeiture of associated play slot bookings. Repeated violations will result in permanent account termination.
        </p>
      </section>

      {/* 10. Report Violations */}
      <section id="contact" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. Report Violations</h2>
        <p>
          If you observe violating or offensive content on a PixelSpot display, report it to our trust and safety desk:
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
