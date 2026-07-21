import SugboGoLogo from "@/assets/logos/sugbogo-logo.svg";
import SugboGoText from "@/shared/components/SugboGoText";
import LoginIllustration from "./LoginIllustration";

export default function AuthSplitLayout({ children }) {
  return (
    <main className="relative h-screen w-full grid grid-cols-1 lg:grid-cols-[55%_45%] bg-white overflow-hidden">
      {/* Left */}
      <section className="hidden lg:flex h-full flex-col items-center justify-between border-r-2 border-slate-200/60 p-12">
        <LoginIllustration />
      </section>

      {/* Right */}
      <section className="flex h-full flex-col items-center justify-center overflow-y-auto p-6 sm:p-10 lg:p-12">
        <div className="lg:hidden mb-6 flex items-center justify-center gap-3">
          <img src={SugboGoLogo} alt="SugboGo Logo" className="h-8 w-auto" />

          <div className="text-lg font-bold">
            <SugboGoText includeAdmin />
          </div>
        </div>

        <div className="w-full max-w-md lg:max-w-lg">{children}</div>
      </section>
    </main>
  );
}
