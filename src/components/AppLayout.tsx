import React from 'react';
import { NotificationBell } from './Notifications/NotificationBell';
import { LogoutButton } from './Auth/LogoutButton';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3]">
      {/* Header with Notifications */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}