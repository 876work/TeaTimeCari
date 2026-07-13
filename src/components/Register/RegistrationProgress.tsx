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
    <div className={`rounded-2xl border border-[#D6EBF5] bg-gradient-to-r from-blue-50 to-rose-50 p-4 shadow-sm ${className}`} aria-label="Registration progress">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-800">Application progress</p>
        <p className="inline-flex w-fit items-center rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#3382AA] ring-1 ring-[#D6EBF5]">
          Review usually takes 24–48 hours
        </p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;

          return (
            <li key={step} className="flex items-center gap-2 sm:flex-col sm:items-start">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isComplete
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                    : isCurrent
                      ? 'bg-gradient-to-br from-[#4B9EC8] to-[#3382AA] text-white shadow-md shadow-[#4B9EC8]/40 ring-4 ring-[#D6EBF5]'
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
