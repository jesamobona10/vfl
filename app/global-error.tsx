"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafafa" }}>
        <div
          style={{
            display: "flex",
            minHeight: "60vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#666", fontSize: 14, maxWidth: 420 }}>
            The application failed to start properly. Please refresh the page.
          </p>
          {error.digest && <p style={{ color: "#999", fontSize: 12 }}>{error.digest}</p>}
          <button type="button" onClick={reset} className="btn btn-primary btn-sm">
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
