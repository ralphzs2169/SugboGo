import SugboGoLogo from "../../assets/logos/sugbogo-logo.svg";

/**
 * SugboGoText component displays the SugboGo logo and text.
 * @component

 * @param {string} className - Optional additional CSS classes for the container.
  * @param {boolean} includeAdmin - If true, appends "Admin" to the text.
  * @param {boolean} includeLogo - If true, includes the SugboGo logo image.
*/
export default function SugboGoText({
  className = "",
  includeAdmin = false,
  includeLogo = false,
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

      <span className="text-2xl font-extrabold">
        <span className="text-primary">Sugbo</span>
        <span className="text-text-primary">Go</span>
        {includeAdmin && <span> Admin</span>}
      </span>
    </span>
  );
}
