// Entry for the static marketing page (index.html) — self-hosted styling
// and icons so the page works under the strict production CSP.
// Icon *data* still loads from api.iconify.design at runtime (allowed by
// connect-src); only executable scripts must be first-party.
import './landing.css';
import 'iconify-icon';
