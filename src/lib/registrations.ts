import { supabase } from '@/lib/supabaseClient';
import { trackAuthLogin } from '@/hooks/useAuthActivityTracking';
import { debugError, debugLog, debugWarn } from '@/lib/debugLogger';

export interface RegistrationPayload {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  gender: 'Male' | 'Female';
  captureType: 'selfie' | 'id';
  imageData: string;
  status?: 'pending' | 'approved' | 'rejected' | 'banned' | 'suspended';
  password_temp?: string;
}

export interface RegistrationResponse {
  ok?: boolean;
  userId?: string;
  alreadyExists?: boolean;
  recoveredAuthUser?: boolean;
  status?: 'pending' | 'approved' | 'rejected' | 'banned' | 'suspended';
  sessionSynced?: boolean;
  sessionError?: string;
  error?: string;
  detail?: string;
}

export interface RegistrationResult {
  data: RegistrationResponse;
  alreadyExists: boolean;
  isNewSubmission: boolean;
}

type FunctionErrorWithContext = {
  message?: string;
  context?: {
    json?: () => Promise<RegistrationResponse>;
  };
};

function isFunctionErrorWithContext(error: unknown): error is FunctionErrorWithContext {
  return typeof error === 'object' && error !== null;
}

async function getFunctionErrorMessage(error: unknown) {
  const fallback = isFunctionErrorWithContext(error) && error.message
    ? error.message
    : 'Registration failed. Please try again.';
  const response = isFunctionErrorWithContext(error) ? error.context : undefined;

  if (response && typeof response.json === 'function') {
    try {
      const body = await response.json();
      return body?.detail ? `${body.error || fallback}: ${body.detail}` : body?.error || fallback;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export async function submitRegistration(payload: RegistrationPayload): Promise<RegistrationResult> {
  const nameParts = payload.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const normalizedPayload = {
    fullName: payload.fullName.trim(),
    firstName,
    lastName,
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    username: payload.username.trim().toLowerCase(),
    password: payload.password_temp,
    gender: payload.gender,
    captureType: payload.captureType,
    imageData: payload.imageData,
  };

  if (!normalizedPayload.password) {
    throw new Error('Password is required to create your account.');
  }

  const { data: existingSession } = await supabase.auth.getSession();
  const activeEmail = existingSession.session?.user.email?.trim().toLowerCase();

  if (activeEmail && activeEmail !== normalizedPayload.email) {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw new Error('For your security, please sign out of the current account before registering a different email.');
    }
  }

  debugLog('Submitting registration with normalized data:', {
    email: normalizedPayload.email,
    username: normalizedPayload.username,
    status: payload.status || 'pending'
  });

  const { data, error } = await supabase.functions.invoke('register-user', {
    body: normalizedPayload,
  });

  if (error) {
    debugError('Registration function error:', error);
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data?.ok) {
    debugError('Registration function returned an unsuccessful response:', data);
    throw new Error(data?.error || 'Registration failed. Please try again.');
  }

  if (!data.alreadyExists) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedPayload.email,
      password: normalizedPayload.password,
    });

    if (signInError) {
      await supabase.auth.signOut().catch((signOutError) => {
        debugWarn('Unable to clear auth session after registration sign-in failed:', signOutError);
      });

      data.sessionSynced = false;
      data.sessionError = signInError.message;
    } else {
      data.sessionSynced = true;
      await trackAuthLogin();
    }
  }

  debugLog('Registration submitted successfully:', {
    alreadyExists: Boolean(data.alreadyExists),
    isNewSubmission: !data.alreadyExists,
    sessionSynced: data.sessionSynced ?? false,
  });

  return {
    data,
    alreadyExists: Boolean(data.alreadyExists),
    isNewSubmission: !data.alreadyExists
  };
}
