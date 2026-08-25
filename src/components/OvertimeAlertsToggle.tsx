import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getPushState, subscribeToPush, unsubscribeFromPush, type PushState } from '../lib/push';

/** Opt-in push notification for hourly employees only - alerts this device
 *  if the employee is clocked in past 8 hours (see
 *  supabase/functions/send-overtime-alerts). Per-device, not per-account:
 *  each browser/phone that wants the alert has to enable it separately. */
export function OvertimeAlertsToggle() {
  const { profile } = useAuth();
  const [state, setState] = useState<PushState>('unsubscribed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  async function handleToggle() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      if (state === 'subscribed') {
        await unsubscribeFromPush();
        setState('unsubscribed');
      } else {
        await subscribeToPush(profile.id);
        setState('subscribed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  if (state === 'unsupported') return null;

  return (
    <div className="card overtime-alerts">
      <div className="label">Overtime Alerts</div>
      {state === 'denied' ? (
        <p className="form-hint">
          Notifications are blocked for this site in your browser settings. Allow them to get an alert if you're
          clocked in past 8 hours.
        </p>
      ) : (
        <>
          <p className="form-hint">Get a push notification on this device if you're clocked in past 8 hours in a day.</p>
          <button type="button" className="btn-clear" disabled={busy} onClick={() => void handleToggle()}>
            {busy ? 'Working...' : state === 'subscribed' ? 'Disable on This Device' : 'Enable on This Device'}
          </button>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
