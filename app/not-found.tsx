import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-semibold text-text">Page not found</h1>
      <p className="max-w-md text-sm text-muted">
        The page you are looking for doesn&apos;t exist, was moved, or you don&apos;t have access
        to it.
      </p>
      <Link href="/" className="btn btn-primary btn-sm mt-2">
        Back to home
      </Link>
    </div>
  );
}
