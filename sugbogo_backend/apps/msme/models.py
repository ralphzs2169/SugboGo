from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class Cluster(models.Model):
    CLUS_ID = models.AutoField(primary_key=True)
    CLUS_NAME = models.CharField(max_length=100, unique=True)
    CLUS_DESCRIPTION = models.TextField(blank=True, null=True)
    CLUS_CREATED_AT = models.DateTimeField(auto_now_add=True)
    CLUS_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'CLUSTER'

    def __str__(self):
        return self.CLUS_NAME


class Category(models.Model):
    CTGRY_ID = models.AutoField(primary_key=True)
    CTGRY_NAME = models.CharField(max_length=100)
    CTGRY_DESCRIPTION = models.TextField(blank=True, null=True)
    CTGRY_CREATED_AT = models.DateTimeField(auto_now_add=True)
    CTGRY_UPDATED_AT = models.DateTimeField(auto_now=True)

    CLUS_ID = models.ForeignKey(
        Cluster, on_delete=models.PROTECT, db_column='CLUS_ID',
        related_name='categories'
    )

    class Meta:
        db_table = 'CATEGORY'

    def __str__(self):
        return self.CTGRY_NAME


class Location(models.Model):
    # NOTE: LOCT_STATUS choices are an assumption — flag with lead dev
    # if the manuscript specifies something more precise than this.
    class LocationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        VERIFIED = 'verified', 'Verified'
        FLAGGED = 'flagged', 'Flagged'

    LOCT_ID = models.AutoField(primary_key=True)
    LOCT_POINT = gis_models.PointField(srid=4326)
    LOCT_ADDRESS = models.CharField(max_length=255)
    LOCT_CITY = models.CharField(max_length=100, default='Cebu City')
    LOCT_PROVINCE = models.CharField(max_length=100, default='Cebu')
    LOCT_POSTAL_CODE = models.CharField(max_length=10, blank=True, null=True)
    LOCT_STATUS = models.CharField(
        max_length=20, choices=LocationStatus.choices,
        default=LocationStatus.PENDING
    )
    LOCT_CREATED_AT = models.DateTimeField(auto_now_add=True)
    LOCT_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'LOCATION'

    def __str__(self):
        return self.LOCT_ADDRESS


class Msme(models.Model):
    # NOTE: MSME_STATUS choices are an assumption based on UC-07/UC-12
    # (pending review -> admin approves/rejects -> active in feed).
    # Confirm against manuscript/adviser/team before relying on these values elsewhere.
    class MsmeStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        REJECTED = 'rejected', 'Rejected'

    MSME_ID = models.AutoField(primary_key=True)
    MSME_NAME = models.CharField(max_length=150)
    MSME_DESCRIPTION = models.TextField(blank=True, null=True)
    MSME_STATUS = models.CharField(
        max_length=20, choices=MsmeStatus.choices,
        default=MsmeStatus.PENDING
    )
    MSME_IS_VERIFIED = models.BooleanField(default=False)
    MSME_VOUCH_COUNT = models.PositiveIntegerField(default=0)
    MSME_REVIEW_COUNT = models.PositiveIntegerField(default=0)
    MSME_POCKET_COUNT = models.PositiveIntegerField(default=0)
    MSME_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MSME_UPDATED_AT = models.DateTimeField(auto_now=True)

    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column='USER_ID', related_name='owned_msmes'
    )
    CTGRY_ID = models.ForeignKey(
        Category, on_delete=models.PROTECT, db_column='CTGRY_ID',
        related_name='msmes'
    )
    LOC_ID = models.ForeignKey(
        Location, on_delete=models.PROTECT, db_column='LOC_ID',
        related_name='msmes'
    )

    class Meta:
        db_table = 'MSME'

    def __str__(self):
        return self.MSME_NAME


class DiscoveryScore(models.Model):
    DSC_ID = models.AutoField(primary_key=True)
    DSC_S_SCORE = models.DecimalField(max_digits=5, decimal_places=2)
    DSC_V_SCORE = models.DecimalField(max_digits=5, decimal_places=2)
    DSC_D_SCORE = models.DecimalField(max_digits=5, decimal_places=2)
    DSC_IS_CURRENT = models.BooleanField(default=True)
    DSC_COMPUTED_AT = models.DateTimeField()
    DSC_CREATED_AT = models.DateTimeField(auto_now_add=True)
    DSC_UPDATED_AT = models.DateTimeField(auto_now=True)

    MSME_ID = models.ForeignKey(
        Msme, on_delete=models.CASCADE, db_column='MSME_ID',
        related_name='discovery_scores'
    )

    class Meta:
        db_table = 'DISCOVERY_SCORE'
        ordering = ['-DSC_COMPUTED_AT']


class SpecialtyTag(models.Model):
    TAG_ID = models.AutoField(primary_key=True)
    TAG_NAME = models.CharField(max_length=100, unique=True)
    TAG_TIER = models.PositiveSmallIntegerField()  # 1 = Rare/Heritage, 2 = Distinctive, 3 = Common
    TAG_WEIGHT = models.PositiveSmallIntegerField()  # Tier1=3, Tier2=2, Tier3=1, per manuscript
    TAG_IS_PREDEFINED = models.BooleanField(default=True)  # False = user-suggested, pending admin approval
    TAG_CREATED_AT = models.DateTimeField(auto_now_add=True)
    TAG_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SPECIALTY_TAG'

    def __str__(self):
        return self.TAG_NAME


class MsmeSpecialtyTag(models.Model):
    MTAG_ID = models.AutoField(primary_key=True)
    MTAG_CREATED_AT = models.DateTimeField(auto_now_add=True)
    MTAG_UPDATED_AT = models.DateTimeField(auto_now=True)

    MSME_ID = models.ForeignKey(
        Msme, on_delete=models.CASCADE, db_column='MSME_ID',
        related_name='specialty_tags'
    )
    TAG_ID = models.ForeignKey(
        SpecialtyTag, on_delete=models.PROTECT, db_column='TAG_ID',
        related_name='msme_links'
    )

    class Meta:
        db_table = 'MSME_SPECIALTY_TAG'
        unique_together = ('MSME_ID', 'TAG_ID')  # prevents duplicate vouches on the same tag


