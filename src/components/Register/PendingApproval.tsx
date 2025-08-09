import React from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Clock, CheckCircle, User, Mail, Phone, AtSign, Users, Camera } from 'lucide-react';
import { incrementInviteCodeUsage } from '../../utils/inviteCodeUtils';

export interface PendingApprovalProps {
  registrationData: {
    invite?: {
      inviteCode: string;
    };
    step1?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      username: string;
    };
    step2?: {
      gender: 'Male' | 'Female';
    };
    step3?: {
      captureType: 'selfie' | 'id';
      imageData: string;
      imageBlob: Blob;
    };
  };
  onGoHome: () => void;
  onGoBackToStep1: () => void;
}

export function PendingApproval({ registrationData, onGoHome, onGoBackToStep1 }: PendingApprovalProps) {
  const supabase = useSupabaseClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  
  const { invite, step1, step2, step3 } = registrationData;

  // Generate email verification code
  const generateEmailCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Submit registration data to database
  React.useEffect(() => {
    const submitRegistration = async () => {
      // Only submit if we have all required data and haven't submitted yet
      if (!step1 || !step2 || !step3 || !invite || isSubmitted || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        // First, check if a registration with this email already exists
        const { data: existingRegistration, error: checkError } = await supabase
          .from('registrations')
          .select('id, status')
          .eq('email', step1.email)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116' && checkError.code !== '42P01') {
          throw checkError;
        }

        // If registration already exists, mark as submitted and return
        if (existingRegistration) {
          console.log('Registration already exists for email:', step1.email, 'Status:', existingRegistration.status);
          setIsSubmitted(true);
          return;
        }

        // Generate email code and expiry
        const emailCode = generateEmailCode();
        const emailCodeExpiry = new Date();
        emailCodeExpiry.setHours(emailCodeExpiry.getHours() + 24); // 24 hours from now

        // Prepare registration data
        const registrationRecord = {
          firstName: step1.firstName,
          lastName: step1.lastName,
          email: step1.email,
          phone: step1.phone,
          username: step1.username,
          gender: step2.gender,
          captureType: step3.captureType,
          imageData: step3.imageData,
          status: 'pending',
          email_code: emailCode,
          email_code_expiry: emailCodeExpiry.toISOString(),
          invite_code_used: invite.inviteCode
        };

        // Insert into registrations table
        const { data: insertedData, error: insertError } = await supabase
          .from('registrations')
          .insert([registrationRecord])
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            // Unique constraint violation
            if (insertError.message.includes('email')) {
              throw new Error("You're unable to register with this email address. Please use another and try again.");
            } else if (insertError.message.includes('username')) {
              throw new Error('This username is already taken.');
            } else {
              throw new Error('Registration data already exists.');
            }
          } else if (insertError.code === '42P01') {
            // Table doesn't exist - for demo purposes, just mark as submitted
            console.warn('Registrations table not found, marking as submitted for demo');
            setIsSubmitted(true);
            return;
          } else {
            throw insertError;
          }
        }

        console.log('Registration submitted successfully:', insertedData);

        // Increment invite code usage count
        try {
          const { success, error: inviteError } = await incrementInviteCodeUsage(supabase, invite.inviteCode);
          if (!success && inviteError) {
            console.warn('Failed to increment invite code usage:', inviteError);
            // Don't fail the registration if invite code update fails
          }
        } catch (inviteErr) {
          console.warn('Error updating invite code usage:', inviteErr);
          // Don't fail the registration if invite code update fails
        }

        // Mark as successfully submitted
        setIsSubmitted(true);

      } catch (err: any) {
        console.error('Error submitting registration:', err);
        setSubmitError(err.message || 'Failed to submit registration. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    };

    submitRegistration();
  }, [step1, step2, step3, invite, isSubmitted, isSubmitting, supabase]);

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 relative">
            <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your profile is under review</h1>
          <p className="text-gray-600 mb-4">Step 4 of 4: Review Pending</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Registration Progress</span>
            <span>4/4 Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full w-full transition-all duration-500 ease-out"></div>
          </div>
        </div>

        {/* Status Message */}
        {isSubmitting ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-blue-800 font-medium">
                Submitting your registration...
              </p>
            </div>
          </div>
        ) : submitError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-center">
              <strong>❌ Submission Failed</strong><br />
              {submitError}
            </p>
          </div>
        ) : isSubmitted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-center">
              <strong>✅ Registration Submitted</strong><br />
              Your application is now under review by our admin team.
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-center">
              <strong>⏳ Review in Progress</strong><br />
              An admin is reviewing your submission. You'll receive an SMS once approved.
            </p>
          </div>
        )}

        {/* Submitted Information Summary */}
        {step1 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              Submitted Information
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center text-gray-700">
                <User className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Name:</span>
                <span>{step1.firstName} {step1.lastName}</span>
              </div>
              
              <div className="flex items-center text-gray-700">
                <Mail className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Email:</span>
                <span>{step1.email}</span>
              </div>
              
              <div className="flex items-center text-gray-700">
                <Phone className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Phone:</span>
                <span>{step1.phone}</span>
              </div>
              
              <div className="flex items-center text-gray-700">
                <AtSign className="w-4 h-4 text-gray-400 mr-3" />
                <span className="font-medium mr-2">Username:</span>
                <span>@{step1.username}</span>
              </div>
              
              {step2 && (
                <div className="flex items-center text-gray-700">
                  <Users className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="font-medium mr-2">Gender:</span>
                  <span>{step2.gender}</span>
                </div>
              )}
              
              {step3 && (
                <div className="flex items-center text-gray-700">
                  <Camera className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="font-medium mr-2">Verification:</span>
                  <span>{step3.captureType === 'selfie' ? 'Selfie Photo' : 'ID Document'} Submitted</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Steps Information */}
        {isSubmitted && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Our admin team will review your documents within 24-48 hours</li>
              <li>• You'll receive an email with a verification code once approved</li>
              <li>• Enter the code in the app to activate your account</li>
              <li>• If additional information is needed, we'll contact you via email</li>
            </ul>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onGoHome}
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            isSubmitting
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Go Back to Homepage'}
        </button>

        {/* Support Information */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Need help? Contact support for assistance with your application.
          </p>
        </div>
      </div>
    </div>
  );
}