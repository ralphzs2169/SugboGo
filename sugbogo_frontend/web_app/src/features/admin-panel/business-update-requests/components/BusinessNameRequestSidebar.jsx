import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Info,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";

const NAME_REVIEW_CHECKLIST = [
  "Does the requested name appropriately represent the business?",
  "Does the name align with the business's existing information?",
  "Could the name be misleading or confused with another business?",
  "Does the merchant's explanation reasonably support the change?",
];

/**
 * Displays supporting information for a business name change review.
 *
 * Groups request metadata, business and merchant identities, review
 * guidance, and decision history using simple section dividers within
 * the unified review card.
 */
export default function BusinessNameRequestSidebar({ request }) {
  const isPending = request.status === "pending";

  const reviewer = request.reviewer?.name || request.reviewer?.email || "Admin";

  return (
    <div className="min-w-0">
      {/* Request information */}
      <section className="p-5 sm:p-6">
        <div className="flex items-center gap-2 text-text-secondary">
          <Info size={16} aria-hidden="true" />

          <h3 className="text-xs font-bold uppercase tracking-wider">
            Request Information
          </h3>
        </div>

        <dl className="mt-5 space-y-4">
          {/* Request identifier */}
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-sm text-text-secondary">Request</dt>

            <dd className="text-sm font-semibold text-text-primary">
              #{request.id}
            </dd>
          </div>

          {/* Submission date */}
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-sm text-text-secondary">Submitted</dt>

            <dd className="flex min-w-0 items-start gap-2 text-sm font-medium text-text-primary">
              <CalendarDays
                size={15}
                className="mt-0.5 shrink-0 text-text-secondary"
                aria-hidden="true"
              />

              <span>{formatDateTime(request.submitted_at)}</span>
            </dd>
          </div>

          {/* Resolution date */}
          {request.resolved_at && (
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
              <dt className="text-sm text-text-secondary">Resolved</dt>

              <dd className="flex min-w-0 items-start gap-2 text-sm font-medium text-text-primary">
                <CalendarCheck2
                  size={15}
                  className="mt-0.5 shrink-0 text-text-secondary"
                  aria-hidden="true"
                />

                <span>{formatDateTime(request.resolved_at)}</span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Business and merchant identities */}
      <section className="border-t border-stroke p-5 sm:p-6">
        <div className="flex items-center gap-2 text-text-secondary">
          <UsersRound size={16} aria-hidden="true" />

          <h3 className="text-xs font-bold uppercase tracking-wider">
            Business & Merchant
          </h3>
        </div>

        {/* Business identity */}
        <div className="mt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Business
          </p>

          <div className="flex min-w-0 items-center gap-3">
            {/* Business photo placeholder */}
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-text-secondary"
              aria-hidden="true"
            >
              <Store size={22} />
            </div>

            {/* Business information */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {request.current_business_name || "Unnamed business"}
              </p>

              <p className="mt-1 text-xs text-text-secondary">
                Business #{request.business_id}
              </p>
            </div>

            {/* Static business details link preview */}
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-text-secondary">
              View
              <ArrowUpRight size={15} aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* Merchant identity */}
        <div className="mt-5 border-t border-stroke/70 pt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Submitted by
          </p>

          <div className="flex min-w-0 items-center gap-3">
            {/* Merchant avatar placeholder */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary"
              aria-hidden="true"
            >
              <UserRound size={19} />
            </div>

            {/* Merchant information */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {request.merchant?.name || request.merchant?.email || "—"}
              </p>

              {request.merchant?.name && request.merchant?.email && (
                <p
                  className="mt-1 truncate text-xs text-text-secondary"
                  title={request.merchant.email}
                >
                  {request.merchant.email}
                </p>
              )}
            </div>

            {/* Static merchant profile link preview */}
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-text-secondary">
              View
              <ArrowUpRight size={15} aria-hidden="true" />
            </span>
          </div>
        </div>
      </section>

      {/* Informational review checklist */}
      {isPending && (
        <section className="border-t border-stroke p-5 sm:p-6">
          {/* Section heading and guidance */}
          <div className="flex items-start gap-2">
            <ClipboardCheck
              size={16}
              className="shrink-0 text-text-secondary"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Review Checklist
              </h3>

              <p className="mt-2 text-xs leading-5 text-text-secondary">
                Consider the following before making a decision.
              </p>
            </div>
          </div>

          {/* Read-only review considerations */}
          <ul className="mt-5">
            {NAME_REVIEW_CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 border-b border-stroke/70 py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <CircleHelp
                  size={16}
                  className="mt-0.5 shrink-0 text-text-secondary"
                  aria-hidden="true"
                />

                <span className="text-sm font-medium leading-6 text-text-primary">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Historical administrative decision */}
      {!isPending && (
        <section className="border-t border-stroke p-5 sm:p-6">
          <div className="flex items-center gap-2 text-text-secondary">
            <CircleCheck size={16} aria-hidden="true" />

            <h3 className="text-xs font-bold uppercase tracking-wider">
              Review Decision
            </h3>
          </div>

          {/* Approved decision */}
          {request.status === "approved" && (
            <p className="mt-4 text-sm leading-6 text-text-primary">
              Approved by <span className="font-semibold">{reviewer}</span>
              {request.resolved_at
                ? ` on ${formatDateTime(request.resolved_at)}`
                : ""}
              .
            </p>
          )}

          {/* Rejected decision */}
          {request.status === "rejected" && (
            <>
              <p className="mt-4 text-xs font-medium text-text-secondary">
                Administrator's feedback
              </p>

              <div className="mt-2 rounded-lg bg-surface p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                  {request.rejection_reason || "No feedback recorded."}
                </p>
              </div>

              <p className="mt-4 text-xs text-text-secondary">
                Rejected by {reviewer}
                {request.resolved_at
                  ? ` on ${formatDateTime(request.resolved_at)}`
                  : ""}
                .
              </p>
            </>
          )}

          {/* Withdrawn request */}
          {request.status === "withdrawn" && (
            <p className="mt-4 text-sm leading-6 text-text-secondary">
              Withdrawn by the merchant
              {request.resolved_at
                ? ` on ${formatDateTime(request.resolved_at)}`
                : ""}
              . No further review is required.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
