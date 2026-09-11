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


class ClusterDiscoveryShortcut(models.Model):
    CDS_ID = models.AutoField(primary_key=True)

    CLUS_ID = models.OneToOneField(
        Cluster,
        on_delete=models.CASCADE,
        db_column="CLUS_ID",
        related_name="discovery_shortcut",
    )

    CDS_TITLE = models.CharField(
        max_length=100,
    )

    CDS_SUBTITLE = models.CharField(
        max_length=200,
    )

    CDS_IS_ACTIVE = models.BooleanField(
        default=True,
    )

    CDS_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    CDS_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "CLUSTER_DISCOVERY_SHORTCUT"


class SpecialtyTag(models.Model):

    class TagColor(models.TextChoices):
        BLUE = "blue", "Blue"
        GREEN = "green", "Green"
        PURPLE = "purple", "Purple"
        YELLOW = "yellow", "Yellow"
        RED = "red", "Red"
        TEAL = "teal", "Teal"

    class TagIcon(models.TextChoices):
        # Generic
        TAG = "tag", "Tag"
        STAR = "star", "Star"
        HEART = "heart", "Heart"
        SPARKLES = "sparkles", "Sparkles"
        BADGE_CHECK = "badge_check", "Badge Check"
        CIRCLE_CHECK = "circle_check", "Check"
        THUMBS_UP = "thumbs_up", "Thumbs Up"

        # Food & dining
        UTENSILS = "utensils", "Utensils"
        CHEF_HAT = "chef_hat", "Chef Hat"
        COOKING_POT = "cooking_pot", "Cooking Pot"
        COFFEE = "coffee", "Coffee"
        CUP_SODA = "cup_soda", "Drink"
        CAKE_SLICE = "cake_slice", "Cake"
        CUPCAKE = "cupcake", "Cupcake"
        CROISSANT = "croissant", "Croissant"
        COOKIE = "cookie", "Cookie"
        ICE_CREAM_BOWL = "ice_cream_bowl", "Ice Cream"
        PIZZA = "pizza", "Pizza"
        SANDWICH = "sandwich", "Sandwich"
        SOUP = "soup", "Soup"
        SALAD = "salad", "Salad"
        BEEF = "beef", "Beef"
        FISH = "fish", "Fish"
        EGG = "egg", "Egg"
        MILK = "milk", "Milk"
        WHEAT = "wheat", "Wheat"
        APPLE = "apple", "Apple"
        BANANA = "banana", "Banana"
        CHERRY = "cherry", "Cherry"
        CITRUS = "citrus", "Citrus"
        POPCORN = "popcorn", "Popcorn"
        WINE = "wine", "Wine"
        BEER = "beer", "Beer"
        MARTINI = "martini", "Martini"

        # Art & handmade
        PALETTE = "palette", "Palette"
        PAINTBRUSH = "paintbrush", "Paintbrush"
        BRUSH = "brush", "Brush"
        PAINT_BUCKET = "paint_bucket", "Paint Bucket"
        PENCIL = "pencil", "Pencil"
        PEN_TOOL = "pen_tool", "Pen Tool"
        FEATHER = "feather", "Feather"
        SCISSORS = "scissors", "Scissors"

        # Media & photography
        CAMERA = "camera", "Camera"
        IMAGE = "image", "Image"
        FILM = "film", "Film"
        CLAPPERBOARD = "clapperboard", "Clapperboard"

        # Music & entertainment
        MUSIC = "music", "Music"
        GUITAR = "guitar", "Guitar"
        HEADPHONES = "headphones", "Headphones"
        MIC_VOCAL = "mic_vocal", "Microphone"
        RADIO = "radio", "Radio"
        TICKET = "ticket", "Ticket"
        DRAMA = "drama", "Theater"
        GAMEPAD_2 = "gamepad_2", "Gamepad"

        # Books & learning
        BOOK = "book", "Book"
        BOOK_OPEN = "book_open", "Open Book"
        LIBRARY = "library", "Library"
        GRADUATION_CAP = "graduation_cap", "Graduation Cap"
        NEWSPAPER = "newspaper", "Newspaper"

        # Nature
        LEAF = "leaf", "Leaf"
        SPROUT = "sprout", "Sprout"
        TREE = "tree_pine", "Tree"
        TREES = "trees", "Trees"
        TREE_PALM = "tree_palm", "Palm Tree"
        FLOWER = "flower_2", "Flower"
        MOUNTAIN = "mountain", "Mountain"
        WAVES = "waves", "Waves"
        SUN = "sun", "Sun"
        SUNSET = "sunset", "Sunset"

        # Outdoor & adventure
        BIKE = "bike", "Bike"
        FOOTPRINTS = "footprints", "Walking"
        COMPASS = "compass", "Compass"
        BINOCULARS = "binoculars", "Binoculars"
        MAP = "map", "Map"
        MAP_PIN = "map_pin", "Map Pin"
        ROUTE = "route", "Route"
        NAVIGATION = "navigation", "Navigation"

        # Shopping & retail
        SHOPPING_BAG = "shopping_bag", "Shopping Bag"
        SHOPPING_BASKET = "shopping_basket", "Shopping Basket"
        SHOPPING_CART = "shopping_cart", "Shopping Cart"
        STORE = "store", "Store"
        GIFT = "gift", "Gift"
        SHIRT = "shirt", "Shirt"
        GEM = "gem", "Gem"

        # Health, wellness & recreation
        HEART_PULSE = "heart_pulse", "Heart Pulse"
        DUMBBELL = "dumbbell", "Dumbbell"
        TROPHY = "trophy", "Trophy"
        ACTIVITY = "activity", "Activity"

        # Places
        HOUSE = "house", "House"
        BUILDING_2 = "building_2", "Building"
        HOTEL = "hotel", "Hotel"
        BED_DOUBLE = "bed_double", "Bed"
        LANDMARK = "landmark", "Landmark"
        CHURCH = "church", "Church"

        # Transportation
        CAR = "car", "Car"
        BUS = "bus", "Bus"
        PLANE = "plane", "Plane"
        SHIP = "ship", "Ship"
        SAILBOAT = "sailboat", "Sailboat"
        TRAIN_FRONT = "train_front", "Train"
        ANCHOR = "anchor", "Anchor"

        # Animals
        PAW_PRINT = "paw_print", "Paw Print"
        DOG = "dog", "Dog"
        CAT = "cat", "Cat"
        BIRD = "bird", "Bird"

    TAG_ID = models.AutoField(
        primary_key=True,
    )

    TAG_NAME = models.CharField(
        max_length=100,
        unique=True,
    )

    TAG_COLOR = models.CharField(
        max_length=20,
        choices=TagColor.choices,
        default=TagColor.BLUE,
    )

    TAG_ICON = models.CharField(
        max_length=50,
        choices=TagIcon.choices,
        default=TagIcon.TAG,
    )

    TAG_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    TAG_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "SPECIALTY_TAG"

    def __str__(self):
        return self.TAG_NAME
