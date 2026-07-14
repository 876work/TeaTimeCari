import React, { useState } from 'react';
import { HelpCircle, ShieldCheck, User, UserCheck } from 'lucide-react';
import { RegistrationProgress } from './RegistrationProgress';

export interface RegisterStep2Data {
  gender: 'Male' | 'Female';
}

interface RegisterStep2Props {
  onNext: (data: RegisterStep2Data) => void;
  onBack?: () => void;
  initialData?: RegisterStep2Data;
}

const genderOptions = [
  {
    value: 'Male' as const,
    label: 'Male',
    icon: '♂️',
    groupLabel: 'men’s private community space',
    selectedClasses: 'bg-gradient-to-br from-[#4B9EC8] to-[#3382AA] text-white border-[#4B9EC8] shadow-lg shadow-[#4B9EC8]/30 scale-105',
    unselectedClasses: 'bg-white text-gray-700 border-gray-200 hover:border-[#4B9EC8] hover:text-[#4B9EC8] hover:shadow-md',
    iconClasses: 'text-[#B0B0B0]',
  },
  {
    value: 'Female' as const,
    label: 'Female',
    icon: '♀️',
    groupLabel: 'women’s private community space',
    selectedClasses: 'bg-gradient-to-br from-[#D96E6E] to-[#BC5050] text-white border-[#D96E6E] shadow-lg shadow-[#D96E6E]/30 scale-105',
    unselectedClasses: 'bg-white text-gray-700 border-gray-200 hover:border-[#D96E6E] hover:text-[#D96E6E] hover:shadow-md',
    iconClasses: 'text-[#B36B6B]',
  },
];

export function RegisterStep2({ onNext, onBack, initialData }: RegisterStep2Props) {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(initialData?.gender || null);

  const selectedOption = genderOptions.find((option) => option.value === selectedGender);

  const handleGenderSelect = (gender: 'Male' | 'Female') => {
    setSelectedGender(gender);
    onNext({ gender });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-8 shadow-[0_25px_70px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]" aria-hidden="true" />

        <RegistrationProgress currentStep={2} className="mb-6" />

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EAF6FC] to-[#D6EBF5] shadow-md ring-4 ring-white">
            <User className="w-8 h-8 text-[#4B9EC8]" />
          </div>
          <span className="inline-flex items-center rounded-full bg-[#F5FBFE] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#3382AA] ring-1 ring-[#D6EBF5]">
            Step 2 of 3 · Private community access
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Choose your access group</h1>
          <p className="mt-2 text-sm text-slate-500">
            Select the gender group you identify with so we can place your approved account in the matching private space.
          </p>
        </div>

        <div className="flex justify-center space-x-4 mb-6" role="radiogroup" aria-label="Private community access group">
          {genderOptions.map((option) => {
            const isSelected = selectedGender === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleGenderSelect(option.value)}
                className={`
                  w-32 h-32 rounded-2xl flex flex-col items-center justify-center
                  border-2 transition-all duration-200 ease-in-out transform hover:scale-105
                  ${isSelected ? option.selectedClasses : option.unselectedClasses}
                `}
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select ${option.label} access group`}
              >
                <div className={`text-4xl mb-2 ${option.iconClasses}`}>{option.icon}</div>
                <span className="font-semibold text-lg">{option.label}</span>
                <span className={isSelected ? 'mt-1 text-xs text-white/85' : 'mt-1 text-xs text-slate-500'}>
                  access group
                </span>
                {isSelected && (
                  <UserCheck className="w-5 h-5 mt-1 opacity-80" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-6 space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-sky-950">What this controls</p>
                <p className="mt-1 text-sm text-sky-900">
                  This is your self-selected gender access group. After approval, it controls your default private category,
                  community feed visibility, and Discourse group membership.
                </p>
                {selectedOption && (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-sky-950">
                    Current selection: {selectedOption.label} → {selectedOption.groupLabel}.
                  </p>
                )}
              </div>
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-800 marker:hidden">
              <HelpCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Why we ask
            </summary>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                Tea Time Cari uses gender-based access groups to keep private community areas separate and easier to moderate.
              </p>
              <p>
                Your selection is used for access and review; it is not displayed as a public profile field during registration.
              </p>
            </div>
          </details>
        </div>

        {onBack && (
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onBack}
              className="w-full py-3 px-4 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
