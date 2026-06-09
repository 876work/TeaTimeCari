import React from "react";
import { Loader2 } from "lucide-react";

type PrimaryButtonVariant = "primary" | "secondary" | "ghost";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingLabel?: string;
  variant?: PrimaryButtonVariant;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<PrimaryButtonVariant, string> = {
  primary: "bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] text-white shadow-md hover:from-[#3382AA] hover:to-[#BC5050] hover:shadow-lg hover:scale-[1.02] disabled:bg-none disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:hover:scale-100",
  secondary: "border border-[#4B9EC8]/40 bg-white text-[#2E6F91] hover:border-[#4B9EC8] hover:bg-[#D6EBF5] disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white",
  ghost: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white",
};

export function PrimaryButton({
  children,
  isLoading = false,
  loadingLabel,
  variant = "primary",
  fullWidth = true,
  icon,
  className = "",
  disabled,
  type = "button",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-3 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {icon && <span className="mr-2 inline-flex" aria-hidden="true">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
