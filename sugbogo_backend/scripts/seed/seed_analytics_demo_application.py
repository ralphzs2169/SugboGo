
from datetime import time, timedelta

from apps.business.models import Category, Cluster, SpecialtyTag
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
    MerchantApplicationFeedback,
    MerchantApplicationIdentity,
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
    MerchantApplicationOperatingHours,
    MerchantApplicationPhotos,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.utils.application_queue import is_review_sla_compliant
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.utils import timezone

# RUN WITH
# python manage.py shell
# THEN 
# exec(open("scripts/seed/seed_analytics_demo_application.py").read(), {"__name__": "__main__"})

MERCHANT_EMAIL_PREFIX = "analytics-demo-merchant"
ADMIN_EMAIL = "analytics-demo-admin@example.com"


def get_or_create_user(email, first_name, last_name, role):
    user, created = User.objects.get_or_create(
        USER_EMAIL=email,
        defaults={
            "USER_FNAME": first_name,
            "USER_LNAME": last_name,
            "USER_ROLE": role,
            "USER_STATUS": User.UserStatus.ACTIVE,
        },
    )

    if created:
        user.set_password("StrongPassword123!")
        user.save()

    return user


def get_taxonomy():
    cluster = Cluster.objects.first()

    if cluster is None:
        raise RuntimeError(
            "No Cluster exists. Seed registration options first."
        )

    category = Category.objects.filter(
        CLUS_ID=cluster,
    ).first()

    if category is None:
        raise RuntimeError(
            "No Category exists for the selected Cluster."
        )

    specialty_tags = list(
        SpecialtyTag.objects.order_by("TAG_ID")[:3]
    )

    return cluster, category, specialty_tags


def get_weekday(start_date, weekday):
    """
    Return a date within the requested week.

    Monday = 0
    Sunday = 6
    """
    return start_date + timedelta(days=weekday)


def get_review_datetime(review_date, hour=10):
    return timezone.make_aware(
        timezone.datetime.combine(
            review_date,
            time(hour, 0),
        )
    )


def get_submission_datetime(review_date, business_days_before):
    """
    Move backwards by a number of business days from a review date.
    """
    current_date = review_date
    remaining = business_days_before

    while remaining > 0:
        current_date -= timedelta(days=1)

        if current_date.weekday() < 5:
            remaining -= 1

    return timezone.make_aware(
        timezone.datetime.combine(
            current_date,
            time(10, 0),
        )
    )


def create_application(
    *,
    merchant,
    admin,
    cluster,
    category,
    specialty_tags,
    application_number,
    status,
    submission_date,
    first_review_date,
    first_decision,
    first_review_business_days,
    resubmitted=False,
    second_submission_date=None,
    second_review_date=None,
    second_decision=None,
    second_review_business_days=None,
):
    # Remove the previous seeded application for this merchant.
    MerchantApplication.objects.filter(
        USER_ID=merchant,
    ).delete()

    application = MerchantApplication.objects.create(
        USER_ID=merchant,
        MAPP_STATUS=status,
        MAPP_HIGHEST_COMPLETED_STEP=6,
        MAPP_SUBMISSION_COUNT=2 if resubmitted else 1,
    )

    # Identity.
    identity = MerchantApplicationIdentity.objects.create(
        MAPP_ID=application,
        MIDN_BUSINESS_NAME=(
            f"Sugbo Demo Business {application_number:02d}"
        ),
        MIDN_BUSINESS_DESCRIPTION=(
            "A locally owned Cebu business created for administrator "
            "analytics and application review testing."
        ),
        MIDN_CONTACT_NUMBER=f"0917123{application_number:04d}",
        MIDN_BUSINESS_EMAIL=merchant.USER_EMAIL,
        MIDN_WEBSITE="https://example.com",
        MIDN_REPRESENTATIVE_NAME="Maria Santos",
        MIDN_REPRESENTATIVE_ROLE=(
            MerchantApplicationIdentity.RepresentativeRole.OWNER
        ),
        CLUS_ID=cluster,
        CTGRY_ID=category,
    )

    identity.specialty_tags.set(specialty_tags)

    # Location.
    location = MerchantApplicationLocation.objects.create(
        MAPP_ID=application,
        MLOC_PROVINCE="Cebu",
        MLOC_CITY="Cebu City",
        MLOC_BARANGAY="Kamputhaw",
        MLOC_STREET_ADDRESS=(
            f"General Maxilom Avenue, Unit {application_number}"
        ),
        MLOC_UNIT=f"Unit {application_number}",
        MLOC_POINT=Point(
            123.8982 + (application_number * 0.0001),
            10.3157 + (application_number * 0.0001),
            srid=4326,
        ),
    )

    # Landmark.
    MerchantApplicationLandmark.objects.create(
        MLOC_ID=location,
        MLMK_NAME="Cebu Provincial Capitol",
        MLMK_ADDRESS="Osmeña Boulevard, Cebu City",
        MLMK_POINT=Point(
            123.8854,
            10.3095,
            srid=4326,
        ),
        MLMK_SOURCE=MerchantApplicationLandmark.LandmarkSource.CUSTOM,
        MLMK_PLACE_ID=None,
    )

    # Operating hours.
    for day in MerchantApplicationOperatingHours.Day.values:
        MerchantApplicationOperatingHours.objects.create(
            MAPP_ID=application,
            MHRS_DAY=day,
            MHRS_IS_OPEN=True,
            MHRS_IS_24_HOURS=False,
            MHRS_OPEN_TIME=time(9, 0),
            MHRS_CLOSE_TIME=time(18, 0),
        )

    # Photos.
    MerchantApplicationPhotos.objects.create(
        MAPP_ID=application,
        MPHT_CATEGORY=(
            MerchantApplicationPhotos.PhotoCategory.STOREFRONT
        ),
        MPHT_PHOTO_URL=(
            "https://placehold.co/1200x800/png?"
            f"text=Sugbo+Demo+Business+{application_number:02d}"
        ),
        MPHT_PHOTO_PUBLIC_ID=(
            f"analytics-demo/business-{application_number:02d}/storefront"
        ),
        MPHT_FILE_NAME="storefront.jpg",
    )

    MerchantApplicationPhotos.objects.create(
        MAPP_ID=application,
        MPHT_CATEGORY=(
            MerchantApplicationPhotos.PhotoCategory.INTERIOR
        ),
        MPHT_PHOTO_URL=(
            "https://placehold.co/1200x800/png?"
            "text=Business+Interior"
        ),
        MPHT_PHOTO_PUBLIC_ID=(
            f"analytics-demo/business-{application_number:02d}/interior"
        ),
        MPHT_FILE_NAME="interior.jpg",
    )

    # Verification document.
    MerchantApplicationDocument.objects.create(
        MAPP_ID=application,
        MDOC_DOCUMENT_TYPE=(
            MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
        ),
        MDOC_DOCUMENT_URL=(
            "https://example.com/documents/"
            f"analytics-demo-{application_number:02d}.pdf"
        ),
        MDOC_DOCUMENT_PUBLIC_ID=(
            f"analytics-demo/business-{application_number:02d}/registration"
        ),
        MDOC_CLOUDINARY_VERSION=1,
        MDOC_FILE_NAME="business-registration.pdf",
    )

       # First submission.
    first_submitted_at = get_submission_datetime(
        submission_date,
        first_review_business_days,
    )

    first_submission = MerchantApplicationSubmission.objects.create(
        MAPP_ID=application,
        MASUB_SUBMISSION_NUMBER=1,
        MASUB_SUBMITTED_AT=first_submitted_at,
    )

    final_submitted_at = first_submitted_at
    final_reviewed_at = None

    # First review.
    if first_review_date is not None:
        first_reviewed_at = get_review_datetime(
            first_review_date,
        )

        first_sla_compliant = is_review_sla_compliant(
            first_submission,
            first_reviewed_at,
        )

        first_review = MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=first_submission,
            USER_ID=admin,
            MAREV_DECISION=first_decision,
            MAREV_REVIEWED_AT=first_reviewed_at,
            MAREV_SLA_COMPLIANT=first_sla_compliant,
        )

        final_reviewed_at = first_reviewed_at

        # Rejection feedback.
        if first_decision == MerchantApplicationReview.Decision.REJECTED:
            MerchantApplicationFeedback.objects.create(
                MAREV_ID=first_review,
                MAPF_SECTION=(
                    MerchantApplicationFeedback.Section.IDENTITY
                ),
                MAPF_MESSAGE=(
                    "Please provide the legal business name shown on "
                    "the business registration document."
                ),
            )

    # Resubmission.
    if resubmitted:
        if second_submission_date is None:
            raise ValueError(
                "second_submission_date is required for resubmissions."
            )

        if second_review_date is None:
            raise ValueError(
                "second_review_date is required for resubmissions."
            )

        if second_review_business_days is None:
            raise ValueError(
                "second_review_business_days is required for resubmissions."
            )

        second_submitted_at = get_submission_datetime(
            second_submission_date,
            second_review_business_days,
        )

        second_submission = MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=2,
            MASUB_SUBMITTED_AT=second_submitted_at,
        )

        second_reviewed_at = get_review_datetime(
            second_review_date,
        )

        second_sla_compliant = is_review_sla_compliant(
            second_submission,
            second_reviewed_at,
        )

        MerchantApplicationReview.objects.create(
            MAPP_ID=application,
            MASUB_ID=second_submission,
            USER_ID=admin,
            MAREV_DECISION=second_decision,
            MAREV_REVIEWED_AT=second_reviewed_at,
            MAREV_SLA_COMPLIANT=second_sla_compliant,
        )

        final_submitted_at = second_submitted_at
        final_reviewed_at = second_reviewed_at

    application.MAPP_SUBMITTED_AT = final_submitted_at

    if status in (
        MerchantApplication.ApplicationStatus.APPROVED,
        MerchantApplication.ApplicationStatus.REJECTED,
    ):
        application.MAPP_REVIEWED_AT = final_reviewed_at
    else:
        application.MAPP_REVIEWED_AT = None

    application.save(
        update_fields=[
            "MAPP_SUBMITTED_AT",
            "MAPP_REVIEWED_AT",
            "MAPP_UPDATED_AT",
        ]
    )

    return application


def main():
    admin = get_or_create_user(
        ADMIN_EMAIL,
        "Analytics",
        "Reviewer",
        User.UserRole.ADMIN,
    )

    cluster, category, specialty_tags = get_taxonomy()

    today = timezone.localdate()

    # Current week starts Monday.
    current_week_start = today - timedelta(
        days=today.weekday(),
    )

    # Previous week starts seven days before current Monday.
    previous_week_start = current_week_start - timedelta(days=7)

    # Previous week: 10 reviewed applications.
    #
    # 6 approved
    # 4 rejected
    #
    # 5 are within the 5-business-day SLA.
    # 5 are outside the SLA.
    #
    # 2 of these applications are resubmitted in the current week.
    for index in range(1, 11):
        merchant = get_or_create_user(
            f"{MERCHANT_EMAIL_PREFIX}-{index:02d}@example.com",
            "Analytics",
            f"Merchant {index:02d}",
            User.UserRole.MERCHANT,
        )

        review_date = get_weekday(
            previous_week_start,
            index % 5,
        )

        if index <= 6:
            decision = MerchantApplicationReview.Decision.APPROVED
        else:
            decision = MerchantApplicationReview.Decision.REJECTED

        if index <= 5:
            review_business_days = 3
        else:
            review_business_days = 8

        create_application(
            merchant=merchant,
            admin=admin,
            cluster=cluster,
            category=category,
            specialty_tags=specialty_tags,
            application_number=index,
            status=(
                MerchantApplication.ApplicationStatus.APPROVED
                if decision == MerchantApplicationReview.Decision.APPROVED
                else MerchantApplication.ApplicationStatus.REJECTED
            ),
            submission_date=review_date,
            first_review_date=review_date,
            first_decision=decision,
            first_review_business_days=review_business_days,
            resubmitted=index in (9, 10),
            second_submission_date=(
                get_weekday(current_week_start, 0)
                if index in (9, 10)
                else None
            ),
            second_review_date=(
                get_weekday(current_week_start, 2)
                if index in (9, 10)
                else None
            ),
            second_decision=(
                MerchantApplicationReview.Decision.APPROVED
                if index in (9, 10)
                else None
            ),
            second_review_business_days=(
                3 if index in (9, 10) else None
            ),
        )

    # Current week: 10 reviewed applications.
    #
    # 7 approved
    # 3 rejected
    #
    # 7 are within SLA.
    # 3 are outside SLA.
    #
    # This gives both periods 10 reviewed applications, allowing
    # the trend calculations to produce values.
    for offset in range(10):
        application_number = 11 + offset

        merchant = get_or_create_user(
            f"{MERCHANT_EMAIL_PREFIX}-{application_number:02d}@example.com",
            "Analytics",
            f"Merchant {application_number:02d}",
            User.UserRole.MERCHANT,
        )

        review_date = get_weekday(
            current_week_start,
            offset % 5,
        )

        if offset < 7:
            decision = MerchantApplicationReview.Decision.APPROVED
        else:
            decision = MerchantApplicationReview.Decision.REJECTED

        if offset < 7:
            review_business_days = 3
        else:
            review_business_days = 8

        create_application(
            merchant=merchant,
            admin=admin,
            cluster=cluster,
            category=category,
            specialty_tags=specialty_tags,
            application_number=application_number,
            status=(
                MerchantApplication.ApplicationStatus.APPROVED
                if decision == MerchantApplicationReview.Decision.APPROVED
                else MerchantApplication.ApplicationStatus.REJECTED
            ),
            submission_date=review_date,
            first_review_date=review_date,
            first_decision=decision,
            first_review_business_days=review_business_days,
        )

    # Two additional current-week applications remain pending review.
    for application_number in (21, 22):
        merchant = get_or_create_user(
            f"{MERCHANT_EMAIL_PREFIX}-{application_number:02d}@example.com",
            "Analytics",
            f"Merchant {application_number:02d}",
            User.UserRole.MERCHANT,
        )

        submission_date = get_weekday(
            current_week_start,
            min(today.weekday(), 4),
        )

        create_application(
            merchant=merchant,
            admin=admin,
            cluster=cluster,
            category=category,
            specialty_tags=specialty_tags,
            application_number=application_number,
            status=(
                MerchantApplication.ApplicationStatus.SUBMITTED
            ),
            submission_date=submission_date,
            first_review_date=None,
            first_decision=(
                MerchantApplicationReview.Decision.REJECTED
            ),
            first_review_business_days=1,
        )

        # Pending applications should not have a review.
        MerchantApplicationReview.objects.filter(
            MAPP_ID__USER_ID=merchant,
        ).delete()

        MerchantApplicationSubmission.objects.filter(
            MAPP_ID__USER_ID=merchant,
        ).delete()

        pending_application = MerchantApplication.objects.get(
            USER_ID=merchant,
        )

        pending_submitted_at = timezone.make_aware(
            timezone.datetime.combine(
                submission_date,
                time(10, 0),
            )
        )

        MerchantApplicationSubmission.objects.create(
            MAPP_ID=pending_application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=pending_submitted_at,
        )

        pending_application.MAPP_SUBMITTED_AT = pending_submitted_at
        pending_application.MAPP_REVIEWED_AT = None
        pending_application.save(
            update_fields=[
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ]
        )

    # Ten additional current-week applications remain pending review.
    #
    # These applications intentionally vary in queue age so the
    # administrator demo shows different review queue states.
    #
    # Queue age:
    # 23 -> 1 business day
    # 24 -> 2 business days
    # 25 -> 2 business days
    # 26 -> 3 business days
    # 27 -> 3 business days
    # 28 -> 4 business days
    # 29 -> 4 business days
    # 30 -> 5 business days
    # 31 -> 5 business days
    # 32 -> 6 business days
    pending_queue_days = {
        23: 1,
        24: 2,
        25: 2,
        26: 3,
        27: 3,
        28: 4,
        29: 4,
        30: 5,
        31: 5,
        32: 6,
    }

    for application_number, business_days_in_queue in pending_queue_days.items():
        merchant = get_or_create_user(
            f"{MERCHANT_EMAIL_PREFIX}-{application_number:02d}@example.com",
            "Analytics",
            f"Merchant {application_number:02d}",
            User.UserRole.MERCHANT,
        )

        # Calculate the submission time relative to today so the
        # queue age remains correct whenever the seed is rerun.
        pending_submitted_at = get_submission_datetime(
            today,
            business_days_in_queue,
        )

        create_application(
            merchant=merchant,
            admin=admin,
            cluster=cluster,
            category=category,
            specialty_tags=specialty_tags,
            application_number=application_number,
            status=(
                MerchantApplication.ApplicationStatus.SUBMITTED
            ),
            submission_date=pending_submitted_at.date(),
            first_review_date=None,
            first_decision=(
                MerchantApplicationReview.Decision.REJECTED
            ),
            first_review_business_days=1,
        )

        # Pending applications should not have a review or review history.
        MerchantApplicationReview.objects.filter(
            MAPP_ID__USER_ID=merchant,
        ).delete()

        MerchantApplicationSubmission.objects.filter(
            MAPP_ID__USER_ID=merchant,
        ).delete()

        pending_application = MerchantApplication.objects.get(
            USER_ID=merchant,
        )

        MerchantApplicationSubmission.objects.create(
            MAPP_ID=pending_application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=pending_submitted_at,
        )

        pending_application.MAPP_SUBMITTED_AT = pending_submitted_at
        pending_application.MAPP_REVIEWED_AT = None
        pending_application.save(
            update_fields=[
                "MAPP_SUBMITTED_AT",
                "MAPP_REVIEWED_AT",
                "MAPP_UPDATED_AT",
            ],
        )

    print("Applications created: 32")
    print("Current week: 10 reviewed + 12 pending")
    print("Previous week: 10 reviewed")
    print("Current week: 10 reviewed + 2 pending")
    print("Previous week: 6 approved, 4 rejected")
    print("Current week: 7 approved, 3 rejected")
    print("Additional pending queue ages: 1–6 business days")
    print("Resubmitted applications: 2")
    print("All applications contain identity, location, hours, photos, and documents.")


if __name__ == "__main__":
    main()