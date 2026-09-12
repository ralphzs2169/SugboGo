import {
  Activity,
  Anchor,
  Apple,
  BadgeCheck,
  Banana,
  Beef,
  Beer,
  BedDouble,
  Bike,
  Binoculars,
  Bird,
  Book,
  BookOpen,
  Brush,
  Building2,
  Bus,
  CakeSlice,
  Camera,
  Car,
  Cat,
  ChefHat,
  Cherry,
  Church,
  CircleCheck,
  Citrus,
  Clapperboard,
  Coffee,
  Compass,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Dog,
  Drama,
  Dumbbell,
  Egg,
  Feather,
  Film,
  Fish,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  Guitar,
  Headphones,
  Heart,
  HeartPulse,
  Hotel,
  House,
  IceCreamBowl,
  Image,
  Landmark,
  Leaf,
  Library,
  Map,
  MapPin,
  Martini,
  MicVocal,
  Milk,
  Mountain,
  Music,
  Navigation,
  Newspaper,
  Paintbrush,
  PaintBucket,
  Palette,
  PawPrint,
  PenTool,
  Pencil,
  Pizza,
  Plane,
  Popcorn,
  Radio,
  Route,
  Sailboat,
  Salad,
  Sandwich,
  Scissors,
  Ship,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Soup,
  Sparkles,
  Sprout,
  Star,
  Store,
  Sun,
  Sunset,
  Tag,
  ThumbsUp,
  Ticket,
  TrainFront,
  TreePalm,
  TreePine,
  Trees,
  Trophy,
  Utensils,
  Waves,
  Wheat,
  Wine,
} from "lucide-react";

function createIconGroup(category, keywords, icons) {
  return icons.map((icon) => ({
    ...icon,
    category,
    keywords,
  }));
}

/**
 * Available Lucide icons for specialty tags.
 *
 * Values match the backend SpecialtyTag.TagIcon choices. Search metadata
 * allows admins to find icons through broader concepts such as food,
 * transportation, shopping, nature, or entertainment.
 */
export const SPECIALTY_TAG_ICONS = [
  ...createIconGroup(
    "General",
    ["general", "generic", "common", "status", "favorite"],
    [
      { value: "tag", label: "Tag", icon: Tag },
      { value: "star", label: "Star", icon: Star },
      { value: "heart", label: "Heart", icon: Heart },
      { value: "sparkles", label: "Sparkles", icon: Sparkles },
      { value: "badge_check", label: "Badge Check", icon: BadgeCheck },
      { value: "circle_check", label: "Check", icon: CircleCheck },
      { value: "thumbs_up", label: "Thumbs Up", icon: ThumbsUp },
    ],
  ),

  ...createIconGroup(
    "Food & Dining",
    [
      "food",
      "dining",
      "restaurant",
      "cafe",
      "coffee",
      "drink",
      "beverage",
      "dessert",
      "bakery",
      "pastry",
      "meal",
    ],
    [
      { value: "utensils", label: "Utensils", icon: Utensils },
      { value: "chef_hat", label: "Chef Hat", icon: ChefHat },
      { value: "cooking_pot", label: "Cooking Pot", icon: CookingPot },
      { value: "coffee", label: "Coffee", icon: Coffee },
      { value: "cup_soda", label: "Drink", icon: CupSoda },
      { value: "cake_slice", label: "Cake", icon: CakeSlice },
      { value: "cupcake", label: "Cupcake", icon: CakeSlice },
      { value: "croissant", label: "Croissant", icon: Croissant },
      { value: "cookie", label: "Cookie", icon: Cookie },
      {
        value: "ice_cream_bowl",
        label: "Ice Cream",
        icon: IceCreamBowl,
      },
      { value: "pizza", label: "Pizza", icon: Pizza },
      { value: "sandwich", label: "Sandwich", icon: Sandwich },
      { value: "soup", label: "Soup", icon: Soup },
      { value: "salad", label: "Salad", icon: Salad },
      { value: "beef", label: "Beef", icon: Beef },
      { value: "fish", label: "Fish", icon: Fish },
      { value: "egg", label: "Egg", icon: Egg },
      { value: "milk", label: "Milk", icon: Milk },
      { value: "wheat", label: "Wheat", icon: Wheat },
      { value: "apple", label: "Apple", icon: Apple },
      { value: "banana", label: "Banana", icon: Banana },
      { value: "cherry", label: "Cherry", icon: Cherry },
      { value: "citrus", label: "Citrus", icon: Citrus },
      { value: "popcorn", label: "Popcorn", icon: Popcorn },
      { value: "wine", label: "Wine", icon: Wine },
      { value: "beer", label: "Beer", icon: Beer },
      { value: "martini", label: "Martini", icon: Martini },
    ],
  ),

  ...createIconGroup(
    "Arts & Crafts",
    ["art", "arts", "craft", "crafts", "creative", "handmade", "design"],
    [
      { value: "palette", label: "Palette", icon: Palette },
      { value: "paintbrush", label: "Paintbrush", icon: Paintbrush },
      { value: "brush", label: "Brush", icon: Brush },
      { value: "paint_bucket", label: "Paint Bucket", icon: PaintBucket },
      { value: "pencil", label: "Pencil", icon: Pencil },
      { value: "pen_tool", label: "Pen Tool", icon: PenTool },
      { value: "feather", label: "Feather", icon: Feather },
      { value: "scissors", label: "Scissors", icon: Scissors },
    ],
  ),

  ...createIconGroup(
    "Photography & Media",
    ["photo", "photography", "media", "video", "film", "content"],
    [
      { value: "camera", label: "Camera", icon: Camera },
      { value: "image", label: "Image", icon: Image },
      { value: "film", label: "Film", icon: Film },
      {
        value: "clapperboard",
        label: "Clapperboard",
        icon: Clapperboard,
      },
    ],
  ),

  ...createIconGroup(
    "Entertainment",
    [
      "entertainment",
      "music",
      "nightlife",
      "performance",
      "theater",
      "gaming",
      "games",
    ],
    [
      { value: "music", label: "Music", icon: Music },
      { value: "guitar", label: "Guitar", icon: Guitar },
      { value: "headphones", label: "Headphones", icon: Headphones },
      { value: "mic_vocal", label: "Microphone", icon: MicVocal },
      { value: "radio", label: "Radio", icon: Radio },
      { value: "ticket", label: "Ticket", icon: Ticket },
      { value: "drama", label: "Theater", icon: Drama },
      { value: "gamepad_2", label: "Gamepad", icon: Gamepad2 },
    ],
  ),

  ...createIconGroup(
    "Education",
    ["education", "learning", "school", "study", "books", "academic"],
    [
      { value: "book", label: "Book", icon: Book },
      { value: "book_open", label: "Open Book", icon: BookOpen },
      { value: "library", label: "Library", icon: Library },
      {
        value: "graduation_cap",
        label: "Graduation Cap",
        icon: GraduationCap,
      },
      { value: "newspaper", label: "Newspaper", icon: Newspaper },
    ],
  ),

  ...createIconGroup(
    "Nature",
    [
      "nature",
      "eco",
      "environment",
      "outdoor",
      "plants",
      "beach",
      "mountain",
      "garden",
    ],
    [
      { value: "leaf", label: "Leaf", icon: Leaf },
      { value: "sprout", label: "Sprout", icon: Sprout },
      { value: "tree_pine", label: "Tree", icon: TreePine },
      { value: "trees", label: "Trees", icon: Trees },
      { value: "tree_palm", label: "Palm Tree", icon: TreePalm },
      { value: "flower_2", label: "Flower", icon: Flower2 },
      { value: "mountain", label: "Mountain", icon: Mountain },
      { value: "waves", label: "Waves", icon: Waves },
      { value: "sun", label: "Sun", icon: Sun },
      { value: "sunset", label: "Sunset", icon: Sunset },
    ],
  ),

  ...createIconGroup(
    "Adventure & Discovery",
    [
      "adventure",
      "travel",
      "tourism",
      "tour",
      "discovery",
      "explore",
      "exploration",
      "hiking",
      "navigation",
    ],
    [
      { value: "bike", label: "Bike", icon: Bike },
      { value: "footprints", label: "Walking", icon: Footprints },
      { value: "compass", label: "Compass", icon: Compass },
      { value: "binoculars", label: "Binoculars", icon: Binoculars },
      { value: "map", label: "Map", icon: Map },
      { value: "map_pin", label: "Map Pin", icon: MapPin },
      { value: "route", label: "Route", icon: Route },
      { value: "navigation", label: "Navigation", icon: Navigation },
    ],
  ),

  ...createIconGroup(
    "Shopping & Retail",
    [
      "shopping",
      "retail",
      "store",
      "market",
      "products",
      "merchandise",
      "souvenir",
    ],
    [
      {
        value: "shopping_bag",
        label: "Shopping Bag",
        icon: ShoppingBag,
      },
      {
        value: "shopping_basket",
        label: "Shopping Basket",
        icon: ShoppingBasket,
      },
      {
        value: "shopping_cart",
        label: "Shopping Cart",
        icon: ShoppingCart,
      },
      { value: "store", label: "Store", icon: Store },
      { value: "gift", label: "Gift", icon: Gift },
      { value: "shirt", label: "Shirt", icon: Shirt },
      { value: "gem", label: "Gem", icon: Gem },
    ],
  ),

  ...createIconGroup(
    "Health & Recreation",
    [
      "health",
      "wellness",
      "fitness",
      "gym",
      "recreation",
      "sport",
      "sports",
      "exercise",
    ],
    [
      {
        value: "heart_pulse",
        label: "Heart Pulse",
        icon: HeartPulse,
      },
      { value: "dumbbell", label: "Dumbbell", icon: Dumbbell },
      { value: "trophy", label: "Trophy", icon: Trophy },
      { value: "activity", label: "Activity", icon: Activity },
    ],
  ),

  ...createIconGroup(
    "Places & Accommodation",
    [
      "place",
      "places",
      "accommodation",
      "hotel",
      "lodging",
      "stay",
      "building",
      "heritage",
      "attraction",
    ],
    [
      { value: "house", label: "House", icon: House },
      { value: "building_2", label: "Building", icon: Building2 },
      { value: "hotel", label: "Hotel", icon: Hotel },
      { value: "bed_double", label: "Bed", icon: BedDouble },
      { value: "landmark", label: "Landmark", icon: Landmark },
      { value: "church", label: "Church", icon: Church },
    ],
  ),

  ...createIconGroup(
    "Transportation",
    [
      "transport",
      "transportation",
      "vehicle",
      "vehicles",
      "travel",
      "transit",
      "ride",
      "rental",
    ],
    [
      { value: "car", label: "Car", icon: Car },
      { value: "bus", label: "Bus", icon: Bus },
      { value: "plane", label: "Plane", icon: Plane },
      { value: "ship", label: "Ship", icon: Ship },
      { value: "sailboat", label: "Sailboat", icon: Sailboat },
      { value: "train_front", label: "Train", icon: TrainFront },
      { value: "anchor", label: "Anchor", icon: Anchor },
    ],
  ),

  ...createIconGroup(
    "Animals & Pets",
    ["animal", "animals", "pet", "pets", "wildlife"],
    [
      { value: "paw_print", label: "Paw Print", icon: PawPrint },
      { value: "dog", label: "Dog", icon: Dog },
      { value: "cat", label: "Cat", icon: Cat },
      { value: "bird", label: "Bird", icon: Bird },
    ],
  ),
];

/**
 * Filters specialty tag icons using client-side search.
 *
 * Matches icon names, persisted values, categories, and broader searchable
 * concepts so admins do not need to know the exact icon name.
 */
export function searchSpecialtyTagIcons(search = "") {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return SPECIALTY_TAG_ICONS;
  }

  return SPECIALTY_TAG_ICONS.filter(({ label, value, category, keywords }) => {
    const searchableText = [
      label,
      value.replaceAll("_", " "),
      category,
      ...keywords,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });
}
