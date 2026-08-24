from django.contrib.gis.db import models as gis_models
from django.db import models


class Location(models.Model):
    """Permanent physical location of a business."""

    LOCT_ID = models.AutoField(primary_key=True)
    LOCT_POINT = gis_models.PointField(srid=4326)
    LOCT_ADDRESS = models.CharField(max_length=255)
    LOCT_CITY = models.CharField(max_length=100, default='Cebu City')
    LOCT_PROVINCE = models.CharField(max_length=100, default='Cebu')
    LOCT_POSTAL_CODE = models.CharField(max_length=10, blank=True, null=True)
  
    LOCT_CREATED_AT = models.DateTimeField(auto_now_add=True)
    LOCT_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'LOCATION'

    def __str__(self):
        return self.LOCT_ADDRESS

class BusinessLandmark(models.Model):
    """Permanent nearby landmark belonging to a business location."""

    class LandmarkSource(models.TextChoices):
        GOOGLE = "google", "Google"
        CUSTOM = "custom", "Custom"

    BLMK_ID = models.AutoField(primary_key=True)
    BLMK_NAME = models.CharField(max_length=150)
    BLMK_ADDRESS = models.CharField(max_length=255)
    BLMK_POINT = gis_models.PointField(srid=4326)
    BLMK_SOURCE = models.CharField(
        max_length=10,
        choices=LandmarkSource.choices,
    )
    BLMK_PLACE_ID = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    BLMK_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BLMK_UPDATED_AT = models.DateTimeField(auto_now=True)

    LOCT_ID = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        db_column="LOCT_ID",
        related_name="landmarks",
    )

    class Meta:
        db_table = "BUSINESS_LANDMARK"

    def __str__(self):
        return self.BLMK_NAME


class ServiceableBoundary(models.Model):
    """Stores the geographic region(s) SugboGo currently accepts business
    locations within. Starts as Cebu City only; additional rows can be
    added later if the service area expands (e.g. Mandaue, Lapu-Lapu,
    or eventually the whole province)."""

    SBND_ID = models.AutoField(primary_key=True)
    SBND_NAME = models.CharField(max_length=100)
    SBND_PSGC_CODE = models.CharField(max_length=15, blank=True, null=True)
    SBND_BOUNDARY = gis_models.MultiPolygonField(srid=4326)
    SBND_IS_ACTIVE = models.BooleanField(default=True)
    SBND_CREATED_AT = models.DateTimeField(auto_now_add=True)
    SBND_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SERVICEABLE_BOUNDARY'

    def __str__(self):
        return self.SBND_NAME