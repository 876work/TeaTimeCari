import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '@supabase/auth-helpers-react';
import { Menu, X } from 'lucide-react';
import { NotificationBell } from './Notifications/NotificationBell';

interface SiteHeaderProps {
  showNotifications?: boolean;
}

const navigationLinks = [
  { label: 'Home', to: '/', end: true },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Community', to: '/community' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact Us', to: '/contact-us' },
];

const linkFocusClass = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#7D78B4]';
const joinNowClass = 'rounded-full bg-gradient-to-r from-[#D96F7F] via-[#B78DB5] to-[#5CA4C8] text-white shadow-md shadow-[#2E6F91]/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2E6F91]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#7D78B4]';
const glassButtonClass = `rounded-full border border-white/25 bg-white/15 text-sm font-bold text-[#11263F] backdrop-blur-md transition hover:bg-white/25 ${linkFocusClass}`;

export function SiteHeader({ showNotifications = false }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const session = useSession();
  const location = useLocation();
  const isAuthenticated = Boolean(session?.user);

  React.useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = () => setIsMenuOpen(false);

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group rounded-full px-1 py-2 text-sm font-semibold transition ${
      isActive ? 'text-[#11263F]' : 'text-[#11263F]/85 hover:text-[#11263F]'
    } ${linkFocusClass}`;

  const getMobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-white/20 ${
      isActive ? 'bg-white/15 text-[#11263F]' : 'text-[#11263F]'
    } ${linkFocusClass}`;

  return (
    <header className="relative z-20 w-full px-3 pt-3 sm:px-5 sm:pt-5">
      <nav aria-label="Site navigation" className="mx-auto w-full max-w-5xl">
        <div className="flex min-h-14 items-center justify-between gap-3 rounded-full border border-white/25 bg-white/15 px-3 py-2 text-[#11263F] shadow-sm shadow-[#11263F]/10 backdrop-blur-xl sm:min-h-16 sm:px-4 lg:px-5">
          <Link
            to="/"
            aria-label="Go to Tea Time Cari homepage"
            className={`inline-flex shrink-0 items-center rounded-full ${linkFocusClass}`}
            onClick={closeMenu}
          >
            <img
              src="/teaLogo.png"
              alt="Tea Time Cari"
              className="h-10 w-10 object-contain drop-shadow-sm sm:h-12 sm:w-12 lg:h-14 lg:w-14"
            />
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-5 md:flex lg:gap-7">
            {navigationLinks.map((link) => (
              <NavLink key={link.label} to={link.to} end={link.end} className={getNavLinkClass}>
                {({ isActive }) => (
                  <span
                    className={`relative after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-center after:rounded-full after:bg-white/80 after:transition-transform ${
                      isActive ? 'after:scale-x-100' : 'after:scale-x-0 group-hover:after:scale-x-100'
                    }`}
                  >
                    {link.label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {showNotifications && isAuthenticated && <NotificationBell />}
            {isAuthenticated ? (
              <>
                <NavLink to="/profile" className={`${glassButtonClass} px-4 py-2`}>
                  Profile
                </NavLink>
                <Link to="/logout" className={`${glassButtonClass} px-4 py-2`}>
                  Log Out
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className={`${glassButtonClass} px-4 py-2`}>
                  Log In
                </Link>
                <Link to="/signup" className={`${joinNowClass} px-4 py-2 text-sm font-bold lg:px-5`}>
                  Join Now
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-[#11263F] shadow-sm backdrop-blur-md transition hover:bg-white/25 md:hidden ${linkFocusClass}`}
          >
            {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen && (
          <div
            id="site-mobile-menu"
            className="mt-3 rounded-2xl border border-white/25 bg-white/15 p-2 shadow-lg shadow-[#11263F]/10 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1">
              {navigationLinks.map((link) => (
                <NavLink
                  key={link.label}
                  to={link.to}
                  end={link.end}
                  onClick={closeMenu}
                  className={getMobileNavLinkClass}
                >
                  {link.label}
                </NavLink>
              ))}
              {showNotifications && isAuthenticated && (
                <div className="mt-2 flex items-center justify-between rounded-xl border-t border-white/20 px-4 py-3">
                  <span className="text-sm font-semibold text-[#11263F]">Notifications</span>
                  <NotificationBell />
                </div>
              )}
              <div className="mt-2 grid gap-2 border-t border-white/20 pt-3">
                {isAuthenticated ? (
                  <>
                    <NavLink
                      to="/profile"
                      onClick={closeMenu}
                      className={({ isActive }) => `${glassButtonClass} px-4 py-3 text-center ${isActive ? 'bg-white/20' : ''}`}
                    >
                      Profile
                    </NavLink>
                    <Link to="/logout" onClick={closeMenu} className={`${glassButtonClass} px-4 py-3 text-center`}>
                      Log Out
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={closeMenu} className={`${glassButtonClass} px-4 py-3 text-center`}>
                      Log In
                    </Link>
                    <Link
                      to="/signup"
                      onClick={closeMenu}
                      className={`${joinNowClass} px-4 py-3 text-center text-sm font-bold`}
                    >
                      Join Now
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
