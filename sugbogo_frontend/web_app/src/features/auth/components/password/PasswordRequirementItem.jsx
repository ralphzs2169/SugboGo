import { Check, X } from "lucide-react";

/**
 * Single row in the live password requirements list.
 * Shows a check when `met` is true, an x otherwise.
 */
export default function PasswordRequirementItem({ label, met }) {
  return (
    <li
      className={`flex items-center gap-2 text-xs transition-colors duration-200 sm:text-sm ${
        met ? "text-green-600" : "text-red-500"
      }`}
    >
      {met ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{label}</span>
    </li>
  );
}
