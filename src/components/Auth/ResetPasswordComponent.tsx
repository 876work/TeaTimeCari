import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../AuthLayout';

interface ResetPasswordComponentProps {
  onResetComplete?: () => void;
  onBackToLogin?: () => void;
}

export function ResetPasswordComponent({ onResetComplete, onBackToLogin }: ResetPasswordComponentProps) {
  const supabase = useSupabaseClient();
  
  // Form state
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false
  });
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  // Check if we have a valid recovery session
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setIsValidSession(false);
          return;
        }

        // Check if we have a recovery session
        if (session?.user && session.access_token) {
          // Additional check: see if this is a recovery session by checking URL params
          const urlParams = new URLSearchParams(window.location.search);
          const type = urlParams.get('type');
          
          if (type === 'recovery' || session.user.recovery_sent_at) {
            setIsValidSession(true);
          } else {
            // Regular session, not a recovery session
            setIsValidSession(false);
            setError('This link is only for password recovery. Please use the login page for regular access.');
          }
        } else {
          setIsValidSession(false);
          setError('Invalid or expired password reset link. Please request a new one.');
        }
      } catch (err: any) {
        console.error('Error checking recovery session:', err);
        setIsValidSession(false);
        setError('Failed to verify reset link. Please try again.');
      }
    };

    checkRecoverySession();
  }, [supabase]);

  // Handle input changes
  const handleInputChange = (field: 'password' | 'confirmPassword') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  // Handle field blur
  const handleBlur = (field: 'password' | 'confirmPassword') => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Validate form
  const validateForm = () => {
    if (!formData.password) {
      return 'Password is required';
    }
    
    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      return 'Please confirm your password';
    }
    
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    
    return null;
  };

  const isFormValid = () => {
    return validateForm() === null;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ password: true, confirmPassword: true });
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Update the user's password
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (updateError) {
        throw updateError;
      }

      if (data.user) {
        console.log('Password reset successful for user:', data.user.email);
        
        // Sync the new password to Discourse
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-discourse-password', {
            body: { 
              email: data.user.email,
              password: formData.password 
            }
          });

          if (syncError) {
            console.warn('Discourse password sync failed:', syncError);
            // Don't fail the reset if Discourse sync fails
            // User can still log into the main app
          } else if (syncData?.success) {
            console.log('Password successfully synced to Discourse');
          } else {
            console.warn('Discourse sync returned error:', syncData?.error);
          }
        } catch (syncErr: any) {
          console.warn('Discourse sync error:', syncErr);
          // Continue with success even if Discourse sync fails
        }
        
        
        // Sync the new password to Discourse
        try {
          const { error: syncError } = await supabase.functions.invoke('sync-discourse-password', {
            body: { 
              email: data.user.email,
              password: formData.password 
            }
          });

          if (syncError) {
            console.warn('Discourse password sync failed:', syncError);
            // Don't fail the reset if Discourse sync fails
            // User can still log into the main app
          } else {
            console.log('Password successfully synced to Discourse');
          }
        } catch (syncErr: any) {
          console.warn('Discourse sync error:', syncErr);
          // Continue with success even if Discourse sync fails
        }
        
        setIsComplete(true);
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          if (onResetComplete) {
            onResetComplete();
          } else {
            // Default redirect to login
            window.location.href = '/';
          }
        }, 3000);
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (err.message?.includes('session_not_found')) {
        errorMessage = 'Your reset session has expired. Please request a new password reset link.';
      } else if (err.message?.includes('weak_password')) {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (err.message?.includes('same_password')) {
        errorMessage = 'New password must be different from your current password.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle going back to login
  const handleBackToLogin = () => {
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      window.location.href = '/';
    }
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verifying reset link...</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Invalid session state
  if (!isValidSession) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Reset Link</h1>
            <p className="text-gray-600 mb-6">
              {error || 'This password reset link is invalid or has expired.'}
            </p>
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
  if (isComplete) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Complete!</h1>
            <p className="text-gray-600 mb-4">
              Your password has been successfully updated.
            </p>
            <div className="animate-pulse text-sm text-gray-500 mb-6">
              Redirecting you to login in 3 seconds...
            </div>
            <button
              onClick={handleBackToLogin}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Continue to Login
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
            <Lock className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set New Password</h1>
          <p className="text-gray-600">
            Enter your new password below
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.password && formData.password.length > 0 && formData.password.length < 6
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Enter your new password"
                required
                disabled={isLoading}
                autoComplete="new-password"
                minLength={10}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
            {touched.password && formData.password.length > 0 && formData.password.length < 6 && (
              <p className="mt-2 text-sm text-red-600">
                Password must be at least 10 characters
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.confirmPassword && formData.confirmPassword && formData.password !== formData.confirmPassword
                    ? 'border-[#E0A3A3] bg-red-50'
                    : touched.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword
                    ? 'border-[#A3C6E0] bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Confirm your new password"
                required
                disabled={isLoading}
                autoComplete="new-password"
                minLength={10}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
            {touched.confirmPassword && formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="mt-2 text-sm text-red-600">
                Passwords do not match
              </p>
            )}
            {touched.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 6 && (
              <p className="mt-2 text-sm text-green-600">
                ✅ Passwords match
              </p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Password Requirements:</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li className={`flex items-center ${formData.password.length >= 10 ? 'text-green-700' : ''}`}>
                <span className="mr-2">{formData.password.length >= 10 ? '✅' : '•'}</span>
                At least 10 characters long
              </li>
              <li className={`flex items-center ${formData.password && formData.confirmPassword && formData.password === formData.confirmPassword ? 'text-green-700' : ''}`}>
                <span className="mr-2">{formData.password && formData.confirmPassword && formData.password === formData.confirmPassword ? '✅' : '•'}</span>
                Passwords must match
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid() || isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isFormValid() && !isLoading
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Updating Password...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Lock className="w-5 h-5 mr-2" />
                Update Password
              </div>
            )}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <button
            onClick={handleBackToLogin}
            className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-8 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Security Notice:</strong> After updating your password, you'll be able to sign in to both the app and community forum with your new credentials.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}