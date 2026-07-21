import SugboGoText from "@/shared/components/SugboGoText";
import SugboGoLogo from "@/assets/logos/sugbogo-logo.svg?react";
export default function PageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center mb-8">
          <SugboGoLogo className="h-24 w-24 mb-4" />
          <SugboGoText className="text-5xl font-bold" />
        </div>

        <div className="h-2 w-100 overflow-hidden rounded-full bg-stroke">
          <div className="h-full w-1/2 animate-loading rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
