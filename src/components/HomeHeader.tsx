import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navigationLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '#about' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact Us', to: '/contact-us' },
];

export function HomeHeader() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="relative z-20 w-full px-2 pt-2 sm:px-4 sm:pt-4">
      <nav
        aria-label="Homepage navigation"
        className="mx-auto max-w-6xl rounded-3xl border border-white/45 bg-white/75 px-4 py-3 text-[#11263F] shadow-xl shadow-[#11263F]/10 backdrop-blur-xl sm:px-5"
      >
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="Go to Tea Time Cari homepage"
            className="inline-flex items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#7D78B4]"
            onClick={closeMenu}
          >
            <img
              src="/teaLogo.png"
              alt="Tea Time Cari"
              className="h-auto w-32 object-contain sm:w-36 lg:w-40"
            />
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {navigationLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#11263F]/80 transition hover:bg-white/80 hover:text-[#11263F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85F8E]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-full border border-[#11263F]/10 bg-white px-5 py-2.5 text-sm font-bold text-[#11263F] shadow-sm transition hover:border-white hover:bg-white/90 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85F8E]"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-gradient-to-r from-[#C85F8E] to-[#11263F] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#11263F]/15 transition hover:shadow-xl hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#7D78B4]"
            >
              Join Now
            </Link>
          </div>

          <button
            type="button"
            aria-label={isMenuOpen ? 'Close homepage navigation menu' : 'Open homepage navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="home-mobile-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#11263F]/10 bg-white/80 text-[#11263F] shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85F8E] md:hidden"
          >
            {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen && (
          <div
            id="home-mobile-menu"
            className="mt-4 rounded-2xl border border-white/50 bg-white/85 p-2 shadow-lg backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1">
              {navigationLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={closeMenu}
                  className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#11263F]/85 transition hover:bg-[#F7ECF4] hover:text-[#11263F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85F8E]"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 grid gap-2 border-t border-[#11263F]/10 pt-3">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="rounded-full border border-[#11263F]/10 bg-white px-4 py-3 text-center text-sm font-bold text-[#11263F] shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85F8E]"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="rounded-full bg-gradient-to-r from-[#C85F8E] to-[#11263F] px-4 py-3 text-center text-sm font-bold text-white shadow-md transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85F8E]"
                >
                  Join Now
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
