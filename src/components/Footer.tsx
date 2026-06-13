import { Link } from 'react-router-dom';

const APP_STORE_URL = 'https://teatimecari.app';
const PLAY_STORE_URL = 'https://teatimecari.app';

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
    img: '/IG_logo.png',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/people/Tea-Time-Cari/61590153702836/',
    img: '/FB_logo.png',
  },
];

function AppleStoreBadge() {
  return (
    <img
      src="/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg"
      alt="Download on the App Store"
      className="h-full w-full object-contain"
    />
  );
}

function PlayStoreBadge() {
  return (
    <img
      src="/GetItOnGooglePlay_Badge_Web_color_English.png"
      alt="Get it on Google Play"
      className="h-full w-full object-contain"
    />
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
            {socialLinks.map(({ label, href, img }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#4B9EC8] hover:text-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2"
              >
                <img src={img} alt={label} className="h-5 w-5 object-contain" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
