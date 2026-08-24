import { useEffect, useState } from 'react';

const DISMISS_KEY = 'installPromptDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Nudges mobile users to install the PWA. Android exposes a native
 * `beforeinstallprompt` event we can trigger programmatically; iOS Safari has
 * no such API, so it gets a plain "tap Share -> Add to Home Screen" banner.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    if (isIos()) {
      setShowIosBanner(true);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [dismissed]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosBanner(false);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (dismissed || (!deferredPrompt && !showIosBanner)) return null;

  return (
    <div className="install-banner">
      {showIosBanner ? (
        <span>Install this app: tap the Share icon, then "Add to Home Screen".</span>
      ) : (
        <span>Install this app for quicker access.</span>
      )}
      <div className="install-banner-actions">
        {deferredPrompt && (
          <button type="button" className="btn-build" onClick={() => void handleInstallClick()}>
            Install
          </button>
        )}
        <button type="button" className="btn-clear" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
