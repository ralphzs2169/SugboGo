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
