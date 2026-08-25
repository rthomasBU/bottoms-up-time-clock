// send-overtime-alerts
//
// Invoked on a schedule (pg_cron + pg_net, every 15 minutes - see the
// one-off cron.schedule snippet run after this function is deployed).
// Finds every hourly employee who is still clocked in (time_entries.
// clock_out is null) past 8 hours on that punch, and pushes
// "Are you authorized to be working overtime?" to every device they've
// subscribed on. Repeats every 2 hours after the first alert for as long
// as they stay clocked in (tracked via last_overtime_notified_at).
//
// Auth: this endpoint is deployed with JWT verification OFF (it's called
// by pg_cron, not a logged-in user), so it checks its own shared secret
// instead (CRON_SECRET, set as a function secret and embedded in the cron
// job's request header - never committed to the repo).
//
// Uses the service role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY)
// to read/write across all employees - this is the one place in the app
// that's meant to bypass RLS entirely, equivalent to the SECURITY DEFINER
// functions used elsewhere (review_pto_request, run_daily_pto_accrual).

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const OVERTIME_THRESHOLD_HOURS = 8;
const RESEND_INTERVAL_HOURS = 2;
const NOTIFICATION_TITLE = 'Bottoms Up Time Clock';
const NOTIFICATION_BODY = 'Are you authorized to be working overtime?';

interface TimeEntryRow {
  id: string;
  employee_id: string;
  clock_in: string;
  last_overtime_notified_at: string | null;
  profiles: { pay_type: string; full_name: string } | null;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response('Missing VAPID configuration', { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: openEntries, error: entriesError } = await supabase
    .from('time_entries')
    .select('id, employee_id, clock_in, last_overtime_notified_at, profiles!time_entries_employee_id_fkey(pay_type, full_name)')
    .is('clock_out', null);

  if (entriesError) {
    return new Response(`Failed to load open entries: ${entriesError.message}`, { status: 500 });
  }

  const now = Date.now();
  const dueEntries = ((openEntries ?? []) as unknown as TimeEntryRow[]).filter((entry) => {
    if (entry.profiles?.pay_type !== 'hourly') return false;
    const hoursOpen = (now - new Date(entry.clock_in).getTime()) / 1000 / 60 / 60;
    if (hoursOpen < OVERTIME_THRESHOLD_HOURS) return false;
    if (!entry.last_overtime_notified_at) return true;
    const hoursSinceLastNotify = (now - new Date(entry.last_overtime_notified_at).getTime()) / 1000 / 60 / 60;
    return hoursSinceLastNotify >= RESEND_INTERVAL_HOURS;
  });

  let notified = 0;
  let staleSubscriptionsRemoved = 0;

  for (const entry of dueEntries) {
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('employee_id', entry.employee_id);

    if (subsError || !subs || subs.length === 0) continue;

    let anySucceeded = false;
    for (const sub of subs as SubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify({ title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY, tag: 'overtime-alert' }),
        );
        anySucceeded = true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription is gone (browser data cleared, permission revoked,
          // etc.) - stop trying to send to it.
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          staleSubscriptionsRemoved++;
        }
      }
    }

    if (anySucceeded) {
      await supabase
        .from('time_entries')
        .update({ last_overtime_notified_at: new Date().toISOString() })
        .eq('id', entry.id);
      notified++;
    }
  }

  return new Response(
    JSON.stringify({ checked: openEntries?.length ?? 0, due: dueEntries.length, notified, staleSubscriptionsRemoved }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
