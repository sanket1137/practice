import LegalLayout from '../../components/legal/LegalLayout';

export default function AboutUs() {
  const sections = [
    { id: 'who-we-are', title: '1. Who We Are' },
    { id: 'vision', title: '2. Our Vision' },
    { id: 'mission', title: '3. Our Mission' },
    { id: 'values', title: '4. Core Values' },
  ];

  return (
    <LegalLayout title="About Us" lastUpdated="July 18, 2026" sections={sections}>
      
      {/* Who We Are */}
      <section id="who-we-are" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">1. Who We Are</h2>
        <p className="text-lg">
          <strong>PIXELSPOT SOLUTIONS PRIVATE LIMITED</strong> is a leading technology provider in the Digital Out-of-Home (DOOH) advertising sector. Founded in 2025 and headquartered in Mumbai, India, we build state-of-the-art software systems to bridge the gap between offline displays and online demand.
        </p>
        <p>
          Pixelspot is India's Digital Out-of-Home (DOOH) advertising marketplace, making it effortless for brands to reach audiences on digital screens and for screen owners to monetize their inventory.
        </p>
        <p>
          Our platform provides end-to-end management, real-time proof-of-play metrics, and automated booking, bringing the transparency and efficiency of online advertising to the physical world.
        </p>
      </section>

      {/* Our Vision */}
      <section id="vision" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">2. Our Vision</h2>
        <p>
          We aim to digitize the physical landscape of out-of-home advertising, enabling advertisers to launch hyper-targeted, transparent campaigns on screens in premium venues across India.
        </p>
      </section>

      {/* Our Mission */}
      <section id="mission" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">3. Our Mission</h2>
        <p>
          Our mission is to democratize outdoor advertising by offering screen owners a robust cloud-based operating system to manage their displays, and by offering brands direct self-serve tools to plan, verify, and measure campaign plays.
        </p>
      </section>

      {/* Core Values */}
      <section id="values" className="space-y-4 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-white">4. Core Values</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Transparency First</h4>
            <p className="text-sm text-gray-400">We believe in timestamped audits and transparent marketplace pricing rules with zero hidden commissions.</p>
          </div>
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h4 className="text-white font-medium mb-1">Marketplace Integrity</h4>
            <p className="text-sm text-gray-400">All coordinate locations and screen inventories are rigorously audited to ensure advertiser safety.</p>
          </div>
        </div>
      </section>

    </LegalLayout>
  );
}
