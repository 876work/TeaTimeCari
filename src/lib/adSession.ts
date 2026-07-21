const SESSION_KEY = 'ttc-ad-session-id';
const SHOWN_KEY = 'ttc-ad-shown';

export function getAdSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    // Session storage unavailable (private browsing, etc.) — fall back to a
    // per-call id; tracking simply loses session-level de-duplication.
    return crypto.randomUUID();
  }
}

export function getAdDevice(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
}

function getShownIds(placement: string): string[] {
  try {
    const raw = sessionStorage.getItem(`${SHOWN_KEY}:${placement}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function getAdsShownThisSession(placement: string): Set<string> {
  return new Set(getShownIds(placement));
}

export function markAdShown(placement: string, adId: string) {
  try {
    const next = [...new Set([...getShownIds(placement), adId])];
    sessionStorage.setItem(`${SHOWN_KEY}:${placement}`, JSON.stringify(next));
  } catch {
    // Best-effort; the ad may simply repeat if storage is unavailable.
  }
}
