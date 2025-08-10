import React from 'react';
import { Shield, Users, Flag, Key, BarChart3, FileText, Home } from 'lucide-react';
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
  description: string;
}

export function AdminLayout({ children, activePage = 'dashboard', onNavigate }: AdminLayoutProps) {
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      description: 'Overview and statistics'
    },
    {
      id: 'user-reviews',
      label: 'Review Users',
      icon: <Users className="w-5 h-5" />,
      description: 'Approve pending registrations'
    },
    {
      id: 'flagged-posts',
      label: 'Flagged Posts',
      icon: <Flag className="w-5 h-5" />,
      description: 'Moderate reported content'
    },
    {
      id: 'invite-codes',
      label: 'Invite Codes',
      icon: <Key className="w-5 h-5" />,
      description: 'Manage invitation codes'
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: <FileText className="w-5 h-5" />,
      description: 'View moderation logs'
    },
    {
      id: 'function-ping',
      label: 'Function Ping (Dev)',
      icon: <Shield className="w-5 h-5" />,
      description: 'Test Edge Function connectivity'
    }
  ];

  const handleNavClick = (pageId: string) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  const handleGoToMainApp = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <Shield className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Tea Time Cari</h1>
                    <p className="text-xs text-gray-500">Admin Dashboard</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleGoToMainApp}
                className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                title="Go to main app"
              >
                <Home className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Main App</span>
              </button>
              <LogoutButton variant="ghost" size="md" />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  title={item.description}
                >
                  <span className={`mr-2 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              © 2024 Tea Time Cari Admin Panel
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-400">
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}