import React from "react";
import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  ExternalLink,
  FileText,
  Flag,
  Globe2,
  Home,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Search,
  Shield,
  ToggleLeft,
  Users,
  X,
} from "lucide-react";
import { useSession } from "@supabase/auth-helpers-react";
import { LogoutButton } from "../Auth/LogoutButton";
import { AdminCommandPalette } from "./AdminCommandPalette";

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage?: string;
  onNavigate?: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Overview",
    description: "Dashboard summary",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: "user-reviews",
    label: "Users",
    description: "Review registrations",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "flagged-posts",
    label: "Moderation",
    description: "Flagged posts",
    icon: <Flag className="h-4 w-4" />,
  },
  {
    id: "payments",
    label: "Payments",
    description: "Revenue & billing",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    id: "geography",
    label: "Geography",
    description: "Member map",
    icon: <Globe2 className="h-4 w-4" />,
  },
  {
    id: "invites",
    label: "Invites",
    description: "Email invites & codes",
    icon: <Mail className="h-4 w-4" />,
  },
  {
    id: "announcements",
    label: "Announcements",
    description: "Banners & broadcasts",
    icon: <Megaphone className="h-4 w-4" />,
  },
  {
    id: "discourse-admins",
    label: "Community",
    description: "Discourse admins",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    id: "roles",
    label: "Roles",
    description: "Admin permissions",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "flags",
    label: "Feature flags",
    description: "Kill switches",
    icon: <ToggleLeft className="h-4 w-4" />,
  },
  {
    id: "alerts",
    label: "Alerts",
    description: "Slack alerting",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: "logs",
    label: "Logs",
    description: "Audit trail",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "function-ping",
    label: "Health",
    description: "System checks",
    icon: <Activity className="h-4 w-4" />,
  },
];

function getActiveNavItem(activePage: string) {
  return navItems.find((item) => item.id === activePage) ?? navItems[0];
}

export function AdminLayout({
  children,
  activePage = "dashboard",
  onNavigate,
}: AdminLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const session = useSession();

  const activeItem = getActiveNavItem(activePage);
  const adminEmail = session?.user?.email ?? "Admin";

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleNavigate = (page: string) => {
    onNavigate?.(page);
    setMobileNavOpen(false);
  };

  const navigation = (
    <nav aria-label="Admin sections" className="space-y-1.5">
      {navItems.map((item) => {
        const isActive = activePage === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavigate(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ease-out active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple ${
              isActive
                ? "bg-white/20 text-white shadow-sm"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/60 ring-1 ring-white/10 group-hover:text-white"
              }`}
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              <span
                className={`block truncate text-xs font-normal ${
                  isActive ? "text-white/70" : "text-white/40"
                }`}
              >
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="admin-shell relative min-h-screen text-white">
      <div
        className="fixed inset-0 -z-20 bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]"
        aria-hidden="true"
      />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <aside className="admin-glass fixed inset-y-4 left-4 z-40 hidden w-72 flex-col rounded-3xl px-4 py-5 lg:flex">
        <div className="flex items-center gap-3 px-2 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Tea Time Cari
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
              Admin
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">{navigation}</div>

        <div className="space-y-2 border-t border-white/15 pt-4">
          <a
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple"
          >
            <Home className="h-4 w-4 text-white/50" aria-hidden="true" />
            Main app
            <ExternalLink
              className="ml-auto h-3.5 w-3.5 text-white/40"
              aria-hidden="true"
            />
          </a>

          <LogoutButton
            variant="ghost"
            size="md"
            className="flex w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus:ring-white/70"
          />
        </div>
      </aside>

      <div className="lg:pl-80">
        <header className="admin-glass sticky top-4 z-30 mx-4 rounded-3xl sm:mx-6 lg:mx-6">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-expanded={mobileNavOpen}
                aria-controls="admin-mobile-navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple lg:hidden"
              >
                <span className="sr-only">Toggle admin navigation</span>
                {mobileNavOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
                  {activeItem.label}
                </h1>
                <p className="truncate text-xs text-white/60">
                  {activeItem.description}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple"
                aria-label="Open search (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50 md:inline">⌘K</kbd>
              </button>

              <a
                href="/"
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple sm:inline-flex lg:hidden xl:inline-flex"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Main app
              </a>

              <div className="hidden min-w-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 sm:block">
                <span className="block max-w-[180px] truncate">
                  {adminEmail}
                </span>
              </div>

              <LogoutButton
                variant="ghost"
                size="md"
                className="px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white focus:ring-white/70 lg:hidden xl:inline-flex"
              />
            </div>
          </div>

          {mobileNavOpen && (
            <div
              id="admin-mobile-navigation"
              className="border-t border-white/15 px-4 py-4 lg:hidden"
            >
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Tea Time Cari
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
                    Admin
                  </p>
                </div>
              </div>

              {navigation}
            </div>
          )}
        </header>

        <main className="admin-page-enter mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>

      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
