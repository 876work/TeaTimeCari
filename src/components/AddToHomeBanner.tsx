import { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';

const DISMISSED_KEY = 'ttc_home_banner_dismissed';

function isDesktop(): boolean {
  const ua = navigator.userAgent;
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function AddToHomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="banner"
      className="relative z-50 flex items-center justify-between gap-4 bg-gradient-to-r from-[#4B9EC8] to-[#9B6BAE] px-4 py-3 text-white sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Smartphone className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">
            Save Tea Time Cari to your iPhone home screen
          </p>
          <p className="mt-0.5 text-xs text-white/80 leading-snug">
            On your iPhone: open this page in Safari &rarr; tap the&nbsp;
            <span className="inline-block rounded bg-white/20 px-1 font-bold">Share</span>
            &nbsp;button &rarr; choose&nbsp;
            <span className="inline-block rounded bg-white/20 px-1 font-bold">Add to Home Screen</span>
          </p>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="ml-2 shrink-0 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
