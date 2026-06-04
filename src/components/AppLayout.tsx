import React from 'react';
import { Link } from 'react-router-dom';
import { NotificationBell } from './Notifications/NotificationBell';
import { LogoutButton } from './Auth/LogoutButton';
import { User } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]">
      {/* Header with Notifications */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/teaLogo.png" alt="Tea Time Cari" className="w-10 h-10 object-contain" />
              <h1 className="text-xl font-bold text-gray-900">Tea Time Cari</h1>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/profile"
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#4B9EC8] hover:text-[#4B9EC8] focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2"
                aria-label="Open your profile and security settings"
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
              <NotificationBell />
              <LogoutButton variant="ghost" size="md" />
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}