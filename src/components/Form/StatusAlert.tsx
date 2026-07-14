import React from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

type StatusAlertVariant = "error" | "success" | "info" | "warning";

interface StatusAlertProps {
  variant?: StatusAlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const variantClasses: Record<StatusAlertVariant, { container: string; icon: string; text: string; title: string; role: "alert" | "status" }> = {
  error: {
    container: "border-red-200 bg-red-50",
    icon: "text-red-500",
    text: "text-red-700",
    title: "text-red-800",
    role: "alert",
  },
  success: {
    container: "border-green-200 bg-green-50",
    icon: "text-green-600",
    text: "text-green-700",
    title: "text-green-800",
    role: "status",
  },
  info: {
    container: "border-blue-200 bg-blue-50",
    icon: "text-blue-600",
    text: "text-blue-800",
    title: "text-blue-900",
    role: "status",
  },
  warning: {
    container: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    text: "text-amber-800",
    title: "text-amber-900",
    role: "status",
  },
};

const defaultIcons: Record<StatusAlertVariant, React.ReactNode> = {
  error: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
  success: <CheckCircle className="h-5 w-5" aria-hidden="true" />,
  info: <Info className="h-5 w-5" aria-hidden="true" />,
  warning: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
};

export function StatusAlert({ variant = "info", title, children, className = "", icon }: StatusAlertProps) {
  const classes = variantClasses[variant];

  return (
    <div className={`rounded-lg border p-4 ${classes.container} ${className}`} role={classes.role}>
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 flex-shrink-0 ${classes.icon}`}>{icon ?? defaultIcons[variant]}</div>
        <div className={`text-sm ${classes.text}`}>
          {title && <p className={`mb-1 font-semibold ${classes.title}`}>{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
