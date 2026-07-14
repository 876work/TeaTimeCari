import React from "react";
import { ShieldCheck } from "lucide-react";
import { StatusAlert } from "./StatusAlert";

interface PrivacyNoteProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function PrivacyNote({ children, title = "Privacy note", className = "" }: PrivacyNoteProps) {
  return (
    <StatusAlert
      variant="info"
      title={title}
      icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      className={className}
    >
      {children}
    </StatusAlert>
  );
}
