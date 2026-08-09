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


class SpecialtyTag(models.Model):

    class TagColor(models.TextChoices):
        BLUE = "blue", "Blue"
        GREEN = "green", "Green"
        PURPLE = "purple", "Purple"
        YELLOW = "yellow", "Yellow"
        RED = "red", "Red"
        Teal = "teal", "Teal"

    TAG_ID = models.AutoField(primary_key=True)
    TAG_NAME = models.CharField(max_length=100, unique=True)
    TAG_COLOR = models.CharField(
        max_length=20,
        choices=TagColor.choices,
        default=TagColor.BLUE,
    )
    TAG_CREATED_AT = models.DateTimeField(auto_now_add=True)
    TAG_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'SPECIALTY_TAG'

    def __str__(self):
        return self.TAG_NAME

class Business(models.Model):
    # NOTE: BUSINESS_STATUS choices are an assumption based on UC-07/UC-12
    # (pending review -> admin approves/rejects -> active in feed).
    # Confirm against manuscript/adviser/team before relying on these values elsewhere.
    class BusinessStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'
        REJECTED = 'rejected', 'Rejected'

    BUSN_ID = models.AutoField(primary_key=True)
    BUSN_NAME = models.CharField(max_length=150)
    BUSN_DESCRIPTION = models.TextField(blank=True, null=True)
    BUSN_STATUS = models.CharField(
        max_length=20, choices=BusinessStatus.choices,
        default=BusinessStatus.PENDING
    )
    BUSN_IS_VERIFIED = models.BooleanField(default=False)
    BUSN_VOUCH_COUNT = models.PositiveIntegerField(default=0)
    BUSN_REVIEW_COUNT = models.PositiveIntegerField(default=0)
    BUSN_POCKET_COUNT = models.PositiveIntegerField(default=0)
    BUSN_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BUSN_UPDATED_AT = models.DateTimeField(auto_now=True)

    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column='USER_ID', related_name='owned_businesses'
    )
    CTGRY_ID = models.ForeignKey(
        Category, on_delete=models.PROTECT, db_column='CTGRY_ID',
        related_name='businesses'
    )
    LOC_ID = models.ForeignKey(
        Location, on_delete=models.PROTECT, db_column='LOC_ID',
        related_name='businesses'
    )
    SPECIALTY_TAGS = models.ManyToManyField(
        SpecialtyTag,
        related_name='businesses',
        through='BusinessSpecialtyTag',
        blank=True,
    )

    class Meta:
        db_table = 'BUSINESS'

    def __str__(self):
        return self.BUSN_NAME



class DiscoveryScore(models.Model):
    DSC_ID = models.AutoField(primary_key=True)
    DSC_S_SCORE = models.DecimalField(max_digits=5, decimal_places=2)
    DSC_V_SCORE = models.DecimalField(max_digits=5, decimal_places=2)
    DSC_D_SCORE = models.DecimalField(max_digits=5, decimal_places=2)
    DSC_IS_CURRENT = models.BooleanField(default=True)
    DSC_COMPUTED_AT = models.DateTimeField()
    DSC_CREATED_AT = models.DateTimeField(auto_now_add=True)
    DSC_UPDATED_AT = models.DateTimeField(auto_now=True)

    BUSN_ID = models.ForeignKey(
        Business, on_delete=models.CASCADE, db_column='BUSN_ID',
        related_name='discovery_scores'
    )

    class Meta:
        db_table = 'DISCOVERY_SCORE'
        ordering = ['-DSC_COMPUTED_AT']



class BusinessSpecialtyTag(models.Model):
    BST_ID = models.AutoField(primary_key=True)
    BST_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BST_UPDATED_AT = models.DateTimeField(auto_now=True)

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column='BUSN_ID',
        related_name='specialty_tag_links'
    )

    TAG_ID = models.ForeignKey(
        SpecialtyTag,
        on_delete=models.PROTECT,
        db_column='TAG_ID',
        related_name='business_links'
    )

    class Meta:
        db_table = 'BUSINESS_SPECIALTY_TAG'
        constraints = [  
            models.UniqueConstraint(
                fields=['BUSN_ID', 'TAG_ID'],
                name='unique_business_specialty_tag',
            ),
        ]