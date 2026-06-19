import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building2 } from 'lucide-react';
import { AuthLayout } from '@/components/AuthLayout';
import { FormField, PageSection, PrimaryButton, StatusAlert } from '@/components/Form';
import { supabase } from '@/lib/supabaseClient';
import type { UserRole } from '@/contexts/AuthContext';

const friendlyAuthError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('already')) return 'An account with this email already exists. Please log in instead.';
  if (lower.includes('password')) return 'Please choose a stronger password.';
  if (lower.includes('email')) return 'Please enter a valid email address.';
  return 'We could not create your account right now. Please try again.';
};

export default function RoleSignup({ role }: { role: Exclude<UserRole, 'admin'> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [creatorType, setCreatorType] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const title = role === 'business' ? 'Create your business account' : 'Create your creator account';
  const onboardingPath = role === 'business' ? '/business/onboarding' : '/creator/onboarding';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setLoading(true);
    const redirectBase = (import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, '');
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${redirectBase}/verify-email?next=${encodeURIComponent(onboardingPath)}`,
        data: {
          role,
          full_name: fullName.trim(),
          country_code: countryCode.trim() || null,
          business_name: role === 'business' ? organizationName.trim() : undefined,
          creator_type: role === 'creator' ? creatorType.trim() : undefined,
        },
      },
    });

    if (signUpError || !data.user) {
      setError(friendlyAuthError(signUpError?.message ?? 'Signup failed'));
      setLoading(false);
      return;
    }

    const profilePayload = {
      id: data.user.id,
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      country_code: countryCode.trim() || null,
      role,
      status: 'active',
    };

    const { error: profileError } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileError) {
      setError('Your account was created, but setup could not be completed. Please contact support.');
      setLoading(false);
      return;
    }

    const roleTable = role === 'business' ? 'business_profiles' : 'creator_profiles';
    const rolePayload = role === 'business'
      ? { id: data.user.id, business_name: organizationName.trim(), onboarding_completed: false }
      : { id: data.user.id, creator_type: creatorType.trim(), approval_status: 'pending_review', verification_status: 'unverified', onboarding_completed: false };

    const { error: roleError } = await supabase.from(roleTable).upsert(rolePayload, { onConflict: 'id' });
    setLoading(false);

    if (roleError) {
      setError('Your account was created, but role setup could not be completed. Please contact support.');
      return;
    }

    if (!data.session) {
      navigate(`/verify-email?role=${role}&next=${encodeURIComponent(onboardingPath)}`, { replace: true, state: { email } });
      return;
    }

    setSuccess('Account created successfully. Redirecting…');
    navigate(onboardingPath, { replace: true, state: { from: location.pathname } });
  };

  return (
    <AuthLayout>
      <PageSection>
        <div className="mb-8 text-center"><h1 className="text-2xl font-bold text-gray-900">{title}</h1><p className="text-gray-600">Admin accounts cannot be created from this form.</p></div>
        {error && <StatusAlert variant="error" className="mb-6">{error}</StatusAlert>}
        {success && <StatusAlert variant="success" className="mb-6">{success}</StatusAlert>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField id="fullName" label="Full name" required><input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={loading} className="w-full rounded-lg border border-gray-300 px-4 py-3" /></FormField>
          <FormField id="email" label="Email" required><div className="relative"><Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" /><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4" /></div></FormField>
          <FormField id="password" label="Password" required><div className="relative"><Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" /><input id="password" type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4" /></div></FormField>
          <FormField id="countryCode" label="Country code"><input id="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} disabled={loading} placeholder="US" className="w-full rounded-lg border border-gray-300 px-4 py-3" /></FormField>
          {role === 'business' ? <FormField id="businessName" label="Business name" required><div className="relative"><Building2 className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" /><input id="businessName" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required disabled={loading} className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4" /></div></FormField> : <FormField id="creatorType" label="Creator type" required><div className="relative"><User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" /><input id="creatorType" value={creatorType} onChange={(e) => setCreatorType(e.target.value)} required disabled={loading} placeholder="Video, UGC, photography…" className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4" /></div></FormField>}
          <PrimaryButton type="submit" isLoading={loading} disabled={loading} loadingLabel="Creating account…">Create account</PrimaryButton>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">Already have an account? <Link to="/login" className="font-medium text-[#4B9EC8]">Log in</Link>.</p>
      </PageSection>
    </AuthLayout>
  );
}
