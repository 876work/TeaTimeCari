import type { SupabaseClient } from '@supabase/supabase-js';
import { debugError } from '@/lib/debugLogger';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Web Push requires the VAPID key as a Uint8Array, but browsers hand it out
// (and expect it back) as a URL-safe base64 string.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.getRegistration('/sw.js').then(
    (existing) => existing ?? navigator.serviceWorker.register('/sw.js'),
  );
}

async function saveSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  const json = subscription.toJSON();
  const keys = json.keys;

  if (!json.endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('Push subscription is missing required keys.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' },
  );

  if (error) throw error;
}

export async function subscribeToPushNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: 'Push notifications are not supported on this device.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was not granted.' };
    }

    const registration = await getServiceWorkerRegistration();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
      });
    }

    await saveSubscription(supabase, userId, subscription);

    return { success: true };
  } catch (err) {
    debugError('Failed to subscribe to push notifications:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Subscription failed.' };
  }
}

export async function unsubscribeFromPushNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
        return { success: true };
      }
    }

    return { success: true };
  } catch (err) {
    debugError('Failed to unsubscribe from push notifications:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unsubscribe failed.' };
  }
}

export async function getPushSubscriptionState(): Promise<'subscribed' | 'unsubscribed' | 'unsupported'> {
  if (!isPushNotificationSupported()) return 'unsupported';

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
  } catch (err) {
    debugError('Failed to read push subscription state:', err);
    return 'unsubscribed';
  }
}
