type PostHogCommand = [string, ...unknown[]];

type PostHogQueue = PostHogCommand[] & {
  init?: (token: string, config?: Record<string, unknown>) => void;
  capture?: (eventName: string, properties?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    posthog?: PostHogQueue;
  }
}

const POSTHOG_SCRIPT_ID = 'posthog-js';
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

function queuePostHogCommand(command: PostHogCommand) {
  window.posthog = window.posthog || [];
  window.posthog.push(command);
}

export function initPostHog() {
  if (!posthogKey || typeof window === 'undefined') return;

  window.posthog = window.posthog || [];

  if (!window.posthog.init) {
    window.posthog.init = (token, config = {}) => {
      queuePostHogCommand(['init', token, config]);
    };
  }

  if (!window.posthog.capture) {
    window.posthog.capture = (eventName, properties = {}) => {
      queuePostHogCommand(['capture', eventName, properties]);
    };
  }

  window.posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false,
  });

  if (!document.getElementById(POSTHOG_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = POSTHOG_SCRIPT_ID;
    script.async = true;
    script.src = `${posthogHost}/static/array.js`;
    document.head.appendChild(script);
  }
}

export function capturePostHogPageview(path: string) {
  if (!posthogKey || typeof window === 'undefined') return;

  window.posthog?.capture?.('$pageview', {
    $current_url: window.location.href,
    path,
  });
}
