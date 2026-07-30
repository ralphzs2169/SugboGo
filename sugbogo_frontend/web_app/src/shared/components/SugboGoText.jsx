import SugboGoLogo from "../../assets/logos/sugbogo-logo.svg";

/**
 * Displays the SugboGo brand name or acronym, with optional logo and "Admin" suffix.
 *
 * @component
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes applied to the container.
 * @param {boolean} [props.includeLogo=false] - Displays the SugboGo logo.
 * @param {boolean} [props.includeAdmin=false] - Appends "Admin" after the brand name.
 * @param {boolean} [props.acronym=false] - Displays "SG" instead of "SugboGo".
 *
 * @returns {JSX.Element}
 */
export default function SugboGoText({
  className = "",
  includeAdmin = false,
  includeLogo = false,
  logoOnly = false,
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {includeLogo && (
        <img
          src={SugboGoLogo}
          alt="SugboGo Logo"
          className="h-8 w-auto shrink-0"
        />
      )}

      {logoOnly ? (
        <img
          src={SugboGoLogo}
          alt="SugboGo Logo"
          className="h-8 w-auto shrink-0"
        />
      ) : (
        <span>
          <span className="text-lg font-bold text-primary">Sugbo</span>
          <span className="text-lg font-bold text-text-primary">Go</span>
        </span>
      )}

      {includeAdmin && (
        <span className="text-lg font-semibold text-text-primary">Admin</span>
      )}
    </span>
  );
}
