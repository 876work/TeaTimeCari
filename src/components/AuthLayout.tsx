import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export function AuthLayout({ children, maxWidth = 'max-w-md' }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#2E6485] via-[#5B4570] to-[#8A4650] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-[#4B9EC8]/40 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute top-1/3 -right-28 h-[26rem] w-[26rem] rounded-full bg-[#9B6BAE]/35 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-[#D96E6E]/30 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,14,26,0.28)_100%)]" aria-hidden="true" />

      <div className={`relative ${maxWidth} w-full space-y-8`}>
        {children}
      </div>
    </div>
  );
}