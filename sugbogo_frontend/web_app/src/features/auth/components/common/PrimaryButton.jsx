import { LoaderCircle } from "lucide-react";

/**
 * PrimaryButton component renders a customizable button with optional loading state and icon.
 */
export default function PrimaryButton({
  type = "button",
  children,
  icon,
  loading = false,
  disabled = false,
  className = "",
  onClick,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-95 active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4 ${className}`}
    >
      {loading ? (
        <LoaderCircle className="h-5 w-5 animate-spin" />
      ) : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
