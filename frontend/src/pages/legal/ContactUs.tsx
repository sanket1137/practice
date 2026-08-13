import LegalLayout from '../../components/legal/LegalLayout';

export default function ContactUs() {
  const sections = [
    { id: 'channels', title: '1. Contact Channels' },
    { id: 'office', title: '2. Corporate Office' },
    { id: 'hours', title: '3. Business Hours' },
  ];

  return (
    <LegalLayout title="Contact Us" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* Contact Channels */}
      <section id="channels" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Contact Channels</h2>
        <p className="text-gray-400">Reach out to us through any of the channels below.</p>
        
        <div className="grid md:grid-cols-2 gap-8 mb-6">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-2">
            <h3 className="text-lg font-semibold text-white">Direct Phone</h3>
            <p className="text-2xl text-[var(--accent)] font-medium">
              <a href="tel:+919082604430" className="hover:underline">+91 90826 04430</a>
            </p>
            <p className="text-sm text-gray-505">Available during business hours</p>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-2">
            <h3 className="text-lg font-semibold text-white">Email Us</h3>
            <p className="text-xl text-[var(--accent)] font-medium">
              <a href="mailto:contact@pixelspot.in" className="hover:underline">contact@pixelspot.in</a>
            </p>
            <p className="text-sm text-gray-505">We typically respond within 24 hours</p>
          </div>
        </div>
      </section>

      {/* Corporate Office */}
      <section id="office" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Corporate Office</h2>
        <div className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4">
          <p className="text-gray-400 leading-relaxed">
            17, 2nd Floor, 7th Main Road,<br />
            Indiranagar, Second Stage,<br />
            Bangalore, Karnataka, India — 560038
          </p>
        </div>
      </section>

      {/* Business Hours */}
      <section id="hours" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Business Hours</h2>
        <p className="text-gray-400 leading-relaxed">
          Monday through Friday: 9:30 AM to 6:30 PM IST.<br />
          For critical hardware emergencies or screen loop downtime issues, please log in to the CCMS console to raise high-priority support tickets.
        </p>
      </section>

    </LegalLayout>
  );
}
