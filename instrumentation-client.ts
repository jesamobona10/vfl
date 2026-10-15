import * as Sentry from "@sentry/nextjs";
import { piiSafeDataCollection, scrubEvent } from "@/lib/monitoring";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    dataCollection: piiSafeDataCollection,
    beforeSend: (event) => scrubEvent(event),
  });
}
