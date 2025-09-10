import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft, Send, Info } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where the magic link will send users after they click the email button
  const redirectBase = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
  const redirectTo = `${redirectBase}/reset-password`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Always call the reset function, but don't reveal if the email exists
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });

      // Always show success message regardless of whether email exists
      setSubmitted(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      // Even on error, show the generic message to prevent enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  // Success state - generic message
  if (submitted) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[#A3C6E0]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
            <p className="text-gray-600 mb-6">
              If your email address is in our database, a password reset link will be sent to it.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-blue-800 font-medium mb-1">What to do next:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Check your email inbox (including spam folder)</li>
                    <li>• Click the reset link if you receive an email</li>
                    <li>• The link will expire in 1 hour for security</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Login
              </Link>
              
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                  setError(null);
                }}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Try Different Email
              </button>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h1>
          <p className="text-gray-600">
            Enter your email address and we'll send you a reset link if your account exists.
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
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white hover:border-[#A3C6E0]"
                placeholder="Enter your email address"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              !loading && email.trim()
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Sending Reset Link...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Send className="w-5 h-5 mr-2" />
                Send Reset Link
              </div>
            )}
          </button>
        </form>

        {/* Additional Links */}
        <div className="mt-8 space-y-4">
          <div className="text-center">
            <Link
              to="/login"
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 text-center">
              <strong>Security Notice:</strong> For your privacy, we don't reveal whether an email address is registered with us.
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Need help? <Link to="/contact-us" className="text-[#A3C6E0] hover:text-[#8BB5D9] transition-colors">Contact our support team</Link>
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}