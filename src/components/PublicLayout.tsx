import React from 'react';
import { Footer } from './Footer';
import { SiteHeader } from './SiteHeader';

interface PublicLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

export function PublicLayout({ children, showHeader = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FBFD] via-white to-[#FDF8F8]">
      {showHeader && <SiteHeader />}
      {children}
      <Footer />
    </div>
  );
}
