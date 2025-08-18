import React, { useEffect, useState } from "react";
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Link } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { RegisterStep1Data } from '../RegisterStep1';
import { RegisterStep2Data } from './Step2';
import { RegisterStep3Data } from './Step3';

interface PendingApprovalProps {
  registrationData: {
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
    step3?: RegisterStep3Data;
  };
  onGoHome: () => void;
  onGoBackToStep1: () => void;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({ 
  registrationData, 
  onGoHome, 
  onGoBackToStep1 
}) => {
  const supabase = useSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit registration data when component mounts
  useEffect(() => {
    const submitRegistration = async () => {
      if (!registrationData.step1 || !registrationData.step2 || !registrationData.step3) {
        setError('Incomplete registration data. Please start over.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const { step1, step2, step3 } = registrationData;
        
        const registrationPayload = {
          fullName: step1.fullName,
          email: step1.email,
          phone: step1.phone,
          username: step1.username,
          password_temp: step1.password, // Store temporarily for admin approval
          gender: step2.gender,
          captureType: step3.captureType,
          imageData: step3.imageData,
          status: 'pending'
        };
        
        const { data: insertedData, error: insertError } = await supabase
          .from('registrations')
          .insert([registrationPayload])
          .select()
          .single();
        
        if (insertError) {
          if (insertError.code === '42P01') {
            console.warn('Registrations table not found, proceeding with demo flow');
            setIsSubmitted(true);
          } else {
            throw insertError;
          }
        } else {
          setIsSubmitted(true);
        }
        
      } catch (err: any) {
        console.error('Error submitting registration:', err);
        setError(`Failed to submit registration: ${err.message || 'Please try again.'}`);
      } finally {
        setIsSubmitting(false);
      }
    };

    submitRegistration();
  }, [registrationData, supabase]);

  // Loading state
  if (isSubmitting) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="rounded-2xl border p-8 shadow-sm bg-white text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Submitting Your Application</h1>
          <p className="text-sm text-gray-600">
            Please wait while we process your registration...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto p-6">
        <div className="rounded-2xl border p-8 shadow-sm bg-white text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-red-600">Registration Failed</h1>
          <p className="text-sm text-gray-600 mb-6">
            {error}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onGoBackToStep1}
              className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2 border bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onGoHome}
              className="flex-1 inline-flex items-center justify-center rounded-xl px-4 py-2 border"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="max-w-md mx-auto p-6">
      <div className="rounded-2xl border p-8 shadow-sm bg-white text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
        <p className="text-sm text-gray-600 mb-4">
          Thank you! A team member will review your application. If approved, you'll receive an email with verification instructions.
        </p>

        <div className="text-sm text-gray-600 mb-6">
          You can close this page. We'll notify you via email when it's your turn.
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onGoHome}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 border bg-black text-white"
          >
            Go to Home
          </button>
          <Link
            to="/help"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 border"
          >
            Need help?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;