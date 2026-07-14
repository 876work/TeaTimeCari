import React from "react";

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function PageSection({ children, className = "", as: Component = "section" }: PageSectionProps) {
  return (
    <Component
      className={`relative overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-8 shadow-[0_25px_70px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-10 ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]" aria-hidden="true" />
      {children}
    </Component>
  );
}
