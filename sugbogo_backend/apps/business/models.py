from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models


class Cluster(models.Model):
    class ClusterIcon(models.TextChoices):
        UTENSILS = "utensils"
        COFFEE = "coffee"
        SHOPPING_BAG = "shopping_bag"
        STORE = "store"
        BED_DOUBLE = "bed_double"
        HOTEL = "hotel"
        LANDMARK = "landmark"
        CHURCH = "church"
        TREE_PALM = "tree_palm"
        WAVES = "waves"
        MOUNTAIN = "mountain"
        TREES = "trees"
        COMPASS = "compass"
        MAP_PINNED = "map_pinned"
        CAMERA = "camera"
        MUSIC = "music"
        TICKET = "ticket"
        DUMBBELL = "dumbbell"
        HEART_PULSE = "heart_pulse"
        SPARKLES = "sparkles"
        PALETTE = "palette"
        BOOK_OPEN = "book_open"
        GRADUATION_CAP = "graduation_cap"
        BRIEFCASE_BUSINESS = "briefcase_business"
        CAR = "car"
        BUS = "bus"
        BIKE = "bike"
        SHIP = "ship"
        PAW_PRINT = "paw_print"
        LEAF = "leaf"

    CLUS_ID = models.AutoField(primary_key=True)
    CLUS_NAME = models.CharField(max_length=100, unique=True)
    CLUS_DESCRIPTION = models.TextField(blank=True, null=True)
    CLUS_ICON = models.CharField(
        max_length=50,
        choices=ClusterIcon.choices,
        default=ClusterIcon.UTENSILS,
    )
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
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'

    BUSN_ID = models.AutoField(primary_key=True)
    BUSN_NAME = models.CharField(max_length=150)
    BUSN_DESCRIPTION = models.TextField(blank=True, null=True)
    BUSN_STATUS = models.CharField(
        max_length=20, choices=BusinessStatus.choices,
        default=BusinessStatus.ACTIVE
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
        constraints = [
            models.UniqueConstraint(
                fields=("BUSN_ID", "BOHR_DAY"),
                name="unique_business_operating_hours_day",
            ),
        ]

    def __str__(self):
        return f"{self.BUSN_ID_id} - {self.BOHR_DAY}"

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