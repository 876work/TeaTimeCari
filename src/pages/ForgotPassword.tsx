import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Send } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { FormField, PageSection, PrimaryButton, StatusAlert } from '../components/Form';
import { supabase } from '@/lib/supabaseClient';

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
    } catch (err: unknown) {
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
        <PageSection>
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[#4B9EC8]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
            <p className="text-gray-600 mb-6">
              If your email address is in our database, a password reset link will be sent to it.
            </p>
            
            <StatusAlert variant="info" title="What to do next:" className="mb-6 text-left">
              <ul className="space-y-1">
                <li>• Check your email inbox (including spam folder)</li>
                <li>• Click the reset link if you receive an email</li>
                <li>• The link will expire in 1 hour for security</li>
              </ul>
            </StatusAlert>

            <div className="space-y-3">
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Login
              </Link>
              
              <PrimaryButton
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                  setError(null);
                }}
                variant="ghost"
              >
                Try Different Email
              </PrimaryButton>
            </div>
          </div>
        </PageSection>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <PageSection>
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-[#4B9EC8]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h1>
          <p className="text-gray-600">
            Enter your email address and we'll send you a reset link if your account exists.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <StatusAlert variant="error" className="mb-6">
            {error}
          </StatusAlert>
        )}

        <form name="forgot-password" method="POST" data-netlify="true" onSubmit={handleSubmit} className="space-y-6">
          <input type="hidden" name="form-name" value="forgot-password" readOnly />
          <FormField id="email" label="Email Address">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white hover:border-[#4B9EC8]"
                placeholder="Enter your email address"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </FormField>

          <PrimaryButton
            type="submit"
            disabled={loading || !email.trim()}
            isLoading={loading}
            loadingLabel="Sending Reset Link..."
            icon={<Send className="h-5 w-5" />}
          >
            Send Reset Link
          </PrimaryButton>
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
          <StatusAlert variant="info" title="Security Notice">
            For your privacy, we don't reveal whether an email address is registered with us.
          </StatusAlert>
          
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Need help? <Link to="/contact-us" className="text-[#4B9EC8] hover:text-[#3382AA] transition-colors">Contact our support team</Link>
            </p>
          </div>
        </div>
      </PageSection>
    </AuthLayout>
  );
}
