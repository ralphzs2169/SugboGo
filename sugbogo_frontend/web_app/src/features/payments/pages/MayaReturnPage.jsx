import { useLocation } from "react-router-dom";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import { Clock3, CreditCard, ExternalLink, Info, ShieldCheck, Smartphone, X } from "lucide-react";
import SugboGoText from "@/shared/components/SugboGoText";
import { mayaReturnAppUrl } from "../utils/mayaReturn";

/** Returns the merchant to the installed app without interpreting payment results. */
export default function MayaReturnPage() {
  useDocumentTitle("Return to SugboGo");
  const { search } = useLocation();
  const appUrl = mayaReturnAppUrl(search);
  const outcome = new URL(appUrl).searchParams.get("outcome");
  const unfinished = outcome === "failure" || outcome === "cancel";
  const submitted = outcome === "success";
  const StatusIcon = unfinished ? CreditCard : submitted ? Clock3 : Smartphone;
  const heading = unfinished
    ? "Checkout not completed"
    : submitted
      ? "Payment submitted"
      : "Return to SugboGo";
  const description = unfinished
    ? "Return to SugboGo to continue checkout or check your payment and Merchant Plus status."
    : submitted
      ? "Return to SugboGo while we securely check your payment and Merchant Plus access."
      : "Open SugboGo to check your payment and Merchant Plus status.";

  return (
    <main className="flex min-h-svh flex-col items-center bg-white text-slate-950 sm:justify-center sm:px-6 sm:py-10">
      {/* Existing product branding stays outside the handoff card. */}
      <div className="shrink-0 px-6 pt-6 sm:mb-8 sm:p-0">
        <SugboGoText includeLogo className="gap-3 [&_img]:h-12 [&>span>span]:text-3xl [&>span>span:last-child]:text-slate-950 sm:[&_img]:h-14 sm:[&>span>span]:text-4xl" />
      </div>
      <section className="flex w-full flex-1 flex-col justify-center bg-white px-6 py-8 text-center sm:block sm:max-w-2xl sm:flex-none sm:rounded-[2rem] sm:border sm:border-stroke sm:px-10 sm:py-9 sm:shadow-lg sm:shadow-slate-950/10" aria-labelledby="return-heading">
        {/* Return hints guide presentation, never payment confirmation. */}
        <div aria-hidden="true" className={`relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full ${unfinished ? "bg-red-50 text-red-500" : "bg-orange-50 text-primary"}`}>
          <StatusIcon size={48} strokeWidth={1.8} />
          {unfinished && (
            <span className="absolute bottom-0 right-0 rounded-full border-4 border-white bg-red-500 p-1.5 text-white">
              <X size={22} strokeWidth={2.5} />
            </span>
          )}
        </div>
        <h1 id="return-heading" className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{heading}</h1>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
          {description}
        </p>
        <a
          href={appUrl}
          className="mt-7 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-center text-lg font-bold text-white transition duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950 active:brightness-90 motion-reduce:transition-none sm:mt-8 sm:text-xl"
          referrerPolicy="no-referrer"
        >
          <ExternalLink size={23} aria-hidden="true" />
          <span>Open SugboGo</span>
        </a>
        {/* Secondary manual recovery has no competing action. */}
        <aside className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-left sm:items-center sm:px-5">
          <Info size={24} className="mt-0.5 shrink-0 text-slate-500 sm:mt-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold">Having trouble?</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">Open SugboGo manually and check Merchant Plus.</p>
          </div>
        </aside>
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-stroke pt-5 text-sm text-slate-600 sm:text-base">
          <ShieldCheck size={23} className="shrink-0 text-primary" aria-hidden="true" />
          <span>Secure payment verification</span>
        </div>
      </section>
    </main>
  );
}
