import { ArrowLeft } from "lucide-react";

import PageHeader from "@/features/admin-panel/components/PageHeader";
import DataErrorState from "@/shared/components/errors/DataErrorState";

/**
 * Provides a consistent layout for Admin detail pages.
 *
 * Handles shared navigation, loading, and error states. Supports an
 * optional sidebar while keeping breadcrumbs above the back button
 * and page title.
 */
export default function DetailPageLayout({
  breadcrumbs,
  title,
  backLabel,
  onBack,
  isLoading,
  hasData,
  error,
  onRetry,
  loadingContent,
  errorTitle = "Unable to load details",
  errorMessage = "The requested information could not be loaded.",
  headerRef,
  aside,
  children,
}) {
  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
    >
      <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
      <span>{backLabel}</span>
    </button>
  );

  const pageHeader = (
    <div ref={headerRef}>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        backAction={backButton}
      />
    </div>
  );

  if (isLoading) {
    return (
      <>
        {pageHeader}
        {loadingContent}
      </>
    );
  }

  if (error || !hasData) {
    return (
      <>
        {pageHeader}

        {/* Detail loading error */}
        <DataErrorState
          title={errorTitle}
          message={errorMessage}
          onRetry={onRetry}
        />
      </>
    );
  }

  const mainContent = (
    <>
      {/* Breadcrumbs, back navigation, and page title */}
      {pageHeader}

      {/* Detail content */}
      {children}
    </>
  );

  if (aside) {
    return (
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] xl:items-stretch">
        {/* Main review column */}
        <div className="min-w-0 xl:flex xl:flex-col">{mainContent}</div>

        {/* Supporting information sidebar */}
        <aside className="min-w-0 xl:pt-5">{aside}</aside>
      </div>
    );
  }

  return mainContent;
}
