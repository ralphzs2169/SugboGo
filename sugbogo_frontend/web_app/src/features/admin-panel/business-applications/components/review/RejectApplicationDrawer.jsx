import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import RejectApplicationSection from "./RejectApplicationSection";
import RejectApplicationConfirmationModal from "./RejectApplicationConfirmationModal";

import Button from "@/shared/components/Button";
import rejectionFeedbackSections, {
  MIN_FEEDBACK_LENGTH,
} from "../../config/rejectionFeedback.config";
import useRejectBusinessApplication from "../../hooks/useRejectBusinessApplication";

/**
 * Side panel that provides the administrator with a focused rejection
 * workflow. Runs as a drawer (rather than a centered modal) so the
 * application details stay visible/reachable while reviewing.
 *
 * Administrators select the application sections that require changes,
 * optionally start from a quick-reason template, and can freely edit
 * or write their own feedback for each selected section.
 */
export default function RejectApplicationDrawer({
  isOpen,
  applicationId,
  onClose,
  onSuccess,
  businessName,
}) {
  const [selectedSections, setSelectedSections] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [errors, setErrors] = useState({});
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  const { rejectApplication, isSubmitting } = useRejectBusinessApplication();

  const allSelected =
    selectedSections.length === rejectionFeedbackSections.length;

  const incompleteCount = useMemo(() => {
    return selectedSections.filter(
      (section) =>
        (feedback[section] ?? "").trim().length < MIN_FEEDBACK_LENGTH,
    ).length;
  }, [selectedSections, feedback]);

  // Lock background scroll while the drawer is open
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmitting]);

  // Keep the drawer mounted long enough for the close animation to finish.
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });

      return undefined;
    }

    setIsVisible(false);

    const timeout = setTimeout(() => {
      setIsMounted(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [isOpen]);

  function handleSectionToggle(section) {
    setSelectedSections((previous) => {
      if (previous.includes(section)) {
        return previous.filter((item) => item !== section);
      }

      return [...previous, section];
    });

    setErrors((previous) => ({
      ...previous,
      [section]: undefined,
      general: undefined,
    }));
  }

  function handleSelectAllToggle() {
    if (allSelected) {
      setSelectedSections([]);
    } else {
      setSelectedSections(
        rejectionFeedbackSections.map((section) => section.value),
      );
    }

    setErrors((previous) => ({ ...previous, general: undefined }));
  }

  function handleFeedbackChange(section, message) {
    setFeedback((previous) => ({
      ...previous,
      [section]: message,
    }));

    setErrors((previous) => ({
      ...previous,
      [section]: undefined,
      general: undefined,
    }));
  }

  function handleTemplateClick(section, template) {
    const current = feedback[section] ?? "";

    // If empty, drop the template straight in. If the admin already has
    // text, append on a new line rather than clobbering what they wrote.
    const next = current.trim() ? `${current.trim()}\n${template}` : template;

    handleFeedbackChange(section, next);
  }

  // Returns the validation errors found (also sets them into state).
  // Returning them directly lets callers act on the result immediately
  // instead of reading `errors` state, which won't reflect this update
  // until the next render.
  function validate() {
    const validationErrors = {};

    if (selectedSections.length === 0) {
      validationErrors.general =
        "Select at least one section that requires changes.";
    }

    selectedSections.forEach((section) => {
      const trimmed = feedback[section]?.trim() ?? "";

      if (!trimmed) {
        validationErrors[section] = "Please describe what needs to be changed.";
      } else if (trimmed.length < MIN_FEEDBACK_LENGTH) {
        validationErrors[section] =
          `Please provide at least ${MIN_FEEDBACK_LENGTH} characters so the applicant has enough detail.`;
      }
    });

    setErrors(validationErrors);

    return validationErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      const firstErrorSection = rejectionFeedbackSections.find(
        (section) => validationErrors[section.value],
      )?.value;

      if (firstErrorSection) {
        document
          .getElementById(`feedback-${firstErrorSection}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      return;
    }

    setIsConfirmationOpen(true);
  }

  async function handleConfirmRejection() {
    const rejectionFeedback = selectedSections.map((section) => ({
      section,
      message: feedback[section].trim(),
    }));

    try {
      await rejectApplication(applicationId, rejectionFeedback);

      toast.success("Application rejected successfully.");

      setIsConfirmationOpen(false);
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Failed to reject application:", error);

      toast.error(
        error.response?.data?.message ||
          "The application could not be rejected. Please try again.",
      );
    }
  }

  function handleClose() {
    if (isSubmitting) {
      return;
    }
    setIsConfirmationOpen(false);
    onClose();
  }

  if (!isMounted) {
    return null;
  }
  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
          isVisible
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-drawer-title"
          className={`relative flex h-full w-full max-w-lg flex-col bg-background shadow-xl transition-transform duration-300 ease-out ${
            isVisible ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-stroke px-6 py-5">
            <div>
              <h2
                id="reject-drawer-title"
                className="text-lg font-semibold text-text-primary"
              >
                Reject Application
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Select the sections that need changes and provide specific
                feedback for the applicant.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Close"
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-stroke/50 hover:text-text-primary disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Select all control */}
            <div className="flex shrink-0 items-center justify-between px-6 pt-4">
              <button
                type="button"
                onClick={handleSelectAllToggle}
                className="cursor-pointer text-sm font-medium text-text-primary hover:underline"
              >
                {allSelected ? "Deselect all" : "Select all sections"}
              </button>

              {selectedSections.length > 0 && (
                <span className="text-xs text-text-secondary">
                  {selectedSections.length} section
                  {selectedSections.length === 1 ? "" : "s"} selected
                </span>
              )}
            </div>

            {/* Scrollable rejection fields */}
            <div className="themed-scrollbar mt-4 flex-1 overflow-y-auto px-6">
              <div className="space-y-4 pb-4">
                {rejectionFeedbackSections.map((section) => (
                  <RejectApplicationSection
                    key={section.value}
                    section={section}
                    isSelected={selectedSections.includes(section.value)}
                    fieldError={errors[section.value]}
                    fieldValue={feedback[section.value] ?? ""}
                    minFeedbackLength={MIN_FEEDBACK_LENGTH}
                    onSectionToggle={handleSectionToggle}
                    onFeedbackChange={handleFeedbackChange}
                    onTemplateClick={handleTemplateClick}
                  />
                ))}
              </div>

              {/* General validation message */}
              {errors.general && (
                <p className="mb-4 text-sm text-red-600">{errors.general}</p>
              )}
            </div>

            {/* Fixed footer actions */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-stroke px-6 py-5">
              <span className="text-xs text-text-secondary">
                {selectedSections.length > 0 &&
                  (incompleteCount > 0
                    ? `${incompleteCount} of ${selectedSections.length} sections still need feedback`
                    : "All selected sections have feedback")}
              </span>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={selectedSections.length === 0}
                  disabledTooltip="Select at least one section that requires changes."
                >
                  Review & Reject
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
      ,{/* Rejection confirmation */}
      <RejectApplicationConfirmationModal
        isOpen={isConfirmationOpen}
        selectedSections={selectedSections}
        feedback={feedback}
        sections={rejectionFeedbackSections}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmRejection}
        loading={isSubmitting}
        businessName={businessName}
      />
    </>,
    document.body,
  );
}
