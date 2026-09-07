import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, X } from "lucide-react";

import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";

import REVIEW_DISPUTE_DECISION_CONFIG, {
  MIN_MODERATION_NOTES_LENGTH,
} from "../../config/reviewDisputeDecisionConfig";
import ResolveDisputeConfirmationModal from "./ResolveDisputeConfirmationModal";

/**
 * Provides a focused moderation workflow for resolving a review dispute.
 * Administrators can start from quick templates, provide moderation notes,
 * validate the decision, and review it before final submission.
 */
export default function ResolveDisputeDrawer({
  decision,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
}) {
  const [mountedDecision, setMountedDecision] = useState(decision);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const submissionLockRef = useRef(false);

  const config = mountedDecision
    ? REVIEW_DISPUTE_DECISION_CONFIG[mountedDecision]
    : null;

  const isUphold = mountedDecision === "uphold";

  // Lock background scrolling while the drawer is open.
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

  // Close the active moderation layer with Escape.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape" || isSubmitting) {
        return;
      }

      if (isConfirmationOpen) {
        setIsConfirmationOpen(false);
        return;
      }

      handleClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmitting, isConfirmationOpen]);

  // Keep the drawer mounted long enough for the close animation to finish.
  useEffect(() => {
    if (isOpen && decision) {
      let visibilityFrame;

      const mountFrame = requestAnimationFrame(() => {
        setMountedDecision(decision);
        setIsMounted(true);

        visibilityFrame = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });

      return () => {
        cancelAnimationFrame(mountFrame);
        cancelAnimationFrame(visibilityFrame);
      };
    }

    const hideFrame = requestAnimationFrame(() => {
      setIsVisible(false);
    });

    const timeout = setTimeout(() => {
      setIsMounted(false);
      setMountedDecision(null);
    }, 300);

    return () => {
      cancelAnimationFrame(hideFrame);
      clearTimeout(timeout);
    };
  }, [isOpen, decision]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    setIsConfirmationOpen(false);
    setNotes("");
    setErrors({});
    onClose();
  }

  function handleNotesChange(event) {
    setNotes(event.target.value);

    setErrors((previous) => ({
      ...previous,
      notes: undefined,
    }));
  }

  function handleTemplateClick(template) {
    const nextNotes = notes.trim()
      ? `${notes.trim()}\n${template.text}`
      : template.text;

    setNotes(nextNotes);

    setErrors((previous) => ({
      ...previous,
      notes: undefined,
    }));
  }

  function validate() {
    const validationErrors = {};
    const trimmedNotes = notes.trim();

    if (!trimmedNotes) {
      validationErrors.notes =
        "Please provide moderation notes before resolving the dispute.";
    } else if (trimmedNotes.length < MIN_MODERATION_NOTES_LENGTH) {
      validationErrors.notes =
        `Please provide at least ${MIN_MODERATION_NOTES_LENGTH} characters ` +
        "so the decision has enough context.";
    }

    setErrors(validationErrors);

    return validationErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      document.getElementById("resolve-dispute-notes")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      return;
    }

    setIsConfirmationOpen(true);
  }

  async function handleConfirmResolution() {
    if (isSubmitting || submissionLockRef.current) {
      return;
    }

    submissionLockRef.current = true;

    try {
      await onConfirm(notes.trim());

      setIsConfirmationOpen(false);
      setNotes("");
      setErrors({});
      onClose();
    } catch {
      // API error notification is handled by the parent.
    } finally {
      submissionLockRef.current = false;
    }
  }

  function handleCloseConfirmation() {
    if (isSubmitting) {
      return;
    }

    setIsConfirmationOpen(false);
  }

  if (!isMounted || !config) {
    return null;
  }

  return createPortal(
    <>
      {/* Resolution drawer */}
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

        {/* Drawer panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-dispute-title"
          className={`relative flex h-full w-full max-w-lg flex-col bg-background shadow-xl transition-transform duration-300 ease-out ${
            isVisible ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-stroke px-6 py-5">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle
                  className={`h-5 w-5 ${
                    isUphold ? "text-primary" : "text-text-secondary"
                  }`}
                  strokeWidth={1.75}
                />

                <h2
                  id="resolve-dispute-title"
                  className="text-lg font-semibold text-text-primary"
                >
                  {config.title}
                </h2>
              </div>

              <p className="mt-1.5 text-sm text-text-secondary">
                {config.description}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1.5 text-text-secondary transition-colors hover:bg-stroke/50 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Moderation form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Scrollable decision fields */}
            <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                {/* Quick-reason templates */}
                <div>
                  <p className="text-xs font-semibold text-text-secondary">
                    Quick Templates
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {config.templates.map((template) => (
                      <button
                        key={template.value}
                        type="button"
                        onClick={() => handleTemplateClick(template)}
                        disabled={isSubmitting}
                        className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm ring-1 ring-inset ring-stroke transition-all hover:bg-surface-hover hover:text-text-primary hover:ring-stroke-strong disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Moderation notes */}
                <TextArea
                  id="resolve-dispute-notes"
                  name="moderationNotes"
                  label="Moderation Notes"
                  placeholder="Explain the basis for this decision, or pick a quick reason above..."
                  value={notes}
                  onChange={handleNotesChange}
                  error={errors.notes}
                  rows={7}
                  minLength={MIN_MODERATION_NOTES_LENGTH}
                  showCharacterCount
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Fixed footer actions */}
            <div className="flex shrink-0 justify-end gap-3 border-t border-stroke px-6 py-5">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button type="submit" variant="primary" loading={isSubmitting}>
                {config.reviewLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Resolution confirmation */}
      <ResolveDisputeConfirmationModal
        isOpen={isConfirmationOpen}
        decision={mountedDecision}
        notes={notes.trim()}
        onClose={handleCloseConfirmation}
        onConfirm={handleConfirmResolution}
        loading={isSubmitting}
      />
    </>,
    document.body,
  );
}
