// src/lib/discourseSso.ts
const fnUrl = import.meta.env.VITE_SSO_COMPLETE_URL
  ?? 'https://vdfzpdjplyhaotzkbyja.functions.supabase.co/sso-complete';

export function hasPendingSso() {
  return !!sessionStorage.getItem('disc_nonce');
}

export async function finishDiscourseSso(accessToken: string) {
  const nonce = sessionStorage.getItem('disc_nonce');
  const returnUrl =
    sessionStorage.getItem('disc_return') ||
    'https://community.teatimecari.app/session/sso_login';

  if (!nonce || !accessToken) {
    throw new Error('sso_session_expired');
  }

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ nonce, returnUrl }),
  });
  const j = await res.json().catch(() => ({}));

  if (res.ok && j?.redirectUrl) {
    sessionStorage.removeItem('disc_nonce');
    sessionStorage.removeItem('disc_return');
    window.location.href = j.redirectUrl;
    return;
  }

  sessionStorage.removeItem('disc_nonce');
  sessionStorage.removeItem('disc_return');
  throw new Error('sso_session_expired');
}
