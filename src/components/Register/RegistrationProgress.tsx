const steps = [
  'Account info',
  'Gender',
  'Photo verification',
  'Admin review',
  'Community access',
];

interface RegistrationProgressProps {
  currentStep: number;
  className?: string;
}

export function RegistrationProgress({ currentStep, className = '' }: RegistrationProgressProps) {
  return (
    <div className={`rounded-2xl border border-[#D6EBF5] bg-gradient-to-r from-blue-50 to-rose-50 p-4 ${className}`} aria-label="Registration progress">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">Application progress</p>
        <p className="text-xs font-semibold text-slate-500">Review usually takes 24–48 hours</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;

          return (
            <li key={step} className="flex items-center gap-2 sm:flex-col sm:items-start">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isComplete
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-[#4B9EC8] text-white ring-4 ring-[#D6EBF5]'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200'
                }`}
              >
                {isComplete ? '✓' : stepNumber}
              </span>
              <span className={`text-xs font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
