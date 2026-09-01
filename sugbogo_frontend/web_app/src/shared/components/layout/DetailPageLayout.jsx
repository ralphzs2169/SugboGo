import { ArrowLeft } from "lucide-react";

import PageHeader from "@/features/admin-panel/components/PageHeader";
import DataErrorState from "@/shared/components/errors/DataErrorState";

/**
 * Provides a consistent layout for admin detail pages.
 *
 * Handles the shared page header, back navigation, loading state,
 * and data error state while leaving data fetching and detail content
 * to the consuming page.
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
  children,
}) {
  const pageHeader = (
    <div ref={headerRef}>
      <PageHeader breadcrumbs={breadcrumbs} title={title} />
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

        {/* Return navigation */}
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={17} strokeWidth={1.8} />
          <span>{backLabel}</span>
        </button>

        {/* Detail loading error */}
        <DataErrorState
          title={errorTitle}
          message={errorMessage}
          onRetry={onRetry}
        />
      </>
    );
  }

  return (
    <>
      {pageHeader}

      {/* Return navigation */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={17} strokeWidth={1.8} />
        <span>{backLabel}</span>
      </button>

      {/* Detail content */}
      {children}
    </>
  );
}
