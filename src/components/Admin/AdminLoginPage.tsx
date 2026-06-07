import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Lock } from 'lucide-react';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E] px-4 py-10">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-10 top-20 h-32 w-32 animate-pulse rounded-full bg-white/15" />
        <div className="absolute right-20 top-40 h-24 w-24 animate-bounce rounded-full bg-white/10" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 h-40 w-40 animate-pulse rounded-full bg-white/10" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-1/3 h-20 w-20 animate-bounce rounded-full bg-white/15" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white/85 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Tea Time Cari
        </button>

        <div className="rounded-[22px] bg-gradient-to-br from-[#D6EBF5] via-[#9B6BAE] to-[#D96E6E] p-[2px] shadow-2xl transition-all duration-300 hover:shadow-[0_0_30px_1px_rgba(214,235,245,0.35)]">
          <div className="rounded-[20px] bg-[#171717] transition-all duration-200 hover:scale-[0.98]">
            <form
              name="admin-login"
              method="POST"
              data-netlify="true"
              onSubmit={handleLogin}
              className="flex flex-col gap-4 rounded-[20px] px-8 pb-8 pt-7 text-white"
            >
              <input type="hidden" name="form-name" value="admin-login" readOnly />

              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 p-2 ring-1 ring-white/15">
                  <img
                    src="/teaLogo.png"
                    alt="Tea Time Cari"
                    className="h-full w-full object-contain drop-shadow-lg"
                  />
                </div>

                <p id="admin-login-heading" className="text-xl font-bold tracking-wide text-white">
                  Tea Time Cari Admin
                </p>

                <p className="mt-2 text-sm text-white/65">
                  Sign in with an authorized administrator account.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4" role="alert">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
                    <p className="text-sm text-red-100">{error}</p>
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-3 rounded-full bg-[#171717] px-4 py-3 text-white shadow-[inset_2px_5px_10px_rgb(5,5,5)]">
                <label htmlFor="admin-email" className="sr-only">
                  Admin email
                </label>

                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  height={16}
                  width={16}
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 flex-shrink-0 text-white/85"
                  aria-hidden="true"
                >
                  <path d="M13.106 7.222c0-2.967-2.249-5.032-5.482-5.032-3.35 0-5.646 2.318-5.646 5.702 0 3.493 2.235 5.708 5.762 5.708.862 0 1.689-.123 2.304-.335v-.862c-.43.199-1.354.328-2.29.328-2.926 0-4.813-1.88-4.813-4.798 0-2.844 1.921-4.881 4.594-4.881 2.735 0 4.608 1.688 4.608 4.156 0 1.682-.554 2.769-1.416 2.769-.492 0-.772-.28-.772-.76V5.206H8.923v.834h-.11c-.266-.595-.881-.964-1.6-.964-1.4 0-2.378 1.162-2.378 2.823 0 1.737.957 2.906 2.379 2.906.8 0 1.415-.39 1.709-1.087h.11c.081.67.703 1.148 1.503 1.148 1.572 0 2.57-1.415 2.57-3.643zm-7.177.704c0-1.197.54-1.907 1.456-1.907.93 0 1.524.738 1.524 1.907S8.308 9.84 7.371 9.84c-.895 0-1.442-.725-1.442-1.914z" />
                </svg>

                <input
                  type="email"
                  id="admin-email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#d3d3d3] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  required
                  disabled={isLoading || checkingSession}
                  autoComplete="email"
                  aria-label="Admin email"
                />
              </div>

              <div className="flex items-center gap-3 rounded-full bg-[#171717] px-4 py-3 text-white shadow-[inset_2px_5px_10px_rgb(5,5,5)]">
                <label htmlFor="admin-password" className="sr-only">
                  Password
                </label>

                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  height={16}
                  width={16}
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 flex-shrink-0 text-white/85"
                  aria-hidden="true"
                >
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                </svg>

                <input
                  type="password"
                  id="admin-password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#d3d3d3] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  required
                  disabled={isLoading || checkingSession}
                  autoComplete="current-password"
                  aria-label="Password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || checkingSession || !email || !password}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#252525] px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-black disabled:cursor-not-allowed disabled:bg-[#252525]/60 disabled:text-white/45"
              >
                {isLoading || checkingSession ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {checkingSession ? 'Checking session…' : isLoading ? 'Signing in…' : 'Login'}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-white/75 drop-shadow-sm">
          Admin access is role-protected and audited. Unauthorized users should return to the main site.
        </p>
      </div>
    </div>
  );
}