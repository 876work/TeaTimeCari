import React from 'react';
import { SiteHeader } from './SiteHeader';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]">
      <SiteHeader showNotifications />
      
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}