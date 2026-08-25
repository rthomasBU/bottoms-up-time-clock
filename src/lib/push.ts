import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

/** applicationServerKey needs a Uint8Array, but VAPID public keys are handed
 *  out base64url-encoded (see the output of `npx web-push generate-vapid-keys`). */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Current state of this device's overtime-alert subscription, for the
 *  toggle UI - not tied to which employee is logged in, just this browser. */
export async function getPushState(): Promise<PushState> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? 'subscribed' : 'unsubscribed';
}

/** Requests notification permission (if not already granted), subscribes
 *  this device, and saves the subscription for `employeeId`. Throws with a
 *  user-facing message on failure - callers should catch and display it. */
export async function subscribeToPush(employeeId: string): Promise<void> {
  if (!isSupported()) throw new Error('Push notifications are not supported on this device/browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // TS's DOM lib wants a plain ArrayBuffer-backed BufferSource here; the
    // runtime accepts a Uint8Array fine, this is a lib-typing mismatch only.
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
  });

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').insert({
    employee_id: employeeId,
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh,
    auth_key: json.keys!.auth,
  });
  // Re-subscribing on the same device reuses the same endpoint, which
  // collides with the unique constraint - that's fine, it's already saved.
  if (error && error.code !== '23505') throw new Error(error.message);
}

/** Unsubscribes this device and removes its saved subscription row. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return;
  const endpoint = existing.endpoint;
  await existing.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
