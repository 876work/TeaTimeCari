import React from 'react';
import { Footer } from './Footer';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FBFD] via-white to-[#FDF8F8]">
      {children}
      <Footer />
    </div>
  );
}
