import React from 'react';
import { Check } from 'lucide-react';

interface RegistrationStepperProps {
  currentStep: number;
  completedSteps: boolean[];
  onStepClick: (step: number) => void;
  children: React.ReactNode;
}

const steps = [
  {
    label: 'First step',
    description: 'Create an account',
  },
  {
    label: 'Second step',
    description: 'Personal details',
  },
  {
    label: 'Final step',
    description: 'Verify identity',
  },
];

export function RegistrationStepper({
  currentStep,
  completedSteps,
  onStepClick,
  children,
}: RegistrationStepperProps) {
  const activeIndex = Math.min(Math.max(currentStep - 1, 0), steps.length);

  const canVisitStep = (stepIndex: number) => {
    if (activeIndex >= steps.length) {
      return true;
    }

    return stepIndex <= activeIndex || completedSteps[stepIndex];
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 border border-gray-100">
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 mb-3">
            <img
              src="/teaLogo.png"
              alt="Tea Time Cari"
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Tea Time Cari Account</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Follow each step so we can safely welcome you into the community.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start" aria-label="Registration progress">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = activeIndex === index;
            const isComplete = completedSteps[index] || activeIndex > index;
            const isClickable = canVisitStep(index);

            return (
              <React.Fragment key={step.label}>
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(stepNumber)}
                  disabled={!isClickable}
                  className={`group flex flex-1 items-center sm:flex-col sm:text-center gap-3 sm:gap-2 rounded-xl p-3 transition-all duration-200 ${
                    isActive
                      ? 'bg-[#D6EBF5] text-[#3382AA] shadow-sm'
                      : isComplete
                      ? 'text-gray-900 hover:bg-[#D6EBF5]/70'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                      isComplete
                        ? 'border-[#4B9EC8] bg-[#4B9EC8] text-white'
                        : isActive
                        ? 'border-[#4B9EC8] bg-white text-[#4B9EC8]'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : stepNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{step.label}</span>
                    <span className="block text-xs text-gray-500">{step.description}</span>
                  </span>
                </button>

                {index < steps.length - 1 && (
                  <div
                    className={`my-1 ml-8 h-6 w-0.5 sm:mx-2 sm:mt-8 sm:h-0.5 sm:flex-1 ${
                      isComplete ? 'bg-[#4B9EC8]' : 'bg-gray-200'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {activeIndex >= steps.length && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-sm font-medium text-green-800">
              Completed — your application is being prepared for review.
            </p>
          </div>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}
