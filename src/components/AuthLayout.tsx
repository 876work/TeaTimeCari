import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export function AuthLayout({ children, maxWidth = 'max-w-md' }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className={`${maxWidth} w-full space-y-8`}>
        {children}
      </div>
    </div>
  );
}