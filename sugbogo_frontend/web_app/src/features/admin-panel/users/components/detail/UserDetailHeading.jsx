/** Matches the dashboard's section titles, contextual icons, and supporting text. */
export default function UserDetailHeading({ icon: Icon, title, description }) {
  return (
    <header className="mb-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
      )}
    </header>
  );
}
