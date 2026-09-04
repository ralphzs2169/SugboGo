import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, X } from "lucide-react";

import Button from "@/shared/components/Button";

const DECISION_CONFIG = {
  uphold: {
    title: "Uphold Dispute",
    description: "Provide the reason for upholding the merchant's dispute.",
    submitLabel: "Uphold Dispute",
    templates: [
      {
        value: "confirmed_fake",
        label: "Confirmed fake",
        text: "The review was determined to be inauthentic based on the available evidence.",
      },
      {
        value: "no_purchase_record",
        label: "No purchase record",
        text: "No matching purchase or visit record was found, supporting the merchant's dispute claim.",
      },
      {
        value: "evidence_supports_removal",
        label: "Evidence supports removal",
        text: "Evidence submitted by the merchant substantiates the dispute claim.",
      },
      {
        value: "policy_violation",
        label: "Review violates policy",
        text: "The review was evaluated against platform guidelines and was found to violate policy.",
      },
    ],
  },

  dismiss: {
    title: "Dismiss Dispute",
    description: "Provide the reason for dismissing the merchant's dispute.",
    submitLabel: "Dismiss Dispute",
    templates: [
      {
        value: "insufficient_evidence",
        label: "Insufficient evidence",
        text: "The merchant did not provide sufficient evidence to support the dispute claim.",
      },
      {
        value: "no_policy_violation",
        label: "No policy violation",
        text: "The review was evaluated against platform guidelines and does not violate policy.",
      },
      {
        value: "claim_could_not_be_verified",
        label: "Claim could not be verified",
        text: "The merchant's dispute claim could not be sufficiently verified based on the available information.",
      },
    ],
  },
};

/**
 * Provides a focused moderation workflow for resolving a review dispute.
 * The drawer adapts its templates and action wording based on the selected
 * moderation decision and preserves its state during the closing animation.
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
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState("");

  const config = mountedDecision ? DECISION_CONFIG[mountedDecision] : null;

  const isUphold = mountedDecision === "uphold";

  // Handle drawer enter and exit animations.
  useEffect(() => {
    if (isOpen && decision) {
      setMountedDecision(decision);
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
      setMountedDecision(null);
    }, 300);

    return () => clearTimeout(timeout);
  }, [isOpen, decision]);

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

  // Close the drawer with Escape.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmitting]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    setError("");
    setNotes("");
    onClose();
  }

  function handleTemplateClick(template) {
    setNotes((current) =>
      current.trim() ? `${current.trim()}\n${template.text}` : template.text,
    );

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedNotes = notes.trim();

    if (!trimmedNotes) {
      setError("Please provide moderation notes before resolving the dispute.");
      return;
    }

    setError("");

    try {
      await onConfirm(trimmedNotes);
      setNotes("");
      onClose();
    } catch {
      // API error notification is handled by the parent.
    }
  }

  if (!isMounted || !config) {
    return null;
  }

  return createPortal(
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

      {/* Drawer */}
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

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          {/* Scrollable content */}
          <div className="themed-scrollbar flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {/* Quick templates */}
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
                      className="cursor-pointer rounded-full border border-stroke bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Moderation notes */}
              <div>
                <label
                  htmlFor="resolve-dispute-notes"
                  className="text-xs font-semibold text-text-secondary"
                >
                  Moderation Notes <span className="text-red-500">*</span>
                </label>

                <textarea
                  id="resolve-dispute-notes"
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setError("");
                  }}
                  rows={7}
                  disabled={isSubmitting}
                  placeholder="Explain the basis for this decision..."
                  className={`mt-1.5 w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                    error ? "border-red-500" : "border-stroke"
                  }`}
                />

                {error && (
                  <p className="mt-1.5 text-xs text-red-600">{error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex shrink-0 justify-end gap-3 border-t border-stroke px-6 py-5">
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
              variant={isUphold ? "primary" : "secondary"}
              loading={isSubmitting}
              disabled={!notes.trim()}
            >
              {config.submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
