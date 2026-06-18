// src/pages/Signup.tsx
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RegisterStep1, type RegisterStep1Data } from '@/components/RegisterStep1';
import { RegisterStep2, type RegisterStep2Data } from '@/components/Register/Step2';
import { RegisterStep3, type RegisterStep3Data } from '@/components/Register/Step3';
import PendingApproval from '@/components/Register/PendingApproval';
import { AuthLayout } from '@/components/AuthLayout';

const SIGNUP_DRAFT_STORAGE_KEY = 'teatimecari.signupDraft';

const STEP_PATHS = {
  1: '/signup/account',
  2: '/signup/access-group',
  3: '/signup/photo-verification',
  4: '/signup/pending-approval',
} as const;

const PATH_STEPS: Record<string, number> = {
  '/signup/account': 1,
  '/signup/access-group': 2,
  '/signup/photo-verification': 3,
  '/signup/pending-approval': 4,
};

type RegistrationData = {
  step1?: RegisterStep1Data;
  step2?: RegisterStep2Data;
  step3?: RegisterStep3Data;
};

type StoredSignupDraft = {
  currentStep: number;
  registrationData: {
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: Omit<RegisterStep3Data, 'imageBlob'>;
  };
};

const dataUrlToBlob = (dataUrl: string) => {
  const [metadata, base64Data] = dataUrl.split(',');
  const mimeMatch = metadata.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binaryString = window.atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const getStepPath = (step: number) => STEP_PATHS[step as keyof typeof STEP_PATHS] || STEP_PATHS[1];

const getEarliestAllowedStep = (registrationData: RegistrationData) => {
  if (!registrationData.step1) {
    return 1;
  }

  if (!registrationData.step2) {
    return 2;
  }

  if (!registrationData.step3) {
    return 3;
  }

  return 4;
};

const loadSignupDraft = (): { currentStep: number; registrationData: RegistrationData } => {
  if (typeof window === 'undefined') {
    return { currentStep: 1, registrationData: {} };
  }

  try {
    const storedDraft = window.sessionStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
    if (!storedDraft) {
      return { currentStep: 1, registrationData: {} };
    }

    const parsedDraft = JSON.parse(storedDraft) as StoredSignupDraft;
    const storedStep3 = parsedDraft.registrationData.step3;

    return {
      currentStep: parsedDraft.currentStep || 1,
      registrationData: {
        step1: parsedDraft.registrationData.step1,
        step2: parsedDraft.registrationData.step2,
        step3: storedStep3
          ? {
              ...storedStep3,
              imageBlob: dataUrlToBlob(storedStep3.imageData),
            }
          : undefined,
      },
    };
  } catch {
    window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
    return { currentStep: 1, registrationData: {} };
  }
};

const saveSignupDraft = (currentStep: number, registrationData: RegistrationData) => {
  if (typeof window === 'undefined') {
    return;
  }

  const serializableDraft: StoredSignupDraft = {
    currentStep,
    registrationData: {
      step1: registrationData.step1,
      step2: registrationData.step2,
      step3: registrationData.step3
        ? {
            captureType: registrationData.step3.captureType,
            imageData: registrationData.step3.imageData,
          }
        : undefined,
    },
  };

  window.sessionStorage.setItem(SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(serializableDraft));
};

export default function Signup() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialDraft = React.useMemo(loadSignupDraft, []);
  const [currentStep, setCurrentStep] = React.useState(() => PATH_STEPS[location.pathname] || initialDraft.currentStep);
  const [registrationData, setRegistrationData] = React.useState<RegistrationData>(initialDraft.registrationData);

  React.useEffect(() => {
    const requestedStep = PATH_STEPS[location.pathname];
    const earliestAllowedStep = getEarliestAllowedStep(registrationData);
    const nextStep = requestedStep || Math.min(currentStep, earliestAllowedStep);
    const guardedStep = nextStep > earliestAllowedStep ? earliestAllowedStep : nextStep;
    const guardedPath = getStepPath(guardedStep);

    if (currentStep !== guardedStep) {
      setCurrentStep(guardedStep);
    }

    if (location.pathname !== guardedPath) {
      navigate(guardedPath, { replace: true });
    }
  }, [currentStep, location.pathname, navigate, registrationData]);

  React.useEffect(() => {
    saveSignupDraft(currentStep, registrationData);
  }, [currentStep, registrationData]);

  const handleStep1Complete = (data: RegisterStep1Data) => {
    const nextData = { ...registrationData, step1: data };
    setRegistrationData(nextData);
    saveSignupDraft(2, nextData);
    setCurrentStep(2);
    navigate(STEP_PATHS[2]);
  };

  const handleStep2Complete = (data: RegisterStep2Data) => {
    const nextData = { ...registrationData, step2: data };
    setRegistrationData(nextData);
    saveSignupDraft(3, nextData);
    setCurrentStep(3);
    navigate(STEP_PATHS[3]);
  };

  const handleStep3Complete = (data: RegisterStep3Data) => {
    const nextData = { ...registrationData, step3: data };
    setRegistrationData(nextData);
    saveSignupDraft(4, nextData);
    setCurrentStep(4);
    navigate(STEP_PATHS[4]);
  };

  const resetRegistration = () => {
    window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
    setRegistrationData({});
    setCurrentStep(1);
    navigate(STEP_PATHS[1], { replace: true });
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
          onBack={() => {
            setCurrentStep(1);
            navigate(STEP_PATHS[1]);
          }}
          initialData={registrationData.step2}
        />
      )}

      {currentStep === 3 && (
        <RegisterStep3
          onNext={handleStep3Complete}
          onBack={() => {
            setCurrentStep(2);
            navigate(STEP_PATHS[2]);
          }}
          initialData={registrationData.step3}
          registrationData={registrationData}
        />
      )}

      {currentStep === 4 && (
        <PendingApproval
          registrationData={registrationData}
          onGoHome={() => {
            window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
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
