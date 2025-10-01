// src/components/SsoAutoFinisher.tsx
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const fnUrl = import.meta.env.VITE_SSO_COMPLETE_URL
  ?? 'https://nxzfrnpsiqpxibhggoct.functions.supabase.co/sso-complete';

function getPending() {
  const n = sessionStorage.getItem('disc_nonce');
  const r = sessionStorage.getItem('disc_return');
  return { n, r };
}

export default function SsoAutoFinisher() {
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (evt, session) => {
      if (!session) return;
      const { n, r } = getPending();
      if (!n) return; // no SSO flow pending
      try {
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nonce: n,
            returnUrl: r || 'https://community.teatimecari.app/session/sso_login',
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.redirectUrl) {
          // one-shot: clear nonce/return so it doesn't loop
          sessionStorage.removeItem('disc_nonce');
          sessionStorage.removeItem('disc_return');
          window.location.href = j.redirectUrl;
        }
      } catch {}
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);
  return null;
}