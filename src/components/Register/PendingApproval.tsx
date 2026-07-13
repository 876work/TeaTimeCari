import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Download, Calendar, Shield, Loader2 } from 'lucide-react';
import { RegistrationProgress } from './RegistrationProgress';
import html2canvas from 'html2canvas';
import { submitRegistration, RegistrationPayload } from '../../lib/registrations';
import { RegisterStep1Data } from '../RegisterStep1';
import { RegisterStep2Data } from './Step2';
import { RegisterStep3Data } from './Step3';
import { debugError, debugLog } from '@/lib/debugLogger';
import { LoadingCard, PageSection, PrimaryButton, StatusAlert } from '../Form';

interface PendingApprovalProps {
  registrationData: {
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  };
  onGoHome: () => void;
  onGoBackToStep1: () => void;
}

const SIGNUP_DRAFT_STORAGE_KEY = 'teatimecari.signupDraft';
const submittedRegistrationKeys = new Set<string>();
const inFlightRegistrationSubmissions = new Map<string, Promise<Awaited<ReturnType<typeof submitRegistration>>>>();

function getSubmissionKey(email?: string) {
  return `teatimecari.registrationSubmitted:${email?.trim().toLowerCase() || 'unknown'}`;
}

function hasSubmittedRegistration(key: string) {
  return submittedRegistrationKeys.has(key) || window.sessionStorage.getItem(key) === 'true';
}

function markRegistrationSubmitted(key: string) {
  submittedRegistrationKeys.add(key);
  window.sessionStorage.setItem(key, 'true');
}

function submitRegistrationOnce(key: string, payload: RegistrationPayload) {
  const existingSubmission = inFlightRegistrationSubmissions.get(key);

  if (existingSubmission) {
    return existingSubmission;
  }

  const submission = submitRegistration(payload).finally(() => {
    inFlightRegistrationSubmissions.delete(key);
  });

  inFlightRegistrationSubmissions.set(key, submission);
  return submission;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({
  registrationData,
  onGoHome,
  onGoBackToStep1,
}) => {
  const didRun = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [alreadyExists, setAlreadyExists] = useState(false);

  const downloadReceiptAsImage = async () => {
    setIsDownloading(true);

    try {
      const element = document.getElementById('confirmation-receipt');

      if (!element) {
        throw new Error('Receipt element not found');
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: element.offsetWidth,
        height: element.offsetHeight,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');

          link.href = url;
          link.download = `tea-time-cari-confirmation-receipt-${new Date().toISOString().split('T')[0]}.png`;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(url);
        }
      }, 'image/png', 0.95);
    } catch (err: unknown) {
      debugError('Error downloading receipt:', err);
      alert('Failed to download receipt. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const handleSubmission = async () => {
      const { step1, step2, step3 } = registrationData;

      if (!step1 || !step2 || !step3) {
        setError('Incomplete registration data. Please start over.');
        return;
      }

      const submissionKey = getSubmissionKey(step1.email);

      if (hasSubmittedRegistration(submissionKey)) {
        setAlreadyExists(true);
        setSuccessMessage("You've already submitted your application. You're in the review queue. We'll email you after review.");
        window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setSuccessMessage('');

      try {
        const registrationPayload: RegistrationPayload = {
          fullName: step1.fullName,
          email: step1.email,
          phone: step1.phone,
          username: step1.username,
          password_temp: step1.password,
          gender: step2.gender,
          captureType: step3.captureType,
          imageData: step3.imageData,
          status: 'pending',
        };

        debugLog('Submitting registration data...');

        const result = await submitRegistrationOnce(submissionKey, registrationPayload);

        setAlreadyExists(result.alreadyExists);
        markRegistrationSubmitted(submissionKey);
        window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);

        if (result.alreadyExists) {
          setSuccessMessage("You've already submitted your application. You're in the review queue. We'll email you after review.");
        } else if (result.data.sessionSynced === false) {
          setSuccessMessage("Thanks! Your application has been submitted. For your privacy, we signed out any previous browser session. Please log in with your new email to check your review status.");
        } else {
          setSuccessMessage("Thanks! Your application has been submitted. You're in the review queue and this browser is now signed in to your new account.");
        }

        debugLog('Registration submission completed:', {
          alreadyExists: result.alreadyExists,
          isNewSubmission: result.isNewSubmission,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Please try again.';

        debugError('Error submitting registration:', err);
        setError(`Failed to submit registration: ${message}`);
      } finally {
        setIsSubmitting(false);
      }
    };

    handleSubmission();
  }, [registrationData]);

  if (isSubmitting) {
    return (
      <div className="max-w-md mx-auto p-6">
        <LoadingCard title="Submitting Your Application" message="Please wait while we process your registration...">
          <RegistrationProgress currentStep={4} className="mt-6 text-left" />
        </LoadingCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-6">
        <PageSection className="text-center">
          <StatusAlert variant="error" title="Registration Failed" className="mb-4 text-left">
            {error}
          </StatusAlert>

          <Link to="/contact-us" className="mb-6 inline-flex text-sm font-semibold text-[#4B9EC8] underline">
            Contact support if you need help
          </Link>

          <div className="flex items-center gap-3">
            <PrimaryButton onClick={onGoBackToStep1} className="flex-1" fullWidth={false}>
              Try Again
            </PrimaryButton>

            <PrimaryButton onClick={onGoHome} variant="ghost" className="flex-1" fullWidth={false}>
              Go Home
            </PrimaryButton>
          </div>
        </PageSection>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="space-y-6">
        <RegistrationProgress currentStep={4} className="mb-6" />

        <div id="confirmation-receipt" className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_25px_70px_-20px_rgba(15,23,42,0.45)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]" aria-hidden="true" />

          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EAF6FC] to-[#D6EBF5] shadow-md ring-4 ring-white">
              <Shield className="w-8 h-8 text-[#4B9EC8]" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Confirmation Receipt</h2>

            <p className="text-sm text-gray-600">
              Your registration application was received.
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-amber-600" />
                Application Status
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Current Status:</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                    Pending Review
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Submitted:</span>
                  <span className="text-sm text-gray-900">{new Date().toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Expected Review:</span>
                  <span className="text-sm text-gray-900">Within 24-48 hours</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-blue-600" />
                Privacy Note
              </h3>

              <p className="text-sm text-gray-700">
                This receipt intentionally excludes personal details such as your name, username,
                contact information, gender, and verification method.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-8 shadow-[0_25px_70px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-md ring-4 ring-white">
            <CheckCircle className="w-9 h-9 text-emerald-500" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
            {alreadyExists ? 'Application Already Submitted!' : 'Application Submitted!'}
          </h1>

          <p className="text-sm text-slate-600 mb-4 font-medium">
            {successMessage || "Thank you! A team member will review your application. If approved, you'll receive an email with instructions to access the community forum."}
          </p>

          <div className="text-sm text-slate-600 mb-6">
            {alreadyExists
              ? "Your application is already in our system. No need to resubmit - we'll email you with forum access instructions once reviewed."
              : "You can close this page. We'll email you with forum access instructions once your application is approved."}
          </div>

          <div className="space-y-3">
            <button
              onClick={downloadReceiptAsImage}
              disabled={isDownloading || isSubmitting}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                !isDownloading && !isSubmitting
                  ? 'bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white shadow-lg shadow-[#4B9EC8]/25 hover:shadow-xl hover:shadow-[#4B9EC8]/30 transform hover:-translate-y-0.5'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isDownloading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Generating Receipt...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Download className="w-5 h-5 mr-2" />
                  Download Confirmation Receipt
                </div>
              )}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onGoHome}
                disabled={isSubmitting}
                className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2.5 border border-slate-200 bg-white font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Go to Home
              </button>

              <Link
                to="/contact-us"
                className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2.5 border border-slate-200 bg-white font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Need help?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
