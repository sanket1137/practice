import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Section {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  sections: Section[];
  children: React.ReactNode;
}

export default function LegalLayout({ title, lastUpdated, sections, children }: LegalLayoutProps) {
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      let currentSection = '';
      
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            currentSection = section.id;
          }
        }
      }
      setActiveSection(currentSection || (sections[0]?.id || ''));
    };

    window.addEventListener('scroll', handleScroll);
    // Initial call to set active section
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-medium tracking-wide text-white hover:text-white/80 transition-colors">PixelSpot</Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 border border-white/10 rounded-full hover:bg-white/5">Console</Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 container mx-auto px-6 py-12 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          
          {/* Sticky Sidebar Navigation (Desktop only) */}
          <aside className="lg:col-span-1 hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 space-y-6">
              <div>
                <h3 className="text-xs font-semibold tracking-wider text-white uppercase mb-4">Table of Contents</h3>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={`block text-sm py-1.5 border-l-2 pl-3 transition-colors ${
                        activeSection === section.id
                          ? 'border-[var(--accent,rgb(94,106,210))] text-white font-medium'
                          : 'border-white/5 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* Document Content */}
          <main className="lg:col-span-3 space-y-12">
            <div className="border-b border-white/10 pb-8">
              <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">{title}</h1>
              <p className="text-sm text-gray-500">Last Updated: {lastUpdated}</p>
            </div>
            
            <div className="prose prose-invert max-w-none text-gray-400 space-y-12 leading-relaxed">
              {children}
            </div>
          </main>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/90 py-16 text-xs text-gray-500 mt-auto">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-4">
              <span className="text-white text-base font-semibold tracking-wide">PixelSpot</span>
              <p className="max-w-md leading-relaxed text-gray-400">
                PixelSpot is India's Digital Out-of-Home (DOOH) advertising marketplace and operating system, connecting brands with thousands of digital screens nationwide.
              </p>
              <div className="space-y-1 text-gray-500">
                <p>PIXELSPOT SOLUTIONS PRIVATE LIMITED</p>
                <p>CIN: U26103KA2025PTC201293</p>
                <p>GSTIN: 29AAPCP6653G1ZT</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Company Links</h4>
                <nav className="flex flex-col gap-2.5">
                  <a href="/about" className="hover:text-white transition-colors">About Us</a>
                  <a href="/contact" className="hover:text-white transition-colors">Contact Us</a>
                </nav>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Legal Agreements</h4>
                <nav className="flex flex-col gap-2.5">
                  <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                  <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
                  <a href="/refund" className="hover:text-white transition-colors">Refund Policy</a>
                  <a href="/cookies" className="hover:text-white transition-colors">Cookies Policy</a>
                </nav>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>&copy; {new Date().getFullYear()} PixelSpot. All rights reserved.</div>
            <div className="text-gray-600">Office: 17, 2nd Floor, 7th Main Road, Indiranagar Second Stage, Bangalore, Karnataka, 560038</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
