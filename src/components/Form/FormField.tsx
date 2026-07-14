import React from "react";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string | null;
  helpText?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  error,
  helpText,
  required = false,
  children,
  className = "",
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500" aria-hidden="true"> *</span>}
      </label>
      {helpText && (
        <div id={helpId} className="mb-2 text-sm text-gray-500">
          {helpText}
        </div>
      )}
      {children}
      {error && (
        <p id={errorId} className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
