import { Facebook, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';

const APP_STORE_URL = 'https://apps.apple.com/app/tea-time-cari';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.teatimecari';

type FooterLink = {
  label: string;
  to: string;
};

type FooterLinkGroup = {
  title: string;
  links: FooterLink[];
};

const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Home', to: '/' },
      { label: 'How It Works', to: '/how-it-works' },
      { label: 'Community', to: '/community' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Anonymous Mode', to: '/anonymous-mode' },
      { label: 'Contact Us', to: '/contact-us' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign Up', to: '/signup' },
      { label: 'Log In', to: '/login' },
      { label: 'Profile', to: '/profile' },
      { label: 'Forgot Password', to: '/forgot-password' },
      { label: 'Log Out', to: '/logout' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms of Service', to: '/terms-of-service' },
      { label: 'Community Guidelines', to: '/community-guidelines' },
      { label: 'Anonymous Mode Explained', to: '/anonymous-mode' },
    ],
  },
];

const socialLinks = [
  {
    label: 'Instagram',
    href: 'http://instagram.com/teatimecari',
    Icon: Instagram,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/people/Tea-Time-Cari/61590153702836/',
    Icon: Facebook,
  },
];

function AppleStoreBadge() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" aria-hidden="true" className="h-full w-full">
      <rect width="120" height="40" rx="6" fill="#000" />
      <text x="38" y="13" fontFamily="system-ui, sans-serif" fontSize="7" fill="#fff" opacity="0.85">Download on the</text>
      <text x="38" y="26" fontFamily="system-ui, sans-serif" fontSize="13" fontWeight="700" fill="#fff">App Store</text>
      {/* Apple logo path */}
      <path d="M18.5 10.2c1.1-1.3 1.8-3.1 1.6-4.9-1.6.1-3.4 1-4.5 2.3-1 1.1-1.8 2.9-1.6 4.7 1.7.1 3.4-.9 4.5-2.1zm1.6 2.6c-2.5-.1-4.6 1.4-5.8 1.4-1.2 0-3-1.3-5-1.3C6.6 13 3.9 14.7 2.5 17.4c-2.8 4.8-.7 12 2 15.9 1.3 1.9 2.9 4 5 4 2 0 2.7-1.3 5.1-1.3 2.4 0 3 1.3 5 1.3s3.5-1.9 4.8-3.8c1.5-2.2 2.1-4.3 2.2-4.4-.1 0-4.2-1.6-4.3-6.4-.1-4 3.3-5.9 3.5-6-.2-.1-3.3-3.3-6.7-3.4z" fill="#fff" transform="translate(0, 3) scale(0.85)" />
    </svg>
  );
}

function PlayStoreBadge() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 135 40" aria-hidden="true" className="h-full w-full">
      <rect width="135" height="40" rx="6" fill="#000" />
      <text x="44" y="13" fontFamily="system-ui, sans-serif" fontSize="7" fill="#fff" opacity="0.85">GET IT ON</text>
      <text x="44" y="27" fontFamily="system-ui, sans-serif" fontSize="13" fontWeight="700" fill="#fff">Google Play</text>
      {/* Simple play triangle */}
      <polygon points="16,12 16,28 28,20" fill="url(#gp)" />
      <defs>
        <linearGradient id="gp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="100%" stopColor="#a8ed64" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/60 bg-gradient-to-br from-white via-[#F8FBFD] to-[#F9E3E3]/70 text-slate-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(75,158,200,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(155,107,174,0.16),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2fr)] lg:gap-16">
          <div className="max-w-md">
            <Link
              to="/"
              aria-label="Tea Time Cari home"
              className="inline-flex items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-4"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-white/80">
                <img src="/teaLogo.png" alt="" className="h-10 w-10 object-contain" />
              </span>
              <span className="text-xl font-black tracking-tight text-slate-900">Tea Time Cari</span>
            </Link>

            <p className="mt-5 text-lg font-semibold text-slate-900">Share. Compare. Stay informed.</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A private Caribbean community built around real stories, thoughtful conversations, and community support.
            </p>

            {/* App store badges */}
            <div className="mt-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#3382AA]">Available on</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Download Tea Time Cari on the App Store"
                  className="inline-block h-10 w-[120px] overflow-hidden rounded-lg shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2"
                >
                  <AppleStoreBadge />
                </a>
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get Tea Time Cari on Google Play"
                  className="inline-block h-10 w-[135px] overflow-hidden rounded-lg shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2"
                >
                  <PlayStoreBadge />
                </a>
              </div>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="grid gap-8 sm:grid-cols-3">
            {footerLinkGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#3382AA]">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="text-sm font-medium text-slate-600 transition hover:text-[#9B6BAE] focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-slate-200/80 pt-6 sm:mt-12 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-600">© 2026 Tea Time Cari. All rights reserved.</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Privacy first. Community focused.</p>
          </div>

          <div className="mt-5 flex items-center gap-3 sm:mt-0">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#4B9EC8] hover:text-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
