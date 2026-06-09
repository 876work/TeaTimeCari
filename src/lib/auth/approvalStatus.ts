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
const legacyStatusAliases: Partial<Record<string, ApprovalStatus>> = {
  // Legacy rows used `verified` for the same approved community-access state.
  verified: 'approved',
};

export function normalizeApprovalStatus(status?: string | null): ApprovalStatus {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) return 'missing';

  const legacyAlias = legacyStatusAliases[normalized];
  if (legacyAlias) return legacyAlias;

  return knownStatuses.includes(normalized as (typeof knownStatuses)[number])
    ? (normalized as ApprovalStatus)
    : 'not_approved';
}

export function isApprovedStatus(status: ApprovalStatus) {
  return status === 'approved';
}

export function isApprovedRegistrationStatus(status?: string | null) {
  return isApprovedStatus(normalizeApprovalStatus(status));
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
