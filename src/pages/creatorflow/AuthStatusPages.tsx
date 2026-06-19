import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { PageSection, StatusAlert, PrimaryButton } from '@/components/Form';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as { email?: string } | null)?.email;
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/login';
  return <AuthLayout><PageSection><h1 className="mb-2 text-2xl font-bold">Verify your email</h1><p className="mb-6 text-gray-600">Please check {email || 'your inbox'} and click the verification link to finish setup.</p><StatusAlert variant="info" className="mb-6">After verification, continue to your onboarding flow.</StatusAlert><PrimaryButton onClick={() => navigate(next)}>Continue after verification</PrimaryButton><p className="mt-4 text-sm"><button className="text-[#4B9EC8]" onClick={() => email && supabase.auth.resend({ type: 'signup', email })}>Resend verification email</button></p></PageSection></AuthLayout>;
}

export function AccountSuspended() { return <AuthLayout><PageSection><StatusAlert variant="warning" title="Account suspended">You can sign in, but dashboard, booking, messaging, and profile editing access are paused. Please contact support.</StatusAlert><Link className="mt-6 inline-block text-[#4B9EC8]" to="/contact-us?topic=suspended">Contact support</Link></PageSection></AuthLayout>; }
export function AccountUnavailable() { return <AuthLayout><PageSection><StatusAlert variant="error" title="Account unavailable">This account is no longer available. Contact support if you believe this is a mistake.</StatusAlert></PageSection></AuthLayout>; }
export function AccountSetupError() { const { profileError } = useAuth(); return <AuthLayout><PageSection><StatusAlert variant="error" title="Account setup issue">{profileError || 'Your account setup is incomplete. Please contact support.'}</StatusAlert></PageSection></AuthLayout>; }
export function PlaceholderPage({ title }: { title: string }) { return <div className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow"><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="mt-2 text-slate-600">This route is protected by Supabase Auth and role based access control.</p></div></div>; }
