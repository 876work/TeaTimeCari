// src/pages/Signup.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { RegisterStep1, type RegisterStep1Data } from '@/components/RegisterStep1';
import { RegisterStep2, type RegisterStep2Data } from '@/components/Register/Step2';
import { RegisterStep3, type RegisterStep3Data } from '@/components/Register/Step3';
import PendingApproval from '@/components/Register/PendingApproval';
import { AuthLayout } from '@/components/AuthLayout';

export default function Signup() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [registrationData, setRegistrationData] = React.useState<{
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  }>({});

  const handleStep1Complete = (data: RegisterStep1Data) => {
    setRegistrationData((prev) => ({ ...prev, step1: data }));
    setCurrentStep(2);
  };

  const handleStep2Complete = (data: RegisterStep2Data) => {
    setRegistrationData((prev) => ({ ...prev, step2: data }));
    setCurrentStep(3);
  };

  const handleStep3Complete = (data: RegisterStep3Data) => {
    setRegistrationData((prev) => ({ ...prev, step3: data }));
    setCurrentStep(4);
  };

  const resetRegistration = () => {
    setRegistrationData({});
    setCurrentStep(1);
  };

  return (
    <AuthLayout maxWidth="max-w-xl">
      {currentStep === 1 && (
        <RegisterStep1
          onNext={handleStep1Complete}
          onBack={() => window.history.back()}
          initialData={registrationData.step1}
        />
      )}

      {currentStep === 2 && (
        <RegisterStep2
          onNext={handleStep2Complete}
          onBack={() => setCurrentStep(1)}
          initialData={registrationData.step2}
        />
      )}

      {currentStep === 3 && (
        <RegisterStep3
          onNext={handleStep3Complete}
          onBack={() => setCurrentStep(2)}
          initialData={registrationData.step3}
          registrationData={registrationData}
        />
      )}

      {currentStep === 4 && (
        <PendingApproval
          registrationData={registrationData}
          onGoHome={() => {
            window.location.href = '/';
          }}
          onGoBackToStep1={resetRegistration}
        />
      )}

      <div className="bg-white rounded-2xl shadow-xl p-4 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#4B9EC8] hover:text-[#3382AA] transition-colors">
            Sign in instead
          </Link>
        </p>
        <Link to="/" className="mt-3 inline-flex text-sm text-gray-600 hover:text-gray-800 transition-colors">
          ← Back to Home
        </Link>
      </div>
    </AuthLayout>
  );
}
