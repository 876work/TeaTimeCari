import React from "react";
import {
  Activity,
  BarChart3,
  ExternalLink,
  FileText,
  Flag,
  Home,
  Menu,
  MessageSquare,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useSession } from "@supabase/auth-helpers-react";
import { LogoutButton } from "../Auth/LogoutButton";

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
    id: "discourse-admins",
    label: "Community",
    description: "Discourse admins",
    icon: <MessageSquare className="h-4 w-4" />,
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
    description: "Function checks",
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
  const session = useSession();

  const activeItem = getActiveNavItem(activePage);
  const adminEmail = session?.user?.email ?? "Admin";

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
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ease-out active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white ${
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                isActive
                  ? "bg-white/15 text-white"
                  : "bg-white text-slate-400 ring-1 ring-slate-200 group-hover:text-slate-700"
              }`}
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              <span
                className={`block truncate text-xs font-normal ${
                  isActive ? "text-slate-300" : "text-slate-400"
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
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white/95 px-4 py-5 shadow-sm backdrop-blur lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-950">
              Tea Time Cari
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Admin
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">{navigation}</div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <a
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Home className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Main app
            <ExternalLink
              className="ml-auto h-3.5 w-3.5 text-slate-300"
              aria-hidden="true"
            />
          </a>

          <LogoutButton
            variant="ghost"
            size="md"
            className="flex w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:ring-blue-500"
          />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-expanded={mobileNavOpen}
                aria-controls="admin-mobile-navigation"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 lg:hidden"
              >
                <span className="sr-only">Toggle admin navigation</span>
                {mobileNavOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">
                  Admin / {activeItem.label}
                </p>
                <h1 className="truncate text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
                  {activeItem.label}
                </h1>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <a
                href="/"
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:inline-flex lg:hidden xl:inline-flex"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Main app
              </a>

              <div className="hidden min-w-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 sm:block">
                <span className="block max-w-[180px] truncate">
                  {adminEmail}
                </span>
              </div>

              <LogoutButton
                variant="ghost"
                size="md"
                className="px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:ring-blue-500 lg:hidden xl:inline-flex"
              />
            </div>
          </div>

          {mobileNavOpen && (
            <div
              id="admin-mobile-navigation"
              className="border-t border-slate-200 bg-white px-4 py-4 shadow-sm lg:hidden"
            >
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Tea Time Cari
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
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
    </div>
  );
}