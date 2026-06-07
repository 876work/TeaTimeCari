import React from 'react';
import { Footer } from './Footer';
import { PrivacyToast } from './PrivacyToast';
import { SiteHeader } from './SiteHeader';

interface PublicLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

export function PublicLayout({ children, showHeader = true }: PublicLayoutProps) {
  const backgroundClass = showHeader
    ? 'bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]'
    : 'bg-gradient-to-br from-[#F8FBFD] via-white to-[#FDF8F8]';

  return (
    <div className={`min-h-screen ${backgroundClass}`}>
      {showHeader && <SiteHeader />}
      {children}
      <PrivacyToast />
      <Footer />
    </div>
  );
}