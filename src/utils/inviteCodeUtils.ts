import { SupabaseClient } from '@supabase/supabase-js';

export interface InviteCodeData {
  id: string;
  code: string;
  usage_limit: number;
  usage_count: number;
  expires_at: string;
}

export async function incrementInviteCodeUsage(
  supabase: SupabaseClient,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, get the current invite code data
    const { data: codeData, error: fetchError } = await supabase
      .from('invite_codes')
      .select('id, usage_count, usage_limit')
      .eq('code', inviteCode)
      .eq('is_active', true)
      .single();

    if (fetchError) {
      if (fetchError.code === '42P01') {
        // Table doesn't exist, return success for demo
        console.warn('Invite codes table not found, skipping usage increment for demo');
        return { success: true };
      }
      throw fetchError;
    }

    if (!codeData) {
      return { success: false, error: 'Invite code not found' };
    }

    // Check if we can still increment (shouldn't happen if validation was done properly)
    if (codeData.usage_count >= codeData.usage_limit) {
      return { success: false, error: 'Invite code usage limit reached' };
    }

    // Increment the usage count
    const { error: updateError } = await supabase
      .from('invite_codes')
      .update({ usage_count: codeData.usage_count + 1 })
      .eq('id', codeData.id);

    if (updateError) {
      throw updateError;
    }

    return { success: true };

  } catch (err: any) {
    console.error('Error incrementing invite code usage:', err);
    return { 
      success: false, 
      error: err.message || 'Failed to update invite code usage' 
    };
  }
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  
  // Generate 3 segments of 4 characters each
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return segments.join('-');
}

export function validateInviteCodeFormat(code: string): { isValid: boolean; error?: string } {
  if (!code || !code.trim()) {
    return { isValid: false, error: 'Invite code is required' };
  }

  const trimmedCode = code.trim();
  
  if (trimmedCode.length < 3) {
    return { isValid: false, error: 'Invite code must be at least 3 characters' };
  }

  if (trimmedCode.length > 50) {
    return { isValid: false, error: 'Invite code is too long' };
  }

  // Allow alphanumeric characters, dashes, and underscores
  if (!/^[A-Z0-9_-]+$/i.test(trimmedCode)) {
    return { isValid: false, error: 'Invite code can only contain letters, numbers, dashes, and underscores' };
  }

  return { isValid: true };
}