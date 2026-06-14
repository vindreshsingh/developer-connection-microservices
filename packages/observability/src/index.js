import * as Sentry from '@sentry/node';

let enabled = false;

// Initialise Sentry for a single service process.
//
// No-op unless SENTRY_DSN is set — local dev/test and CI never talk to Sentry.
// Each microservice is its own process, so every entrypoint (index.js and any
// worker.js) must call this once at startup before captureException() can
// report anything. The `service` name is attached as a tag so errors are
// attributable to the originating service in the Sentry dashboard.
export const initSentry = (service) => {
  if (enabled || !process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    initialScope: { tags: { service } },
  });
  enabled = true;
};

// Report an exception. Safe to call unconditionally — it's a no-op until
// initSentry() has run with a DSN configured.
export const captureException = (err) => {
  if (enabled) Sentry.captureException(err);
};

export const isSentryEnabled = () => enabled;

export { Sentry };
