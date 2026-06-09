import React from "react";

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function PageSection({ children, className = "", as: Component = "section" }: PageSectionProps) {
  return (
    <Component className={`rounded-2xl bg-white p-8 shadow-xl ${className}`}>
      {children}
    </Component>
  );
}
