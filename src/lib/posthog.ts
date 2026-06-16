import posthog from 'posthog-js';

const posthogProjectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function initPostHog() {
  if (!posthogProjectToken || typeof window === 'undefined') return;

  posthog.init(posthogProjectToken, {
    api_host: posthogHost,
    capture_pageview: false,
  });
}

export { posthog };
