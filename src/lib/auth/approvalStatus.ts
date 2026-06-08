import { supabase } from '@/lib/supabaseClient';

export type ApprovalStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'banned'
  | 'missing'
  | 'not_approved';

const knownStatuses = ['approved', 'pending', 'rejected', 'suspended', 'banned'] as const;

export function normalizeApprovalStatus(status?: string | null): ApprovalStatus {
  if (!status) return 'missing';
  return knownStatuses.includes(status as (typeof knownStatuses)[number])
    ? (status as ApprovalStatus)
    : 'not_approved';
}

export function isApprovedStatus(status: ApprovalStatus) {
  return status === 'approved';
}

export function isBlockedStatus(status: ApprovalStatus) {
  return status === 'suspended' || status === 'banned';
}

export async function getApprovalStatus(userId: string): Promise<ApprovalStatus> {
  const { data, error } = await supabase
    .from('registrations')
    .select('status')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return normalizeApprovalStatus(data?.status);
}

export function safeAppPath(input: string | null | undefined, fallback = '/community') {
  if (!input) return fallback;

  try {
    const url = new URL(input, window.location.origin);

    if (url.origin !== window.location.origin) {
      return fallback;
    }

    const path = `${url.pathname}${url.search}${url.hash}`;

    if (!path.startsWith('/') || path.startsWith('//')) {
      return fallback;
    }

    return path;
  } catch {
    return fallback;
  }
}
