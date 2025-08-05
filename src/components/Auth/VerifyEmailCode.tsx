import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Mail, Loader2, AlertCircle, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../AuthLayout';

interface VerifyEmailCodeProps {
  onVerificationComplete?: () => void;
  onBackToLogin?: () => void;
  userEmail?: string;
}

interface UserRegistration {
  id: string;
  email: string;
  firstName: string;
  status: string;
  email_code: string | null;
  email_code_expiry: string | null;
}

export function VerifyEmailCode({ onVerificationComplete, onBackToLogin, userEmail }: VerifyEmailCodeProps) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // Form state
  const [emailCode, setEmailCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidCodeFormat, setIsValidCodeFormat] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [userRegistration, setUserRegistration] = useState<UserRegistration | null>(null);
  const [fetchingUser, setFetchingUser] = useState(true);
  
  // Resend code state
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLimitReached, setResendLimitReached] = useState(false);
  const [rateLimitResetTimer, setRateLimitResetTimer] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  
  // Code expiry state
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isCodeExpired, setIsCodeExpired] = useState(false);

  // Fetch user registration data
  useEffect(() => {
    const fetchUserRegistration = async () => {
      if (!session?.user?.id) {
        setError('Please log in to verify your email code.');
        setFetchingUser(false);
        return;
      }

      try {
        const { data: registration, error: fetchError } = await supabase
          .from('registrations')
          .select('id, email, firstName, status, email_code, email_code_expiry')
          .eq('id', session.user.id)
          .single();

        if (fetchError) {
          if (fetchError.code === '42P01') {
            console.warn('Registrations table not found, using mock data');
            setUserRegistration({
              id: session.user.id,
              email: session.user.email || 'demo@example.com',
              firstName: 'Demo',
              status: 'verified',
              email_code: 'SLU123456',
              email_code_expiry: new Date(Date.now() + 600000).toISOString() // 10 minutes from now
            });
            setFetchingUser(false);
            return;
          }
          throw fetchError;
        }

        if (!registration) {
          setError('Registration not found. Please complete registration first.');
          setFetchingUser(false);
          return;
        }

        if (registration.status !== 'verified') {
          if (registration.status === 'pending') {
            setError('Your account is still pending admin approval. Please wait for approval before verifying your email code.');
          } else if (registration.status === 'active') {
            setError('Your account is already active. You can proceed to the main application.');
          } else if (registration.status === 'rejected') {
            setError('Your account has been rejected. Please contact support for assistance.');
          } else if (registration.status === 'banned') {
            setError('Your account has been banned. Please contact support for assistance.');
          } else {
            setError(`Account status: ${registration.status}. Please contact support for assistance.`);
          }
          setFetchingUser(false);
          return;
        }

        if (!registration.email_code || !registration.email_code_expiry) {
          setError('No verification code found. Please contact support or wait for admin approval.');
          setFetchingUser(false);
          return;
        }

        // Check if code has expired
        const expiryDate = new Date(registration.email_code_expiry);
        if (expiryDate < new Date()) {
          setError('Your verification code has expired. Please contact support for a new code.');
          setFetchingUser(false);
          return;
        }

        setUserRegistration(registration);
        
        // Calculate time remaining until code expires
        const expiryDate = new Date(registration.email_code_expiry);
        const now = new Date();
        const remainingMs = expiryDate.getTime() - now.getTime();
        const remainingSeconds = Math.floor(remainingMs / 1000);
        
        if (remainingSeconds <= 0) {
          // Code is already expired
          setIsCodeExpired(true);
          setTimeRemaining(0);
          setError('Your verification code has expired. Please contact support for a new code.');
          
          // Auto-redirect after showing error for 3 seconds
          setTimeout(() => {
            alert('Your verification code has expired. You will be redirected to the login page.');
            handleBackToLogin();
          }, 3000);
        } else {
          setTimeRemaining(remainingSeconds);
          setIsCodeExpired(false);
        }
      } catch (err: any) {
        console.error('Error fetching user registration:', err);
        setError('Failed to load verification data. Please try again.');
      } finally {
        setFetchingUser(false);
      }
    };

    fetchUserRegistration();
  }, [session, supabase]);

  // Live countdown timer for code expiry
  useEffect(() => {
    if (!userRegistration?.email_code_expiry || isCodeExpired || timeRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          // Code has expired during the session
          setIsCodeExpired(true);
          setError('Your verification code has expired during this session. You will be redirected shortly.');
          
          // Show alert and redirect after 2 seconds
          setTimeout(() => {
            alert('Your verification code has expired. You will be redirected to the login page.');
            handleBackToLogin();
          }, 2000);
          
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [userRegistration?.email_code_expiry, isCodeExpired, timeRemaining]);

  // Validate email code format
  useEffect(() => {
    // Validate email code format: SLU followed by exactly 6 digits
    setIsValidCodeFormat(/^SLU\d{6}$/.test(emailCode));
    if (error && emailCode.length > 0) {
      setError(null); // Clear error when user starts typing again
    }
    
    // Clear resend messages when user starts typing
    if (resendSuccess || resendError) {
      setResendSuccess(false);
      setResendError(null);
    }
    
    // Clear rate limit status when user starts typing (they might have a valid code)
    if (resendLimitReached) {
      setResendLimitReached(false);
      setRateLimitResetTimer(0);
    }
    
    // Clear expiry status when user starts typing (they might have received a new code)
    if (isCodeExpired && emailCode.length > 0) {
      setIsCodeExpired(false);
      setError(null);
    }
  }, [emailCode, error]);

  // Cooldown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Rate limit reset timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (rateLimitResetTimer > 0) {
      timer = setTimeout(() => {
        setRateLimitResetTimer(prev => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            setResendLimitReached(false);
            setResendError(null);
          }
          return newValue;
        });
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [rateLimitResetTimer]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().trim();
    
    // Auto-add SLU prefix if user starts typing digits
    if (/^\d/.test(value) && !value.startsWith('SLU')) {
      value = 'SLU' + value;
    }
    
    // Limit to SLU + 6 digits
    if (value.startsWith('SLU')) {
      const digits = value.slice(3).replace(/\D/g, '');
      value = 'SLU' + digits.slice(0, 6);
    }
    
    setEmailCode(value);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if code is expired before submission
    if (isCodeExpired || timeRemaining <= 0) {
      setError('Your verification code has expired. Please contact support for a new code.');
      return;
    }
    
    if (!userRegistration || !emailCode.trim()) {
      setError('Please enter your verification code.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Validate the entered code against the stored code
      if (emailCode !== userRegistration.email_code) {
        setError('Incorrect code. Please check your email and try again.');
        setIsLoading(false);
        return;
      }

      // Check if code has expired (double-check)
      const expiryDate = new Date(userRegistration.email_code_expiry!);
      if (expiryDate < new Date()) {
        setIsCodeExpired(true);
        setTimeRemaining(0);
        setError('This code has expired during verification. You will be redirected shortly.');
        
        // Auto-redirect after showing error
        setTimeout(() => {
          alert('Your verification code has expired. You will be redirected to the login page.');
          handleBackToLogin();
        }, 2000);
        
        setIsLoading(false);
        return;
      }

      // Update user status to 'active' and clear the email code
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ 
          status: 'active',
          email_code: null,
          email_code_expiry: null
        })
        .eq('id', userRegistration.id);

      if (updateError && updateError.code !== '42P01') {
        throw updateError;
      }

      console.log('Email verification successful for user:', userRegistration.email);
      setIsVerified(true);
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        if (onVerificationComplete) {
          onVerificationComplete();
        } else {
          // Default redirect to main app
          window.location.href = '/';
        }
      }, 2000);

    } catch (err: any) {
      console.error('Email verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend code
  const handleResendCode = async () => {
    if (!userRegistration || isResending || resendCooldown > 0 || isLoading || resendLimitReached || isCodeExpired) return;

    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);
    setError(null);
    setResendLimitReached(false);

    try {
      // Call the Edge Function to generate and send a new code
      const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-approval-email', {
        body: {
          email: userRegistration.email,
          firstName: userRegistration.firstName
        }
      });

      if (emailError) {
        // Check if this is a rate limiting error
        if (emailError.message?.includes("You've reached the resend limit")) {
          setResendLimitReached(true);
          setRateLimitResetTimer(3600); // 60 minutes = 3600 seconds
          setResendError("You've reached the resend limit. Please try again after 1 hour.");
          return;
        } else {
          throw new Error(emailError.message || 'Failed to send verification code');
        }
      }

      if (emailResponse?.success) {
        setResendSuccess(true);
        setResendCooldown(30); // Start 30-second cooldown
        
        // Refresh user registration data to get the new code and expiry
        const { data: updatedRegistration, error: refreshError } = await supabase
          .from('registrations')
          .select('id, email, firstName, status, email_code, email_code_expiry')
          .eq('id', session?.user?.id)
          .single();

        if (!refreshError && updatedRegistration) {
          setUserRegistration(updatedRegistration);
          
          // Reset expiry timer with new code
          const expiryDate = new Date(updatedRegistration.email_code_expiry);
          const now = new Date();
          const remainingMs = expiryDate.getTime() - now.getTime();
          const remainingSeconds = Math.floor(remainingMs / 1000);
          
          if (remainingSeconds > 0) {
            setTimeRemaining(remainingSeconds);
            setIsCodeExpired(false);
            setError(null);
          }
        }
      } else {
        // Check if the response indicates rate limiting
        if (emailResponse?.error?.includes("You've reached the resend limit") || emailResponse?.rateLimited) {
          setResendLimitReached(true);
          setRateLimitResetTimer(3600); // 60 minutes = 3600 seconds
          setResendError("You've reached the resend limit. Please try again after 1 hour.");
        } else {
          throw new Error(emailResponse?.error || 'Failed to send verification code');
        }
      }

    } catch (err: any) {
      console.error('Error resending code:', err);
      
      // Check if this is a rate limiting error from the catch block
      if (err.message?.includes("You've reached the resend limit")) {
        setResendLimitReached(true);
        setRateLimitResetTimer(3600); // 60 minutes = 3600 seconds
        setResendError("You've reached the resend limit. Please try again after 1 hour.");
      } else {
        setResendError(err.message || 'Something went wrong while resending the code. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  // Format time remaining for display
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '0m 0s';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Handle back to login
  const handleBackToLogin = () => {
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      window.location.href = '/';
    }
  };

  // Loading state while fetching user data
  if (fetchingUser) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading verification data...</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Error state - user not eligible for verification
  if (error && !userRegistration) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Verification Not Available</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleBackToLogin}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Success state
  if (isVerified) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified Successfully!</h1>
            <p className="text-gray-600 mb-4">
              Your account is now active and you can access the platform.
            </p>
            <div className="animate-pulse text-sm text-gray-500 mb-6">
              Redirecting you to the main application...
            </div>
            <button
              onClick={() => {
                if (onVerificationComplete) {
                  onVerificationComplete();
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Continue to App
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
            <Mail className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
          <p className="text-gray-600">
            Enter the 6-digit code we sent to your email
          </p>
          {userRegistration?.email && (
            <p className="text-sm text-gray-500 mt-2">
              Code sent to: <span className="font-medium">{userRegistration.email}</span>
            </p>
          )}
          {userRegistration?.email_code_expiry && !isCodeExpired && timeRemaining > 0 && (
            <div className="mt-3 flex items-center justify-center">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                timeRemaining <= 300 // 5 minutes
                  ? 'bg-red-100 text-red-800'
                  : timeRemaining <= 600 // 10 minutes  
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                Code expires in: {formatTimeRemaining(timeRemaining)}
              </div>
            </div>
          )}
        </div>

        {/* Information Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Mail className="w-5 h-5 text-[#A3C6E0] mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-[#A3C6E0] font-medium mb-1">Check your email inbox</p>
              <p className="text-sm text-gray-700">
                Your account has been approved! Enter the 6-digit code from your email to complete verification.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && userRegistration && (
          <div className={`mb-6 p-4 rounded-lg border ${
            isCodeExpired 
              ? 'bg-red-50 border-red-200' 
              : 'bg-red-50 border-red-200'
          }`} role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <div>
                <span className="text-red-700 text-sm font-medium">{error}</span>
                {isCodeExpired && (
                  <p className="text-red-600 text-xs mt-1">
                    You will be automatically redirected to request a new code.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resend Success Message */}
        {resendSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg" role="status">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-green-700 text-sm font-medium">
                A new verification code has been sent to your email.
              </span>
            </div>
          </div>
        )}

        {/* Resend Error Message */}
        {resendError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{resendError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Code Input */}
          <div>
            <label htmlFor="emailCode" className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="emailCode"
              value={emailCode}
              onChange={handleInputChange}
              className={`w-full px-4 py-4 text-center text-xl font-bold tracking-wider border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error 
                  ? 'border-[#E0A3A3] bg-red-50' 
                  : isValidCodeFormat
                  ? 'border-[#A3C6E0] bg-blue-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              } ${isCodeExpired || timeRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="SLU123456"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'code-error' : undefined}
              maxLength={9}
              disabled={isLoading || isCodeExpired || timeRemaining <= 0}
              autoComplete="one-time-code"
            />
            
            {/* Helper text */}
            <div className="mt-2 text-center">
              {!isValidCodeFormat && emailCode.length > 0 && (
                <p className="text-sm text-gray-500">
                  Format: SLU followed by 6 digits (e.g., SLU123456)
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

          {/* Code Expiry Info */}
          {userRegistration?.email_code_expiry && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center">
                <RefreshCw className="w-5 h-5 text-amber-600 mr-2" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">Code expires at:</p>
                  <p className="text-sm text-amber-700">
                    {new Date(userRegistration.email_code_expiry).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValidCodeFormat || isLoading || isCodeExpired || timeRemaining <= 0}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isValidCodeFormat && !isLoading && !isCodeExpired && timeRemaining > 0
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Verifying Code...
              </div>
            ) : isCodeExpired || timeRemaining <= 0 ? (
              <div className="flex items-center justify-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Code Expired
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Verify Code
              </div>
            )}
          </button>
        </form>

        {/* Resend Code Section */}
        <div className="mt-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Didn't receive the code?</span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isResending || resendCooldown > 0 || isLoading || resendLimitReached || isCodeExpired || timeRemaining <= 0}
            className={`mt-4 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              isResending || resendCooldown > 0 || isLoading || resendLimitReached || isCodeExpired || timeRemaining <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#A3C6E0] shadow-sm hover:shadow-md'
            }`}
          >
            {isResending ? (
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending New Code...
              </div>
            ) : resendCooldown > 0 ? (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend in {resendCooldown}s
              </div>
            ) : resendLimitReached ? (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                Rate Limited ({Math.floor(rateLimitResetTimer / 60)}m {rateLimitResetTimer % 60}s)
              </div>
            ) : isCodeExpired || timeRemaining <= 0 ? (
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Code Expired
              </div>
            ) : (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend Code
              </div>
            )}
          </button>
          
          {/* Rate Limit Message */}
          {resendLimitReached && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-amber-600 mr-2" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">
                    You've reached the resend limit. Please try again after 1 hour.
                  </p>
                  {rateLimitResetTimer > 0 && (
                    <p className="text-xs text-amber-700 mt-1">
                      Reset in: {Math.floor(rateLimitResetTimer / 60)} minutes and {rateLimitResetTimer % 60} seconds
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Code Expired Message */}
        {isCodeExpired && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <div>
                <p className="text-sm text-red-800 font-medium">
                  Your verification code has expired.
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Please contact support to request a new verification code.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 space-y-4">
          {/* Back to Login */}
          <div className="text-center">
            <button
              onClick={handleBackToLogin}
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </button>
          </div>

          {/* Help Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 text-center">
              <strong>Still having trouble?</strong><br />
              Check your email inbox and spam folder. Codes expire 10 minutes after being sent.
            </p>
          </div>

          {/* Contact Support */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact support for assistance with your verification code.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}