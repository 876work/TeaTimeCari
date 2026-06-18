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
    selectedClasses: 'bg-gradient-to-br from-[#4B9EC8] to-[#3382AA] text-white border-[#4B9EC8] shadow-lg scale-105',
    unselectedClasses: 'bg-white text-gray-700 border-gray-300 hover:border-[#4B9EC8] hover:text-[#4B9EC8] hover:shadow-md',
    iconClasses: 'text-[#B0B0B0]',
  },
  {
    value: 'Female' as const,
    label: 'Female',
    icon: '♀️',
    groupLabel: 'women’s private community space',
    selectedClasses: 'bg-gradient-to-br from-[#D96E6E] to-[#BC5050] text-white border-[#D96E6E] shadow-lg scale-105',
    unselectedClasses: 'bg-white text-gray-700 border-gray-300 hover:border-[#D96E6E] hover:text-[#D96E6E] hover:shadow-md',
    iconClasses: 'text-[#B36B6B]',
  },
];

export function RegisterStep2({ onNext, onBack, initialData }: RegisterStep2Props) {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(initialData?.gender || null);

  const selectedOption = genderOptions.find((option) => option.value === selectedGender);

  const handleGenderSelect = (gender: 'Male' | 'Female') => {
    setSelectedGender(gender);
  };

  const handleContinue = () => {
    if (selectedGender) {
      onNext({ gender: selectedGender });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <RegistrationProgress currentStep={2} className="mb-6" />

        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-[#4B9EC8]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose your access group</h1>
          <p className="text-gray-600">Step 2 of 3: Private community access</p>
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

        <div className="flex space-x-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedGender}
            className={`
              ${onBack ? 'flex-1' : 'w-full'} py-3 px-4 rounded-lg font-medium transition-all duration-200 ease-in-out
              ${selectedGender
                ? 'bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
