import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft, Send, Info } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectBase = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
  const redirectTo = `${redirectBase}/reset-password`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout>
        <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}>
            <Mail className="w-7 h-7 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
          <p className="mb-6" style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            If your email address is in our database, a password reset link will be sent to it.
          </p>

          <div className="dark-alert-info text-left mb-8">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">What to do next:</p>
                <ul className="space-y-1 text-xs" style={{ color: "rgba(163,198,224,0.8)" }}>
                  <li>• Check your email inbox (including spam folder)</li>
                  <li>• Click the reset link if you receive an email</li>
                  <li>• The link will expire in 1 hour for security</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link to="/login" className="dark-btn block" style={{ display: "block" }}>
              Back to Login
              <span />
            </Link>
            <button
              onClick={() => { setSubmitted(false); setEmail(''); setError(null); }}
              className="w-full py-2 text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              Try Different Email
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}>
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Reset Your Password</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Enter your email and we'll send a reset link if your account exists.
          </p>
        </div>

        {error && (
          <div className="dark-alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={`form-field ${email ? "has-value" : ""}`}>
            <input
              type="email"
              id="fp-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
            <label htmlFor="fp-email">Email Address</label>
          </div>

          <div className="text-center mt-8">
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="dark-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                  <Loader2 className="animate-spin w-4 h-4" /> Sending Reset Link...
                </span>
              ) : (
                <>
                  <Send className="inline w-4 h-4 mr-2" />
                  Send Reset Link
                  <span />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>

          <div className="dark-alert-info text-center">
            <strong>Security Notice:</strong> For your privacy, we don't reveal whether an email address is registered with us.
          </div>

          <div className="text-center">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Need help?{" "}
              <Link
                to="/contact-us"
                className="transition-colors"
                style={{ color: "#A3C6E0" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#E0A3A3")}
                onMouseLeave={e => (e.currentTarget.style.color = "#A3C6E0")}
              >
                Contact our support team
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
