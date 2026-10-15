import * as Sentry from "@sentry/nextjs";
import { isMonitoringEnabled, piiSafeDataCollection, scrubEvent } from "@/lib/monitoring";

if (isMonitoringEnabled()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    dataCollection: piiSafeDataCollection,
    beforeSend: (event) => scrubEvent(event),
  });
}
