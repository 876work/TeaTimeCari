import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { LogIn, Loader2, AlertCircle, Mail, Lock, ArrowLeft, RotateCcw, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../AuthLayout';

interface LoginComponentProps {
  onLoginSuccess?: () => void;
  onBackToRegister?: () => void;
}

export function LoginComponent({ onLoginSuccess, onBackToRegister }: LoginComponentProps) {
  const supabase = useSupabaseClient();
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    password: false
  });

  // Handle input changes
  const handleInputChange = (field: 'email' | 'password') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
    
    // Clear reset success message when user starts typing
    if (resetEmailSent) {
      setResetEmailSent(false);
    }
  };

  // Handle field blur
  const handleBlur = (field: 'email' | 'password') => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Validate form
  const isFormValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(formData.email) && (showPasswordReset || formData.password.length >= 10);
  };

  // Handle password reset request
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsResettingPassword(true);
    setError(null);

    try {
      const { data, error: resetError } = await supabase.functions.invoke('request-discourse-password-reset', {
        body: { email: formData.email }
      });

      if (resetError || !data?.success) {
        throw new Error(resetError?.message || data?.error || 'Failed to send password reset email');
      }

      setResetEmailSent(true);
      setError(null);

    } catch (err: any) {
      console.error('Password reset error:', err);
      
      let errorMessage = 'Failed to send reset email. Please try again.';
      
      if (err.message?.includes('rate limit') || err.message?.includes('Too many')) {
        errorMessage = 'Too many reset requests. Please wait before trying again.';
      } else if (err.message?.includes('not configured')) {
        errorMessage = 'Password reset service is temporarily unavailable. Please contact support.';
      } else if (err.message?.includes('Invalid email format')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Toggle password reset mode
  const togglePasswordReset = () => {
    setShowPasswordReset(!showPasswordReset);
    setError(null);
    setResetEmailSent(false);
    setTouched({ email: false, password: false });
  };
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If in password reset mode, handle reset instead
    if (showPasswordReset) {
      return handlePasswordReset(e);
    }
    
    // Mark all fields as touched
    setTouched({ email: true, password: true });
    
    if (!isFormValid()) {
      setError('Please enter a valid email and password (minimum 10 characters)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        console.log('Login successful:', data.user.email);
        
        // Check if user has completed registration
        const { data: registrationData, error: regError } = await supabase
          .from('registrations')
          .select('status, email_code, email_code_expiry')
          .eq('id', data.user.id)
          .maybeSingle();

        if (regError && regError.code !== '42P01') {
          console.error('Error checking registration status:', regError);
          // Don't fail login if we can't check registration status
        }

        if (registrationData) {
          // Handle different registration statuses
          switch (registrationData.status) {
            case 'pending':
              setError('Your application is still under review. Please wait for approval - you\'ll receive an email with verification instructions once approved by our team.');
              await supabase.auth.signOut();
              return;
            
            case 'approved':
              setError('Your account has been approved! Please check your email for a verification code and link to complete setup.');
              await supabase.auth.signOut();
              return;
            
            case 'active':
              // User is fully verified and can access the app
              break;
            
            case 'rejected':
              setError('Your account has been rejected. Please contact support for assistance.');
              await supabase.auth.signOut();
              return;
            
            case 'banned':
              setError('Your account has been banned. Please contact support for assistance.');
              await supabase.auth.signOut();
              return;
            
            default:
              setError(`Account status: ${registrationData.status}. Please contact support if you believe this is an error.`);
              await supabase.auth.signOut();
              return;
          }
        }

        // Successful login
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          // Default redirect to main app
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before logging in.';
      } else if (err.message?.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            {showPasswordReset ? (
              <RotateCcw className="w-8 h-8 text-[#A3C6E0]" />
            ) : (
              <LogIn className="w-8 h-8 text-[#A3C6E0]" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {showPasswordReset ? 'Reset Password' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600">
            {showPasswordReset 
              ? 'Enter your email to receive a password reset link'
              : 'Sign in to your Tea Time Cari account'
            }
          </p>
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

        {/* Success Message for Password Reset */}
        {resetEmailSent && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg" role="status">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <div>
                <span className="text-green-700 text-sm font-medium">Reset email sent!</span>
                <p className="text-green-600 text-xs mt-1">
                  For security, we can't confirm addresses. If registered, you'll receive a reset email shortly.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.email && !formData.email
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Enter your email address"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            {touched.email && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
              <p className="mt-2 text-sm text-red-600">
                Please enter a valid email address
              </p>
            )}
          </div>

          {/* Password */}
          {!showPasswordReset && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.password && formData.password.length < 6
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                autoComplete="current-password"
                minLength={6}
              />
            </div>
            {touched.password && formData.password.length > 0 && formData.password.length < 6 && (
              <p className="mt-2 text-sm text-red-600">
                Password must be at least 10 characters
              </p>
            )}
          </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid() || isLoading || isResettingPassword}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isFormValid() && !isLoading && !isResettingPassword
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading || isResettingPassword ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                {showPasswordReset ? 'Sending Reset Email...' : 'Signing In...'}
              </div>
            ) : showPasswordReset ? (
              <div className="flex items-center justify-center">
                <RotateCcw className="w-5 h-5 mr-2" />
                Send Reset Email
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </div>
            )}
          </button>
        </form>

        {/* Password Reset Toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={togglePasswordReset}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors underline"
          >
            {showPasswordReset ? (
              <div className="flex items-center justify-center">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Sign In
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <RotateCcw className="w-4 h-4 mr-1" />
                Forgot your password?
              </div>
            )}
          </button>
        </div>

        {/* Back to Registration Link */}
        {onBackToRegister && (
          <div className="mt-6 text-center">
            <button
              onClick={onBackToRegister}
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Registration
            </button>
          </div>
        )}

        {/* Additional Help */}
        <div className="mt-8 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Need help?</strong><br />
              {showPasswordReset 
                ? 'You will receive a password reset email from our community forum. Check your spam folder if you don\'t see it.'
                : 'If you\'re having trouble logging in, please contact support for assistance.'
              }
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}