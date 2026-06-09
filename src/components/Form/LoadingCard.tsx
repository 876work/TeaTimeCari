import React from "react";
import { Loader2 } from "lucide-react";
import { PageSection } from "./PageSection";

interface LoadingCardProps {
  title: string;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}

export function LoadingCard({ title, message, children, className = "" }: LoadingCardProps) {
  return (
    <PageSection className={`text-center ${className}`}>
      <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-[#4B9EC8]" aria-hidden="true" />
      <h1 className="mb-2 text-xl font-semibold text-gray-900">{title}</h1>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      {children}
    </PageSection>
  );
}
