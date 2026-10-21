"""Bind final review decisions to the submission an administrator inspected."""

from rest_framework.exceptions import APIException


class StaleApplicationSubmission(APIException):
    """Reject a decision whose submission is missing or no longer current."""

    status_code = 409
    default_code = "stale_application_submission"
    default_detail = "The application submission changed. Refresh the application before deciding."


def validate_review_submission(
    application,
    submission,
    expected_submission_id,
):
    """Allow legacy first-submission clients while failing closed after any resubmission."""
    if submission is None:
        return

    if expected_submission_id is None:
        if application.MAPP_SUBMISSION_COUNT > 1:
            raise StaleApplicationSubmission()
    elif submission.pk != expected_submission_id:
        raise StaleApplicationSubmission()
