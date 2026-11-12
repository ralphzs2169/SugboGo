import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";

import SugboGoLogo from "@/assets/logos/sugbogo-logo.svg";
import ScrollToTop from "@/shared/components/ScrollToTop";
import SugboGoText from "@/shared/components/SugboGoText";
import ThemeToggle from "@/shared/components/ThemeToggle";

const legalLinks = [
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/terms-of-service", label: "Terms of Service" },
  { to: "/data-deletion", label: "Data Deletion" },
];

function LegalNavigation({ label }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
        {legalLinks.map(({ to, label: linkLabel }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline-offset-8 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2"
            >
              {linkLabel}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function PublicLegalLayout() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef(null);

  useEffect(() => {
    if (navigationType !== "POP") {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pathname, navigationType]);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-primary">
      <ScrollToTop />
      <a
        href="#legal-content"
        className="sr-only z-10 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:outline-2"
      >
        Skip to content
      </a>

      <header className="border-b border-stroke bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 px-5 pt-3 pb-1 sm:px-8 sm:py-3">
          <div className="flex min-h-11 items-center gap-2">
            <img src={SugboGoLogo} alt="" className="h-8 w-auto" />
            <SugboGoText />
          </div>
          <div className="order-last w-full sm:order-0 sm:ml-auto sm:w-auto">
            <LegalNavigation label="Legal pages" />
          </div>
          <div className="grid min-h-11 min-w-11 place-items-center [&>button]:min-h-11 [&>button]:min-w-11">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="legal-content"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl grow px-5 py-8 focus:outline-none sm:px-8 sm:py-12"
      >
        <Outlet />
      </main>

      <footer className="border-t border-stroke bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 px-5 py-3 sm:px-8 sm:py-4">
          <SugboGoText />
          <LegalNavigation label="Footer legal pages" />
        </div>
      </footer>
    </div>
  );
}
