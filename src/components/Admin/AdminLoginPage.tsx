import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getAdminSession } from "@/lib/adminAuth";
import { hasPendingSso, finishDiscourseSso } from "@/lib/discourseSso";
import { AdminAlert, AdminButton, AdminCard, AdminInput } from "./ui";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/admin") || value.startsWith("/admin/login")) {
    return "/admin/dashboard";
  }

  return value;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const nextPath = useMemo(
    () => safeNext(new URLSearchParams(location.search).get("next")),
    [location.search]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          const {
            data: { session },
          } = await supabase.auth.getSession();

          await finishDiscourseSso(session?.access_token ?? "");
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
        setError("This account does not have Tea Time Cari admin access.");
        return;
      }

      if (hasPendingSso()) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        await finishDiscourseSso(session?.access_token ?? "");
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (err: unknown) {
      console.error("Admin login error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Admin login failed. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-admin-bg px-4 py-8 text-admin-fg sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(75,158,200,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,110,110,0.14),transparent_32%)]"
        aria-hidden="true"
      />

      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-blue/40 to-transparent"
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] [background-size:44px_44px]"
        aria-hidden="true"
      />

      <div className="absolute left-10 top-20 h-32 w-32 rounded-full bg-brand-blue/10 blur-2xl" aria-hidden="true" />
      <div className="absolute bottom-20 right-10 h-40 w-40 rounded-full bg-brand-coral/10 blur-2xl" aria-hidden="true" />

      <main className="admin-page-enter relative z-10 w-full max-w-[1060px]">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-6 inline-flex items-center gap-2 rounded-admin-md px-1 text-sm font-semibold text-admin-muted-fg transition hover:text-admin-fg focus:outline-none focus:ring-2 focus:ring-admin-brand focus:ring-offset-4 focus:ring-offset-admin-bg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to Tea Time Cari
        </button>

        <div className="grid overflow-hidden rounded-[1.5rem] border border-admin-border bg-white/80 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.65)] backdrop-blur xl:grid-cols-[0.95fr_1.05fr]">
          <section className="hidden border-r border-admin-border bg-slate-950 px-10 py-12 text-white xl:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-sm">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold tracking-tight">
                      Tea Time Cari
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                      Admin Portal
                    </p>
                  </div>
                </div>

                <div className="mt-20 max-w-sm">
                  <p className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Admin access only
                  </p>

                  <h1 className="text-4xl font-semibold tracking-tight text-white">
                    Secure management for Tea Time Cari.
                  </h1>

                  <p className="mt-5 text-sm leading-6 text-slate-300">
                    Sign in to manage users, moderation, community roles, and
                    system activity from the admin dashboard.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Lock
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue-light"
                    aria-hidden="true"
                  />
                  <p>Use an authorized administrator account to continue.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="px-5 py-8 sm:px-10 sm:py-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7 text-center xl:text-left">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-admin-border bg-white p-2 shadow-admin-sm xl:mx-0">
                  <img
                    src="/teaLogo.png"
                    alt="Tea Time Cari"
                    className="h-full w-full object-contain"
                  />
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-admin-muted-fg">
                  Admin Portal
                </p>

                <h2
                  id="admin-login-heading"
                  className="mt-2 text-2xl font-bold tracking-tight text-admin-fg"
                >
                  Sign in to Tea Time Cari
                </h2>

                <p className="mt-3 text-sm leading-6 text-admin-muted-fg">
                  Admin access only. Manage users, moderation, community roles,
                  and system activity.
                </p>
              </div>

              <AdminCard className="shadow-admin">
                <form
                  name="admin-login"
                  method="POST"
                  data-netlify="true"
                  onSubmit={handleLogin}
                  className="space-y-5"
                  aria-labelledby="admin-login-heading"
                >
                  <input
                    type="hidden"
                    name="form-name"
                    value="admin-login"
                    readOnly
                  />

                  {error && <AdminAlert variant="error">{error}</AdminAlert>}

                  <div className="space-y-2">
                    <label
                      htmlFor="admin-email"
                      className="text-sm font-semibold text-admin-fg"
                    >
                      Admin email
                    </label>

                    <AdminInput
                      type="email"
                      id="admin-email"
                      name="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      disabled={isLoading || checkingSession}
                      autoComplete="email"
                      placeholder="admin@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="admin-password"
                      className="text-sm font-semibold text-admin-fg"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <AdminInput
                        type={showPassword ? "text" : "password"}
                        id="admin-password"
                        name="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        disabled={isLoading || checkingSession}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-admin-muted-fg" />
                        ) : (
                          <Eye className="h-4 w-4 text-admin-muted-fg" />
                        )}
                      </button>
                    </div>
                  </div>

                  <AdminButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isLoading || checkingSession}
                    disabled={isLoading || checkingSession || !email || !password}
                    className="w-full bg-slate-950 hover:bg-slate-800 focus-visible:ring-slate-900/20"
                  >
                    {checkingSession
                      ? "Checking session…"
                      : isLoading
                      ? "Signing in…"
                      : "Sign in"}
                  </AdminButton>
                </form>
              </AdminCard>

              <p className="mt-5 text-center text-xs leading-5 text-admin-muted-fg">
                Tea Time Cari Admin · Unauthorized users should return to the
                main site.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}