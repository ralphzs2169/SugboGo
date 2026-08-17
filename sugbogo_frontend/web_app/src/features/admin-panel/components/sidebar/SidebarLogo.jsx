import SugboGoText from "@/shared/components/SugboGoText";

/**
 * Displays the branding for the admin sidebar.
 *
 * When expanded, the full SugboGo logo and the
 * "SUPER ADMIN CONSOLE" subtitle are displayed.
 * When collapsed, or while the expand animation is
 * still in progress, only the logo mark is shown.
 *
 */
export default function SidebarLogo({ isCollapsed, showLabels = true }) {
  const showFullLogo = !isCollapsed && showLabels;

  return (
    <div className="px-6 pt-4">
      {showFullLogo ? (
        <>
          <SugboGoText includeLogo />

          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
            SUPER ADMIN CONSOLE
          </p>
        </>
      ) : (
        <SugboGoText logoOnly />
      )}
    </div>
  );
}
