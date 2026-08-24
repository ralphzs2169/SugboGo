from django.db import models

from .business_core_models import Business


class BusinessPhoto(models.Model):
    """Permanent public-facing photos belonging to a business."""

    class PhotoCategory(models.TextChoices):
        STOREFRONT = "storefront", "Storefront"
        INTERIOR = "interior", "Interior"
        PRODUCTS = "products", "Products"
        ADDITIONAL = "additional", "Additional"

    BPHO_ID = models.AutoField(primary_key=True)
    BPHO_CATEGORY = models.CharField(
        max_length=20,
        choices=PhotoCategory.choices,
    )
    BPHO_PHOTO_URL = models.URLField()
    BPHO_PHOTO_PUBLIC_ID = models.CharField(max_length=255)
    BPHO_FILE_NAME = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    BPHO_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BPHO_UPDATED_AT = models.DateTimeField(auto_now=True)

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="photos",
    )

    class Meta:
        db_table = "BUSINESS_PHOTO"

    def __str__(self):
        return f"{self.BPHO_CATEGORY} photo for business #{self.BUSN_ID_id}"



class BusinessOperatingHours(models.Model):
    """Permanent operating hours belonging to a business."""

    class Day(models.TextChoices):
        MONDAY = "monday", "Monday"
        TUESDAY = "tuesday", "Tuesday"
        WEDNESDAY = "wednesday", "Wednesday"
        THURSDAY = "thursday", "Thursday"
        FRIDAY = "friday", "Friday"
        SATURDAY = "saturday", "Saturday"
        SUNDAY = "sunday", "Sunday"

    BOHR_ID = models.AutoField(primary_key=True)
    BOHR_DAY = models.CharField(
        max_length=10,
        choices=Day.choices,
    )
    BOHR_IS_OPEN = models.BooleanField(default=True)
    BOHR_IS_24_HOURS = models.BooleanField(default=False)
    BOHR_OPEN_TIME = models.TimeField(
        blank=True,
        null=True,
    )
    BOHR_CLOSE_TIME = models.TimeField(
        blank=True,
        null=True,
    )
    BOHR_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BOHR_UPDATED_AT = models.DateTimeField(auto_now=True)

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="operating_hours",
    )

    class Meta:
        db_table = "BUSINESS_OPERATING_HOURS"
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=("BUSN_ID", "BOHR_DAY"),
                name="unique_business_operating_hours_day",
            ),
        ]

    def __str__(self):
        return f"{self.BUSN_ID_id} - {self.BOHR_DAY}"