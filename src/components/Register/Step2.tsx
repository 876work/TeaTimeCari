import React, { useState } from 'react';
import { User, UserCheck } from 'lucide-react';

export interface RegisterStep2Data {
  gender: 'Male' | 'Female';
}

interface RegisterStep2Props {
  onNext: (data: RegisterStep2Data) => void;
  onBack?: () => void;
}

export function RegisterStep2({ onNext, onBack }: RegisterStep2Props) {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(null);

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
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your Gender</h1>
          <p className="text-gray-600">Step 2 of 3: Personal Details</p>
        </div>

        <div className="flex justify-center space-x-4 mb-8">
          <button
            type="button"
            onClick={() => handleGenderSelect('Male')}
            className={`
              w-32 h-32 rounded-2xl flex flex-col items-center justify-center
              border-2 transition-all duration-200 ease-in-out transform hover:scale-105
              ${selectedGender === 'Male'
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:shadow-md'
              }
            `}
            aria-pressed={selectedGender === 'Male'}
            aria-label="Select Male"
          >
            <div className="text-4xl mb-2">♂️</div>
            <span className="font-semibold text-lg">Male</span>
            {selectedGender === 'Male' && (
              <UserCheck className="w-5 h-5 mt-1 opacity-80" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleGenderSelect('Female')}
            className={`
              w-32 h-32 rounded-2xl flex flex-col items-center justify-center
              border-2 transition-all duration-200 ease-in-out transform hover:scale-105
              ${selectedGender === 'Female'
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:shadow-md'
              }
            `}
            aria-pressed={selectedGender === 'Female'}
            aria-label="Select Female"
          >
            <div className="text-4xl mb-2">♀️</div>
            <span className="font-semibold text-lg">Female</span>
            {selectedGender === 'Female' && (
              <UserCheck className="w-5 h-5 mt-1 opacity-80" />
            )}
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800 text-center">
            ⚠️ Gender selection is permanent and cannot be changed later.
          </p>
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
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
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