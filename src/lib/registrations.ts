import { supabase } from '@/lib/supabaseClient';

export interface RegistrationPayload {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  gender: 'Male' | 'Female';
  captureType: 'selfie' | 'id';
  imageData: string;
  status?: 'pending' | 'approved' | 'rejected' | 'banned';
  password_temp?: string;
}

export interface RegistrationResult {
  data: any;
  alreadyExists: boolean;
  isNewSubmission: boolean;
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

  console.log('Submitting registration with normalized data:', {
    email: normalizedPayload.email,
    username: normalizedPayload.username,
    status: payload.status || 'pending'
  });

  const { data, error } = await supabase.functions.invoke('register-user', {
    body: normalizedPayload,
  });

  if (error) {
    console.error('Registration function error:', error);
    throw error;
  }

  if (!data?.ok) {
    console.error('Registration function returned an unsuccessful response:', data);
    throw new Error(data?.error || 'Registration failed. Please try again.');
  }

  console.log('Registration submitted successfully:', data);

  return {
    data,
    alreadyExists: Boolean(data.alreadyExists),
    isNewSubmission: !data.alreadyExists
  };
}
