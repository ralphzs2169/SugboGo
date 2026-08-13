from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from apps.business.models import Category, Cluster, SpecialtyTag


class MerchantApplication(models.Model):
    """MAPP — top-level merchant application record."""

    class ApplicationStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        REJECTED = 'rejected', 'Rejected'
        APPROVED = 'approved', 'Approved'

    MAPP_ID = models.AutoField(primary_key=True)
    MAPP_STATUS = models.CharField(
        max_length=20, choices=ApplicationStatus.choices,
        default=ApplicationStatus.DRAFT
    )
    MAPP_HIGHEST_COMPLETED_STEP = models.PositiveIntegerField(default=0)
    MAPP_SUBMITTED_AT = models.DateTimeField(blank=True, null=True)
    MAPP_REVIEWED_AT = models.DateTimeField(blank=True, null=True)
    MAPP_SUBMISSION_COUNT = models.PositiveIntegerField(default=0)
    MAPP_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MAPP_UPDATED_AT = models.DateTimeField(auto_now=True)

    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column='USER_ID', related_name='merchant_applications'
    )

    # Timestamps for when each section of the application was last updated. 
    # These are used to determine if a section has been modified since the last review.
    MAPP_IDENTITY_UPDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    MAPP_LOCATION_UPDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    MAPP_OPERATING_HOURS_UPDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    MAPP_PHOTOS_UPDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )
    MAPP_DOCUMENTS_UPDATED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION'
        constraints = [
            models.UniqueConstraint(
                fields=("USER_ID",),
                name="unique_merchant_application_per_user",
            ),
        ]

    def __str__(self):
        return f"Application #{self.MAPP_ID} ({self.MAPP_STATUS})"

class MerchantApplicationSubmission(models.Model):
    """Historical record of each merchant application submission."""

    MASUB_ID = models.AutoField(primary_key=True)

    MAPP_ID = models.ForeignKey(
        MerchantApplication,
        on_delete=models.CASCADE,
        db_column="MAPP_ID",
        related_name="submissions",
    )

    MASUB_SUBMISSION_NUMBER = models.PositiveIntegerField()

    MASUB_SUBMITTED_AT = models.DateTimeField()

    class Meta:
        db_table = "MERCHANT_APPLICATION_SUBMISSION"
        ordering = ["MASUB_SUBMISSION_NUMBER"]
        constraints = [
            models.UniqueConstraint(
                fields=("MAPP_ID", "MASUB_SUBMISSION_NUMBER"),
                name="unique_application_submission_number",
            ),
        ]

    def __str__(self):
        return (
            f"Application #{self.MAPP_ID_id} "
            f"Submission #{self.MASUB_SUBMISSION_NUMBER}"
        )

class MerchantApplicationReview(models.Model):
    class Decision(models.TextChoices):
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    MAREV_ID = models.AutoField(primary_key=True)

    MAREV_DECISION = models.CharField(
        max_length=20,
        choices=Decision.choices,
    )

    MAREV_REVIEWED_AT = models.DateTimeField()
    MAREV_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MAREV_UPDATED_AT = models.DateTimeField(auto_now=True)

    MAPP_ID = models.ForeignKey(
        MerchantApplication,
        on_delete=models.CASCADE,
        db_column="MAPP_ID",
        related_name="reviews",
    )
    
    MASUB_ID  = models.OneToOneField(
        MerchantApplicationSubmission,
        on_delete=models.CASCADE,
        db_column="MASUB_ID",
        related_name="review",
        null=True,
        blank=True,
    )

    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="USER_ID",
        related_name="merchant_application_reviews",
    )

    class Meta:
        db_table = "MERCHANT_APPLICATION_REVIEW"
        ordering = ["-MAREV_REVIEWED_AT"]


class MerchantApplicationFeedback(models.Model):
    class Section(models.TextChoices):
        IDENTITY = "identity", "Business Identity"
        LOCATION = "location", "Business Location"
        OPERATING_HOURS = "operating_hours", "Operating Hours"
        PHOTOS = "photos", "Business Photos"
        DOCUMENTS = "documents", "Verification Documents"

    MAPF_ID = models.AutoField(primary_key=True)

    MAREV_ID = models.ForeignKey(
        MerchantApplicationReview,
        on_delete=models.CASCADE,
        db_column="MAREV_ID",
        related_name="feedback",
    )

    MAPF_SECTION = models.CharField(
        max_length=30,
        choices=Section.choices,
    )

    MAPF_MESSAGE = models.TextField()

    MAPF_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MAPF_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "MERCHANT_APPLICATION_FEEDBACK"
        ordering = ["MAPF_CREATED_AT"]

    def __str__(self):
        return f"Review #{self.MAREV_ID_id} - {self.MAPF_SECTION}"
   





class MerchantApplicationIdentity(models.Model):
    """MIDN — business identity details for an application."""

    class RepresentativeRole(models.TextChoices):
        OWNER = 'owner', 'Owner'
        MANAGER = 'manager', 'Manager'
        AUTHORIZED_REPRESENTATIVE = 'authorized_representative', 'Authorized Representative'
        OTHER = 'other', 'Other'

    MIDN_ID = models.AutoField(primary_key=True)
    MIDN_BUSINESS_NAME = models.CharField(max_length=150)
    MIDN_BUSINESS_DESCRIPTION = models.TextField(blank=True, null=True)
    MIDN_CONTACT_NUMBER = models.CharField(max_length=20)
    MIDN_BUSINESS_EMAIL = models.EmailField(blank=True, null=True)
    MIDN_WEBSITE = models.URLField(blank=True, null=True)
    MIDN_REPRESENTATIVE_NAME = models.CharField(max_length=150)
    MIDN_REPRESENTATIVE_ROLE = models.CharField(
        max_length=30, choices=RepresentativeRole.choices
    )
    MIDN_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MIDN_UPDATED_AT = models.DateTimeField(auto_now=True)

    MAPP_ID = models.OneToOneField(
        MerchantApplication, on_delete=models.CASCADE,
        db_column='MAPP_ID', related_name='identity'
    )
    CLUS_ID = models.ForeignKey(
        Cluster, on_delete=models.PROTECT, db_column='CLUS_ID',
        related_name='merchant_application_identities'
    )
    CTGRY_ID = models.ForeignKey(
        Category, on_delete=models.PROTECT, db_column='CTGRY_ID',
        related_name='merchant_application_identities'
    )
    specialty_tags = models.ManyToManyField(
        SpecialtyTag, related_name='merchant_application_identities',
        blank=True
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION_IDENTITY'

    def __str__(self):
        return self.MIDN_BUSINESS_NAME


class MerchantApplicationLocation(models.Model):
    """MLOC — business location details for an application."""

    MLOC_ID = models.AutoField(primary_key=True)
    MLOC_PROVINCE = models.CharField(max_length=100)
    MLOC_CITY = models.CharField(max_length=100)
    MLOC_BARANGAY = models.CharField(max_length=100)
    MLOC_STREET_ADDRESS = models.CharField(max_length=255)
    MLOC_UNIT = models.CharField(max_length=100, blank=True, null=True)
    MLOC_POINT = gis_models.PointField(srid=4326)
    MLOC_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MLOC_UPDATED_AT = models.DateTimeField(auto_now=True)

    MAPP_ID = models.OneToOneField(
        MerchantApplication, on_delete=models.CASCADE,
        db_column='MAPP_ID', related_name='location'
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION_LOCATION'

    def __str__(self):
        return self.MLOC_STREET_ADDRESS


class MerchantApplicationLandmark(models.Model):
    """MLMK — nearby landmark(s) tied to an application's location."""

    class LandmarkSource(models.TextChoices):
        GOOGLE = 'google', 'Google'
        CUSTOM = 'custom', 'Custom'

    MLMK_ID = models.AutoField(primary_key=True)
    MLMK_NAME = models.CharField(max_length=150)
    MLMK_ADDRESS = models.CharField(max_length=255)
    MLMK_POINT = gis_models.PointField(srid=4326)
    MLMK_SOURCE = models.CharField(
        max_length=10, choices=LandmarkSource.choices
    )
    MLMK_PLACE_ID = models.CharField(max_length=255, blank=True, null=True)
    MLMK_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MLMK_UPDATED_AT = models.DateTimeField(auto_now=True)

    MLOC_ID = models.ForeignKey(
        MerchantApplicationLocation, on_delete=models.CASCADE,
        db_column='MLOC_ID', related_name='landmarks'
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION_LANDMARK'

    def __str__(self):
        return self.MLMK_NAME


class MerchantApplicationOperatingHours(models.Model):
    """MHRS — per-day operating hours for an application."""

    class Day(models.TextChoices):
        MONDAY = 'monday', 'Monday'
        TUESDAY = 'tuesday', 'Tuesday'
        WEDNESDAY = 'wednesday', 'Wednesday'
        THURSDAY = 'thursday', 'Thursday'
        FRIDAY = 'friday', 'Friday'
        SATURDAY = 'saturday', 'Saturday'
        SUNDAY = 'sunday', 'Sunday'

    MHRS_ID = models.AutoField(primary_key=True)
    MHRS_DAY = models.CharField(max_length=10, choices=Day.choices)
    MHRS_IS_OPEN = models.BooleanField(default=True)
    MHRS_IS_24_HOURS = models.BooleanField(default=False)
    MHRS_OPEN_TIME = models.TimeField(blank=True, null=True)
    MHRS_CLOSE_TIME = models.TimeField(blank=True, null=True)
    MHRS_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MHRS_UPDATED_AT = models.DateTimeField(auto_now=True)

    MAPP_ID = models.ForeignKey(
        MerchantApplication, on_delete=models.CASCADE,
        db_column='MAPP_ID', related_name='operating_hours'
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION_OPERATING_HOURS'
        unique_together = ('MAPP_ID', 'MHRS_DAY')

    def __str__(self):
        return f"{self.MAPP_ID_id} - {self.MHRS_DAY}"


class MerchantApplicationPhotos(models.Model):
    """MPHT — uploaded business photos for an application."""

    class PhotoCategory(models.TextChoices):
        STOREFRONT = 'storefront', 'Storefront'
        INTERIOR = 'interior', 'Interior'
        PRODUCTS = 'products', 'Products'
        ADDITIONAL = 'additional', 'Additional'

    MPHT_ID = models.AutoField(primary_key=True)
    MPHT_CATEGORY = models.CharField(
        max_length=20, choices=PhotoCategory.choices
    )
    MPHT_PHOTO_URL = models.URLField()
    MPHT_PHOTO_PUBLIC_ID = models.CharField(max_length=255)
    MPHT_FILE_NAME = models.CharField(max_length=255, blank=True, null=True)
    MPHT_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MPHT_UPDATED_AT = models.DateTimeField(auto_now=True)

    MAPP_ID = models.ForeignKey(
        MerchantApplication, on_delete=models.CASCADE,
        db_column='MAPP_ID', related_name='photos'
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION_PHOTO'

    def __str__(self):
        return f"{self.MPHT_CATEGORY} photo for application #{self.MAPP_ID_id}"


class MerchantApplicationDocument(models.Model):
    """MDOC — uploaded business documents for an application."""

    class DocumentType(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', 'Business Registration'
        AUTHORIZATION_DOCUMENT = 'authorization_document', 'Authorization Document'
        ADDITIONAL_DOCUMENTS = 'additional_documents', 'Additional Documents'

    MDOC_ID = models.AutoField(primary_key=True)
    MDOC_DOCUMENT_TYPE = models.CharField(
        max_length=30, choices=DocumentType.choices
    )
    MDOC_DOCUMENT_URL = models.URLField()
    MDOC_DOCUMENT_PUBLIC_ID = models.CharField(max_length=255)
    MDOC_CLOUDINARY_VERSION = models.BigIntegerField()
    MDOC_FILE_NAME = models.CharField(max_length=255, blank=True, null=True)
    MDOC_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MDOC_UPDATED_AT = models.DateTimeField(auto_now=True)

    MAPP_ID = models.ForeignKey(
        MerchantApplication, on_delete=models.CASCADE,
        db_column='MAPP_ID', related_name='documents'
    )

    class Meta:
        db_table = 'MERCHANT_APPLICATION_DOCUMENT'

    def __str__(self):
        return f"{self.MDOC_DOCUMENT_TYPE} for application #{self.MAPP_ID_id}"


