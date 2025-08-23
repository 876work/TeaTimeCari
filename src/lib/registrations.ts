import { supabase } from './supabase';

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
  // Split fullName into firstName and lastName for database compatibility
  const nameParts = payload.fullName.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Normalize input data
  const normalizedPayload: any = {
    firstName: firstName,
    lastName: lastName,
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    username: payload.username.trim().toLowerCase(),
    gender: payload.gender,
    captureType: payload.captureType,
    imageData: payload.imageData,
    status: payload.status || 'pending'
  };

  // Only include password_temp if it's defined
  if (payload.password_temp !== undefined) {
    normalizedPayload.password_temp = payload.password_temp;
  }

  console.log('Submitting registration with normalized data:', {
    email: normalizedPayload.email,
    username: normalizedPayload.username,
    status: normalizedPayload.status
  });

  try {
    // First, check if the record already exists
    const { data: existingRecord, error: checkError } = await supabase
      .from('registrations')
      .select('*')
      .eq('email', normalizedPayload.email)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing registration:', checkError);
      throw checkError;
    }

    // If record already exists, return it as success
    if (existingRecord) {
      console.log('Registration already exists for email:', normalizedPayload.email, existingRecord);
      return {
        data: existingRecord,
        alreadyExists: true,
        isNewSubmission: false
      };
    }

    // Use upsert to handle potential race conditions
    const { data, error } = await supabase
      .from('registrations')
      .upsert(normalizedPayload, { 
        onConflict: 'email',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('Upsert error:', error);
      
      // Even with upsert, we might still get a 23505 in rare race conditions
      // Treat this as "already exists" rather than an error
      if (error.code === '23505') {
        console.log('Race condition detected, treating as already exists');
        
        // Try to fetch the existing record
        const { data: raceRecord } = await supabase
          .from('registrations')
          .select('*')
          .eq('email', normalizedPayload.email)
          .single();
        
        return {
          data: raceRecord,
          alreadyExists: true,
          isNewSubmission: false
        };
      }
      
      throw error;
    }

    console.log('Registration submitted successfully:', data);
    
    return {
      data,
      alreadyExists: false,
      isNewSubmission: true
    };

  } catch (err: any) {
    console.error('Registration submission error:', err);
    throw err;
  }
}