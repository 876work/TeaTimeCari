import React from 'react';

type GradientPageShellProps = {
  children: React.ReactNode;
  maxWidth?: string;
  cardClassName?: string;
};

export function GradientPageShell({
  children,
  maxWidth = 'max-w-4xl',
  cardClassName = '',
}: GradientPageShellProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className={`mx-auto w-full ${maxWidth} rounded-3xl bg-white px-6 py-8 text-slate-800 shadow-xl shadow-[#11263F]/15 sm:px-8 md:px-10 md:py-12 ${cardClassName}`}>
        {children}
      </div>
    </main>
  );
}
