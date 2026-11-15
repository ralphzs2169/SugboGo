import { useLocation } from "react-router-dom";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import { mayaReturnAppUrl } from "../utils/mayaReturn";

/** Returns the merchant to the installed app without interpreting payment results. */
export default function MayaReturnPage() {
  useDocumentTitle("Return to SugboGo");
  const { search } = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 text-text-primary">
      <section className="w-full max-w-md rounded-2xl border border-stroke bg-background p-6">
        <h1 className="text-2xl font-semibold">Return to SugboGo</h1>
        <p className="mt-4 leading-relaxed">
          Open the installed SugboGo app to check your Merchant Plus status.
          SugboGo will confirm payment and access through its backend.
        </p>
        <a
          href={mayaReturnAppUrl(search)}
          className="mt-6 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4"
          referrerPolicy="no-referrer"
        >
          Open SugboGo
        </a>
        <p className="mt-4 text-sm text-neutral">
          If the app does not open, open SugboGo manually. You can close this page afterward.
        </p>
      </section>
    </main>
  );
}
