import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/shared/components/modals/Modal";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useBusinessStatus from "../hooks/useBusinessStatus";
import useBusinessStatusTransition from "../hooks/useBusinessStatusTransition";
import { refreshBusinessStatusResources } from "../queries/businessStatusQueryEffects";

/** Confirm one server-verified transition and require renewed review after conflicts. */
export default function BusinessStatusDialog({ business, operation, onClose }) {
  const queryClient = useQueryClient();
  const statusQuery = useBusinessStatus(business.id);
  const mutation = useBusinessStatusTransition(business.id, operation);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const submitting = useRef(false);
  const suspending = operation === "suspend";
  const title = suspending ? "Suspend Business" : "Reactivate Business";
  const verified =
    statusQuery.isFetchedAfterMount && !statusQuery.isFetching && !statusQuery.error;
  const snapshot = statusQuery.data;
  const eligible =
    verified &&
    snapshot?.status === (suspending ? "active" : "suspended") &&
    snapshot.transition_id !== undefined &&
    snapshot.transition_id !== null;
  const mismatchedStatus =
    verified && snapshot?.status !== (suspending ? "active" : "suspended");

  useEffect(() => {
    if (mismatchedStatus && !needsReview && !mutation.isPending && !mutation.isSuccess) {
      void refreshBusinessStatusResources(queryClient, business.id);
    }
  }, [
    mismatchedStatus,
    needsReview,
    mutation.isPending,
    mutation.isSuccess,
    queryClient,
    business.id,
  ]);

  useApiErrorNotification(statusQuery.error, {
    toastId: `business-status-${business.id}-error`,
    fallbackMessage: "Unable to verify business status. Please retry.",
  });
  useApiErrorNotification(mutation.error, {
    toastId: `business-transition-${business.id}-error`,
    fallbackMessage: "The business status could not be changed. Please try again.",
  });

  function close() {
    if (!submitting.current) onClose();
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !eligible || needsReview) return;
    const explanation = reason.trim();
    if (suspending && (!explanation || explanation.length > 1000)) {
      setReasonError(
        !explanation
          ? "Provide a reason for suspension."
          : "Use no more than 1,000 characters.",
      );
      return;
    }
    submitting.current = true;
    try {
      const payload = { expected_transition_id: snapshot.transition_id };
      if (suspending) payload.reason = explanation;
      await mutation.mutateAsync(payload);
      toast.success(suspending ? "Business suspended." : "Business reactivated.");
      onClose();
    } catch (error) {
      const response = error.response;
      if (
        response?.status === 409 &&
        response.data?.code === "BUSINESS_STATUS_CONFLICT"
      ) {
        setNeedsReview(true);
        void refreshBusinessStatusResources(queryClient, business.id);
        await statusQuery.refetch();
      }
    } finally {
      submitting.current = false;
    }
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget.querySelector('[role="dialog"]');
    const controls = Array.from(
      dialog.querySelectorAll(
        "button:not(:disabled), textarea:not(:disabled), [tabindex='0']",
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (controls.length === 0) {
      event.preventDefault();
      dialog.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div onKeyDown={trapFocus}>
      <Modal
        isOpen
        title={title}
        onClose={close}
        showCloseButton={!mutation.isPending}
        scrollable
        description={
          suspending
            ? "This business will be removed from public discovery and new interactions will be restricted. Existing records and historical activity will be preserved."
            : "This business will become active again and may reappear in public discovery according to SugboGo's existing eligibility and ranking rules."
        }
      >
        <form onSubmit={submit} className="space-y-5" aria-busy={mutation.isPending}>
          <p className="break-words font-semibold text-text-primary">{business.name}</p>
          {statusQuery.isFetching && (
            <p role="status" className="text-sm text-text-secondary">
              Verifying current business status...
            </p>
          )}
          {statusQuery.error && (
            <DataErrorState
              compact
              title="Unable to verify business status"
              message="Current status is required before making a change."
              onRetry={() => statusQuery.refetch()}
              retryLabel="Retry"
              retrying={statusQuery.isFetching}
            />
          )}
          {verified && (
            <p className="text-sm text-text-secondary">
              Current business status:{" "}
              <span className="capitalize">{snapshot?.status}</span>
            </p>
          )}
          {verified && !eligible && (
            <p role="alert" className="text-sm text-text-secondary">
              This business is no longer eligible for this action. Close this dialog and
              review the refreshed business list.
            </p>
          )}
          {!suspending && verified && snapshot?.owner_account_status !== "active" && (
            <p
              role="note"
              className="rounded-lg border border-stroke bg-surface p-3 text-sm text-text-secondary"
            >
              The merchant's account is currently{" "}
              {snapshot?.owner_account_status || "unavailable"}. Reactivating this
              business will not restore their account access.
            </p>
          )}
          {suspending && (
            <TextArea
              id="business-suspension-reason"
              label="Reason for suspension"
              required
              maxLength={1000}
              value={reason}
              error={reasonError}
              showCharacterCount
              disabled={mutation.isPending}
              beforeInput={
                <p className="mb-2 text-sm text-text-secondary">
                  This explanation will be visible to the merchant.
                </p>
              }
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError("");
              }}
            />
          )}
          {needsReview ? (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-stroke bg-surface p-3 text-sm text-text-primary"
            >
              <p>
                The business status changed since this dialog was opened. Review the
                updated status before confirming again. Your previous request was not
                applied.
              </p>
              {eligible && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    mutation.reset();
                    setNeedsReview(false);
                  }}
                >
                  I have reviewed the updated status
                </Button>
              )}
            </div>
          ) : (
            mutation.error && (
              <p role="alert" className="text-sm text-danger">
                {mutation.error.response?.data?.message ||
                  "Unable to change business status. Please try again."}
              </p>
            )
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={suspending ? "danger" : "success"}
              loading={mutation.isPending}
              disabled={!eligible || needsReview}
            >
              {title}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
