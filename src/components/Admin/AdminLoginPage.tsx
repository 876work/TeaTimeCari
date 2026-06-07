import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getAdminSession } from '@/lib/adminAuth';
import { hasPendingSso, finishDiscourseSso } from '@/lib/discourseSso';

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/admin') || value.startsWith('/admin/login')) return '/admin/dashboard';
  return value;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = useMemo(() => safeNext(new URLSearchParams(location.search).get('next')), [location.search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verifyExistingSession = async () => {
      try {
        const adminSession = await getAdminSession();
        if (!adminSession || cancelled) return;

        if (hasPendingSso()) {
          const { data: { session } } = await supabase.auth.getSession();
          await finishDiscourseSso(session?.access_token ?? '');
          return;
        }

        navigate(nextPath, { replace: true });
      } catch {
        // Existing sessions that are not admins should stay on the admin login page.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    verifyExistingSession();

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) throw signInError;

      const adminSession = await getAdminSession();
      if (!adminSession) {
        await supabase.auth.signOut();
        setError('This account does not have Tea Time Cari admin access.');
        return;
      }

      if (hasPendingSso()) {
        const { data: { session } } = await supabase.auth.getSession();
        await finishDiscourseSso(session?.access_token ?? '');
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (err: unknown) {
      console.error('Admin login error:', err);
      setError(err instanceof Error ? err.message : 'Admin login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Tea Time Cari
        </button>

        <div className="rounded-2xl border border-slate-800 bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <Shield className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Tea Time Cari Admin</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in with an authorized administrator account.</p>
          </div>

          <form name="admin-login" method="POST" data-netlify="true" onSubmit={handleLogin} className="space-y-5 p-7">
            <input type="hidden" name="form-name" value="admin-login" readOnly />

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-slate-700">
                Admin email
              </label>
              <input
                type="email"
                id="admin-email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="admin@teatimecari.app"
                required
                disabled={isLoading || checkingSession}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="admin-password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter your password"
                  required
                  disabled={isLoading || checkingSession}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || checkingSession || !email || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading || checkingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {checkingSession ? 'Checking session…' : isLoading ? 'Signing in…' : 'Sign in to admin'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Admin access is role-protected and audited. Unauthorized users should return to the main site.
        </p>
      </div>
    </div>
  );
}
