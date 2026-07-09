import SugboGoLogo from '../assets/logos/sugbogo-logo.svg'

export default function SugboGoText({
  className = '',
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

      <span className="text-2xl font-extrabold leading-none">
        <span className="text-primary">Sugbo</span>
        <span className="text-text-primary">Go</span>
        {includeAdmin && <span> Admin</span>}
      </span>
    </span>
  )
}