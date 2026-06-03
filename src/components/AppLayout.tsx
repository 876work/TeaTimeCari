import React from 'react';
import { NotificationBell } from './Notifications/NotificationBell';
import { LogoutButton } from './Auth/LogoutButton';
import { HoverFooter } from './HoverFooter';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]">
      {/* Header with Notifications */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/teaLogo.png" alt="Tea Time Cari" className="w-10 h-10 object-contain" />
              <h1 className="text-xl font-bold text-gray-900">Tea Time Cari</h1>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <LogoutButton variant="ghost" size="md" />
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto flex-1 px-4 py-8">
        {children}
      </main>

      <HoverFooter />
    </div>
  );
}
