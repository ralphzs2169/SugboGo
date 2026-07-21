import { useNavigate } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <SearchX className="h-12 w-12 text-primary" />
        </div>

        <h1 className="text-6xl font-bold text-gray-900">404</h1>

        <h2 className="mt-4 text-2xl font-semibold text-gray-900">
          Page not found
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-500">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.99]"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Login
        </button>
      </section>
    </main>
  );
}
