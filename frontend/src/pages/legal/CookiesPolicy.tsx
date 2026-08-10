import LegalLayout from '../../components/legal/LegalLayout';

export default function CookiesPolicy() {
  const sections = [
    { id: 'overview', title: '1. What Are Cookies?' },
    { id: 'how-use', title: '2. How We Use Cookies' },
    { id: 'essential', title: '3. Essential Cookies' },
    { id: 'auth', title: '4. Authentication Cookies' },
    { id: 'preferences', title: '5. Preference Cookies' },
    { id: 'analytics', title: '6. Analytics & Performance Cookies' },
    { id: 'marketing', title: '7. Marketing & Target Cookies' },
    { id: 'session-persist', title: '8. Session vs Persistent Cookies' },
    { id: 'user-control', title: '9. How to Control Cookies' },
    { id: 'updates', title: '10. Policy Modifications' },
    { id: 'contact', title: '11. Queries' },
  ];

  return (
    <LegalLayout title="Cookies Policy" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* 1. What Are Cookies? */}
      <section id="overview" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. What Are Cookies?</h2>
        <p>
          Cookies are small text files containing a string of characters that are downloaded to your computer or mobile device when you visit a website or web application.
        </p>
        <p>
          Cookies allow websites to recognize your device, collect basic traffic information, record user options, and keep you securely authenticated. PixelSpot uses these files to personalize, secure, and monitor browser sessions on our digital signage operating system console.
        </p>
      </section>

      {/* 2. How We Use Cookies */}
      <section id="how-use" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. How We Use Cookies</h2>
        <p>
          We employ cookies and browser storage technologies to keep our platform secure, count unique page visits, track user dashboard layout choices, verify active logins, and target relevant updates. We group our cookies into the categories detailed below.
        </p>
      </section>

      {/* 3. Essential Cookies */}
      <section id="essential" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Essential Cookies</h2>
        <p>
          These cookies are strictly necessary to deliver services available through our Platform and to support core features (such as load balancing, CSRF tokens, and security filters). Because these are mandatory, they cannot be turned off without breaking console functionality.
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4 text-sm text-gray-400">
          <p><strong>CSRF Token Cookie:</strong> Prevents cross-site request forgery attacks on forms.</p>
          <p><strong>Session ID Cookie:</strong> Manages web application server routing requests.</p>
        </div>
      </section>

      {/* 4. Authentication Cookies */}
      <section id="auth" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Authentication Cookies</h2>
        <p>
          These cookies identify when you log in to our console, allowing you to access dashboard settings, upload media creatives, and book campaigns without retyping credentials on every subpage.
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4 text-sm text-gray-400">
          <p><strong>Auth Token Cookie:</strong> Stores secure JWT (JSON Web Tokens) to authenticate API requests.</p>
          <p><strong>Remember Me Cookie:</strong> Retains encrypted session keys to keep you logged in between browser restarts.</p>
        </div>
      </section>

      {/* 5. Preference Cookies */}
      <section id="preferences" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">5. Preference Cookies</h2>
        <p>
          These cookies save choices you make on our Platform, such as preferred dashboard theme colors (light or dark), screen inventory list columns, sorting options, and local language formats.
        </p>
      </section>

      {/* 6. Analytics & Performance Cookies */}
      <section id="analytics" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">6. Analytics & Performance Cookies</h2>
        <p>
          These files gather statistics about how visitors navigate the Platform, helping us discover bugs, count unique console users, identify slow pages, and benchmark dashboard loading times.
        </p>
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4 text-sm text-gray-400">
          <p><strong>Google Analytics Cookie:</strong> Tracks anonymous usage behaviors, session paths, and click actions.</p>
          <p><strong>Sentry Logger Cookie:</strong> Records Javascript errors and front-end script failures to assist developers.</p>
        </div>
      </section>

      {/* 7. Marketing & Target Cookies */}
      <section id="marketing" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">7. Marketing & Target Cookies</h2>
        <p>
          PixelSpot may deploy marketing cookies to measure the effectiveness of our promotion runs and to deliver targeted product updates or franchise announcements related to our DOOH network.
        </p>
      </section>

      {/* 8. Session vs Persistent Cookies */}
      <section id="session-persist" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">8. Session vs Persistent Cookies</h2>
        <p>
          Cookies can exist as <strong>Session Cookies</strong> (which are temporary files deleted automatically from your device's memory when you close your browser tab) or <strong>Persistent Cookies</strong> (which remain stored on your hard drive for a set duration, such as 30 days, to identify your return to the platform).
        </p>
      </section>

      {/* 9. How to Control Cookies */}
      <section id="user-control" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">9. How to Control Cookies</h2>
        <p>
          You hold the right to accept or block cookies. You can adjust your preferences via our built-in Cookies Consent Banner, or configure your browser options to reject cookies. Be aware that blocking essential cookies will make the PixelSpot console dashboard completely unusable.
        </p>
      </section>

      {/* 10. Policy Modifications */}
      <section id="updates" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">10. Policy Modifications</h2>
        <p>
          We may update our Cookies Policy from time to time to reflect changes in our tools or regulatory guidelines. We recommend reviewing this document regularly to stay informed.
        </p>
      </section>

      {/* 11. Queries */}
      <section id="contact" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">11. Queries</h2>
        <p>
          For queries concerning our use of cookies:
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
