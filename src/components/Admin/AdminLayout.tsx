import React from 'react';
import { Shield, Users, Flag, FileText, BarChart3, Home, MessageSquare, Activity } from 'lucide-react';
import { LogoutButton } from '../Auth/LogoutButton';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage?: string;
  onNavigate?: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  mobileLabel?: string;
  icon: React.ReactNode;
}

export function AdminLayout({ children, activePage = 'dashboard', onNavigate }: AdminLayoutProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'user-reviews', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'flagged-posts', label: 'Flagged Posts', icon: <Flag className="w-4 h-4" /> },
    { id: 'discourse-admins', label: 'Community Admins', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'logs', label: 'Audit Logs', mobileLabel: 'Logs', icon: <FileText className="w-4 h-4" /> },
    { id: 'function-ping', label: 'Health', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-admin-bg text-admin-fg">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950 shadow-admin">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-admin-brand rounded-admin-md flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-white font-semibold text-sm leading-tight block">Tea Time Cari</span>
                <span className="text-slate-400 text-xs leading-tight block">Admin Portal</span>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => (window.location.href = '/')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white text-xs font-medium transition-colors rounded-md hover:bg-slate-800"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Main App</span>
              </button>
              <LogoutButton variant="ghost" size="md" />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-admin-border bg-admin-surface shadow-admin-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.(item.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'border-admin-brand text-admin-brand'
                      : 'border-transparent text-admin-muted-fg hover:border-slate-300 hover:text-admin-fg'
                  }`}
                >
                  <span className={isActive ? 'text-admin-brand' : 'text-slate-400'}>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.mobileLabel ?? item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-admin-border bg-admin-surface mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Tea Time Cari &mdash; Admin Portal
            </p>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
