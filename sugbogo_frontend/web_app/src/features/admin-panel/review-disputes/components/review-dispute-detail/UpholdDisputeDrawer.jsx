import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, X } from "lucide-react";

import Button from "@/shared/components/Button";

const DECISION_TEMPLATES = [
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
    value: "confirmed_fake",
    label: "Confirmed fake",
    text: "No matching purchase or visit record was found, supporting the merchant's claim.",
  },
  {
    value: "evidence_supports_removal",
    label: "Evidence supports removal",
    text: "Evidence submitted by the merchant substantiates the dispute claim.",
  },
];

/**
 * Provides a focused moderation workflow for upholding a review dispute.
 * Administrators can start from a decision template and edit the final
 * moderation notes before submitting the decision.
 */
export default function UpholdDisputeDrawer({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
}) {
  const [notes, setNotes] = useState("");
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState("");

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
      setError("Please provide moderation notes before upholding the dispute.");
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

  if (!isMounted) {
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
        aria-labelledby="uphold-dispute-title"
        className={`relative flex h-full w-full max-w-lg flex-col bg-background shadow-xl transition-transform duration-300 ease-out ${
          isVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-stroke px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle
                className="h-5 w-5 text-primary"
                strokeWidth={1.75}
              />

              <h2
                id="uphold-dispute-title"
                className="text-lg font-semibold text-text-primary"
              >
                Uphold Dispute
              </h2>
            </div>

            <p className="mt-1.5 text-sm text-text-secondary">
              Provide the reason for upholding the merchant's dispute.
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
                  {DECISION_TEMPLATES.map((template) => (
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

              {/* Admin notes */}
              <div>
                <label
                  htmlFor="uphold-dispute-notes"
                  className="text-xs font-semibold text-text-secondary"
                >
                  Moderation Notes <span className="text-red-500">*</span>
                </label>

                <textarea
                  id="uphold-dispute-notes"
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setError("");
                  }}
                  rows={7}
                  disabled={isSubmitting}
                  placeholder="Explain why the dispute is being upheld..."
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

          {/* Footer */}
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
              variant="primary"
              loading={isSubmitting}
              disabled={!notes.trim()}
            >
              Uphold Dispute
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
