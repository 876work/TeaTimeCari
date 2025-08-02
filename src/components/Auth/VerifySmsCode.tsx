import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../AuthLayout';

interface VerifySmsCodeProps {
  onVerificationComplete?: () => void;
  userPhone?: string;
}

export function VerifySmsCode({ onVerificationComplete, userPhone }: VerifySmsCodeProps) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  const [smsCode, setSmsCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidCodeFormat, setIsValidCodeFormat] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Validate SMS code format: exactly 6 digits
    setIsValidCodeFormat(/^\d{6}$/.test(smsCode));
    if (error) {
      setError(null); // Clear error when user starts typing again
    }
  }, [smsCode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits and limit to 6 characters
    if (/^\d*$/.test(value) && value.length <= 6) {
      setSmsCode(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Fetch the user's registration record by SMS code and check expiry
      const { data: registration, error: fetchError } = await supabase
        .from('registrations')
        .select('id, sms_code, sms_code_expiry, firstName, status')
        .eq('sms_code', smsCode)
        .gt('sms_code_expiry', new Date().toISOString())
        .single();

      if (fetchError || !registration) {
        console.error('Error fetching registration data:', fetchError);
        
        // Check if it's because code doesn't exist or is expired
        const { data: expiredCheck } = await supabase
          .from('registrations')
          .select('sms_code_expiry')
          .eq('sms_code', smsCode)
          .single();

        if (expiredCheck) {
          setError('This verification code has expired. Please contact support for a new code.');
        } else {
          setError('Invalid verification code. Please check your code and try again.');
        }
        setIsLoading(false);
        return;
      }

      // Code is valid and not expired, update user status
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ 
          status: 'verified', 
          sms_code: null, // Clear the code after successful verification
          sms_code_expiry: null 
        })
        .eq('id', registration.id);

      if (updateError) {
        console.error('Error updating registration status:', updateError);
        setError('Failed to complete verification. Please try again.');
      } else {
        setIsVerified(true);
        
        // Wait a moment to show success message
        setTimeout(() => {
          if (onVerificationComplete) {
            onVerificationComplete();
          } else {
            // Default redirect to home
            window.location.href = '/';
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'An unexpected error occurred during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Phone Verified!</h1>
            <p className="text-gray-600 mb-4">
              Your phone number has been successfully verified.
            </p>
            <div className="animate-pulse text-sm text-gray-500">
              Redirecting you now...
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h1>
          <p className="text-gray-600">
            Enter the 6-digit code sent to your phone{userPhone && ` (${userPhone})`}. This code expires in 24 hours.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="smsCode" className="sr-only">
              SMS Verification Code
            </label>
            <input
              type="text"
              id="smsCode"
              value={smsCode}
              onChange={handleInputChange}
              className={`w-full px-4 py-4 text-center text-2xl font-bold tracking-widest border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error 
                  ? 'border-[#E0A3A3] bg-red-50' 
                  : isValidCodeFormat
                  ? 'border-[#A3C6E0] bg-blue-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              }`}
              placeholder="------"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'code-error' : undefined}
              maxLength={6}
            />
            {!isValidCodeFormat && smsCode.length > 0 && smsCode.length < 6 && (
              <p className="mt-2 text-sm text-gray-500">
                Enter all 6 digits of your verification code
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValidCodeFormat || isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isValidCodeFormat && !isLoading
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Verifying...
              </div>
            ) : (
              'Verify Code'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Didn't receive the code?</strong><br />
              Check your messages or contact support for assistance.
            </p>
          </div>
        </div>

        {/* Development helper */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
            <strong>Development Mode:</strong> Check your browser console for any error messages.
          </div>
        )}
      </div>
    </AuthLayout>
  );
}