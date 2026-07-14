/**
 * LandingPage — renders the cinematic pitch page.
 *
 * The pitch page is a standalone HTML file (public/pitch.html) that uses
 * Tailwind CDN, Iconify, and vanilla JS for panel switching. It is served
 * via a fullscreen iframe to avoid any style conflicts with the React/MUI app.
 */
export default function LandingPage() {
  return (
    <iframe
      src="/pitch.html"
      title="PixelSpot — The OS for DOOH"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        border: 'none',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
      allow="autoplay; encrypted-media"
    />
  );
}
