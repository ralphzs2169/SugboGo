import { ArrowDown, ArrowRight } from "lucide-react";

/** Marks the direction from a captured value to its proposed replacement. */
export default function ReviewDirectionIndicator() {
  return (
    <div className="flex items-center justify-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-background shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
        <ArrowDown
          size={18}
          className="text-text-secondary sm:hidden"
          aria-hidden="true"
        />
        <ArrowRight
          size={18}
          className="hidden text-text-secondary sm:block"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
