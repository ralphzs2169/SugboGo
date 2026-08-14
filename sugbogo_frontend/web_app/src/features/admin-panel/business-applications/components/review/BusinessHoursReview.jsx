import { Clock } from "lucide-react";

import ApplicationReviewSection from "./ApplicationReviewSection";
import ApplicationReviewFeedback from "./ApplicationReviewFeedback";
import ApplicationReviewChangeStatus from "./ApplicationReviewChangeStatus";
import {
  formatOperatingHours,
  isOvernightOperatingHours,
} from "../../utils/operatingHours.utils";

const dayLabels = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/**
 * Displays the weekly operating schedule submitted by the merchant.
 *
 * Presents each day with its operating hours and a clear open/closed
 * status indicator for quick administrative review.
 */
export default function BusinessHoursReview({
  operatingHours = [],
  feedback,
  isChangedSinceLastReview = false,
  isResubmission = false,
}) {
  return (
    <ApplicationReviewSection
      icon={Clock}
      title="Operating Hours"
      description="Review the weekly operating schedule submitted by the merchant."
    >
      <ApplicationReviewChangeStatus
        feedback={feedback}
        isChangedSinceLastReview={isChangedSinceLastReview}
        isResubmission={isResubmission}
      />
      <ApplicationReviewFeedback
        feedback={feedback}
        isResubmission={isResubmission}
      />

      {operatingHours.length ? (
        <div className="divide-y divide-stroke rounded-lg border border-stroke">
          {operatingHours.map((schedule) => {
            const isOpen = schedule.is_open;
            const hours = formatOperatingHours(schedule);
            const overnight = isOvernightOperatingHours(schedule);

            return (
              <div
                key={schedule.day}
                className="flex items-center justify-between gap-6 px-4 py-4"
              >
                {/* Day and operating hours */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {dayLabels[schedule.day] ?? schedule.day}
                  </p>

                  <p className="mt-1 text-sm text-text-secondary">{hours}</p>

                  {overnight && (
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Overnight · closes the following day
                    </p>
                  )}
                </div>

                {/* Open/closed status */}
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-medium ${
                    isOpen ? "text-success" : "text-text-secondary"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOpen ? "bg-success" : "bg-stroke-strong"
                    }`}
                  />

                  {isOpen ? "Open" : "Closed"}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-stroke bg-surface-muted p-5">
          <p className="text-sm font-medium text-text-primary">
            No operating hours submitted
          </p>

          <p className="mt-1 text-sm text-text-secondary">
            The applicant did not provide an operating schedule.
          </p>
        </div>
      )}
    </ApplicationReviewSection>
  );
}
