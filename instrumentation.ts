import { isMonitoringEnabled } from "@/lib/monitoring";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: import("next").Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (!isMonitoringEnabled()) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(error, request, context);
};
