import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const FN_HEADERS = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

export default function SetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const actionToken = params.get('act') ?? '';
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false
  });

  // Validate action token exists
  useEffect(() => {
    if (!actionToken) {
      setError('Invalid password reset link. Action token is missing.');
    }
  }, [actionToken]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!actionToken) {
      setError('Invalid password reset link. Please use the link from your email.');
      return;
    }

    // Mark all fields as touched
    setTouched({ password: true, confirmPassword: true });
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('kyc-set-password', {
        headers: FN_HEADERS,
        body: { 
          act: actionToken, 
          password: formData.password 
        }
      });

      if (functionError || !data?.success) {
        throw new Error(functionError?.message || data?.error || 'Failed to set password');
      }

      setUserEmail(data.email || '');
      setIsComplete(true);
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err: any) {
      console.error('Password setting error:', err);
      
      let errorMessage = 'Failed to set password. Please try again.';
      
      if (err.message?.includes('Token expired')) {
        errorMessage = 'Your verification session has expired. Please request a new verification link.';
      } else if (err.message?.includes('Invalid signature')) {
        errorMessage = 'Invalid verification link. Please use the complete link from your email.';
      } else if (err.message?.includes('Wrong token type')) {
        errorMessage = 'This link is not valid for password setting. Please use the correct verification link.';
      } else if (err.message?.includes('Malformed token')) {
        errorMessage = 'Invalid verification link format. Please use the link from your email.';
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
  if (!actionToken) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Password Setup Link</h1>
            <p className="text-gray-600 mb-6">
              This password setup link is missing required information. Please use the complete link from your verification email.
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

  // Success state
  if (isComplete) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Set Successfully!</h1>
            <p className="text-gray-600 mb-4">
              Your account is now fully activated and ready to use.
            </p>
            {userEmail && (
              <p className="text-sm text-gray-500 mb-4">
                Account: {userEmail}
              </p>
            )}
            <div className="animate-pulse text-sm text-gray-500 mb-6">
              Redirecting you to login in 3 seconds...
            </div>
            <button
              onClick={() => navigate('/login')}
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Your Password</h1>
          <p className="text-gray-600">
            Create a secure password for your account
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
          {/* Password */}
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
                disabled={loading}
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
                Password must be at least 6 characters
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
                disabled={loading}
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
            disabled={!isFormValid() || loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isFormValid() && !loading
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Setting Password...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Lock className="w-5 h-5 mr-2" />
                Set Password & Complete Setup
              </div>
            )}
          </button>
        </form>

        {/* Help Section */}
        <div className="mt-8 space-y-4">
          {/* Back to Home */}
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Homepage
            </button>
          </div>

          {/* Security Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 text-center">
              <strong>Security Notice:</strong> After setting your password, you'll be able to sign in with your email and new password.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}