import React from 'react';
import { Shield, Users, Flag, FileText, BarChart3, Home, MessageSquare } from 'lucide-react';
import { LogoutButton } from '../Auth/LogoutButton';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage?: string;
  onNavigate?: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export function AdminLayout({ children, activePage = 'dashboard', onNavigate }: AdminLayoutProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'user-reviews', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'flagged-posts', label: 'Flagged Posts', icon: <Flag className="w-4 h-4" /> },
    { id: 'discourse-admins', label: 'Discourse/Community Admins', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'logs', label: 'Logs', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
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
      <nav className="bg-white border-b border-slate-200 shadow-sm">
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
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.icon}</span>
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
      <footer className="bg-white border-t border-slate-200 mt-auto">
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
