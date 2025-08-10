import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Shield, Loader2, AlertCircle, CheckCircle, Key, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const FN_HEADERS = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

export default function KycVerification() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isValidCodeFormat, setIsValidCodeFormat] = useState(false);

  // Validate token exists
  useEffect(() => {
    if (!token) {
      setError('Invalid verification link. Token is missing.');
    }
  }, [token]);

  // Validate code format
  useEffect(() => {
    setIsValidCodeFormat(/^\d{6}$/.test(code));
    if (error && code.length > 0) {
      setError(null); // Clear error when user starts typing
    }
  }, [code, error]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits and limit to 6 characters
    if (/^\d*$/.test(value) && value.length <= 6) {
      setCode(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Invalid verification link. Please use the link from your email.');
      return;
    }

    if (!isValidCodeFormat) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('kyc-verify', {
        headers: FN_HEADERS,
        body: { token, code }
      });

      if (functionError || !data?.success) {
        throw new Error(functionError?.message || data?.error || 'Verification failed');
      }

      // Redirect to password setting page with action token
      navigate(`/kyc-summary?act=${encodeURIComponent(data.act)}`);

    } catch (err: any) {
      console.error('KYC verification error:', err);
      
      let errorMessage = 'Verification failed. Please try again.';
      
      if (err.message?.includes('Invalid or expired token')) {
        errorMessage = 'This verification link has expired or is invalid. Please contact support for a new link.';
      } else if (err.message?.includes('Invalid code')) {
        errorMessage = 'Incorrect code. Please check your email and try again.';
      } else if (err.message?.includes('Code expired')) {
        errorMessage = 'This verification code has expired. Please contact support for a new code.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Invalid token state
  if (!token) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Verification Link</h1>
            <p className="text-gray-600 mb-6">
              This verification link is missing required information. Please use the complete link from your email.
            </p>
            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Homepage
            </button>
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
            <Shield className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Verification</h1>
          <p className="text-gray-600">
            Enter the 6-digit code from your approval email
          </p>
        </div>

        {/* Information Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Key className="w-5 h-5 text-[#A3C6E0] mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-[#A3C6E0] font-medium mb-1">Check your email inbox</p>
              <p className="text-sm text-gray-700">
                Your account has been approved! Enter the 6-digit code from your email to continue setting up your account.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Input */}
          <div>
            <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
              6-Digit Verification Code
            </label>
            <input
              type="text"
              id="verificationCode"
              value={code}
              onChange={handleInputChange}
              className={`w-full px-4 py-4 text-center text-2xl font-bold tracking-widest border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error 
                  ? 'border-[#E0A3A3] bg-red-50' 
                  : isValidCodeFormat
                  ? 'border-[#A3C6E0] bg-blue-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              }`}
              placeholder="123456"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              disabled={loading}
              autoComplete="one-time-code"
              aria-invalid={error ? 'true' : 'false'}
            />
            
            {/* Helper text */}
            <div className="mt-2 text-center">
              {!isValidCodeFormat && code.length > 0 && (
                <p className="text-sm text-gray-500">
                  Enter all 6 digits from your email
                </p>
              )}
              {isValidCodeFormat && (
                <p className="text-sm text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Valid format
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValidCodeFormat || loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isValidCodeFormat && !loading
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Verifying Code...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Shield className="w-5 h-5 mr-2" />
                Verify & Continue
              </div>
            )}
          </button>
        </form>

        {/* Help Section */}
        <div className="mt-8 space-y-4">
          {/* Back to Home */}
          <div className="text-center">
            <button
              onClick={handleGoHome}
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Homepage
            </button>
          </div>

          {/* Help Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 text-center">
              <strong>Need help?</strong><br />
              Check your email inbox and spam folder for the 6-digit verification code.
            </p>
          </div>

          {/* Contact Support */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Having trouble? Contact support for assistance with your verification.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}