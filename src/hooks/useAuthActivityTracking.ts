import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ActivityEvent = 'login' | 'heartbeat';

const ACTIVITY_TRACKING_KEY = 'ttc-auth-activity-tracking';

async function invokeActivity(event: ActivityEvent) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await supabase.functions.invoke('track-auth-activity', {
    body: { event },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

export async function trackAuthLogin() {
  await invokeActivity('login').catch((error) => {
    console.warn('Unable to update login tracking metadata', error);
  });
}

export function useAuthActivityTracking() {
  const lastHeartbeatAt = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.sessionStorage.getItem(ACTIVITY_TRACKING_KEY)) return;
    window.sessionStorage.setItem(ACTIVITY_TRACKING_KEY, 'true');

    const sendHeartbeat = async (force = false) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !force) return;

      const now = Date.now();
      if (!force && now - lastHeartbeatAt.current < 60_000) return;
      lastHeartbeatAt.current = now;

      await invokeActivity('heartbeat').catch((error) => {
        console.warn('Unable to update activity tracking metadata', error);
      });
    };

    const interval = window.setInterval(() => sendHeartbeat(), 60_000);
    const onFocus = () => sendHeartbeat();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat(true);
    };

    void sendHeartbeat(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void sendHeartbeat(true);
      }
    });

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      listener.subscription.unsubscribe();
      window.sessionStorage.removeItem(ACTIVITY_TRACKING_KEY);
    };
  }, []);
}
