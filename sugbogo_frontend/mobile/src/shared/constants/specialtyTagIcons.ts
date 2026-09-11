import { MaterialCommunityIcons } from "@expo/vector-icons";

export const SPECIALTY_TAG_ICONS: Record<
  string,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  tag: "tag-outline",
  star: "star-outline",
  heart: "heart-outline",
  sparkles: "creation-outline",
  badge_check: "check-decagram-outline",
  circle_check: "check-circle-outline",
  thumbs_up: "thumb-up-outline",

  utensils: "silverware-fork-knife",
  chef_hat: "chef-hat",
  cooking_pot: "pot-steam-outline",
  coffee: "coffee-outline",
  cup_soda: "cup-outline",
  cake_slice: "cake-variant-outline",
  cupcake: "cupcake",
  croissant: "food-croissant",
  cookie: "cookie-outline",
  ice_cream_bowl: "ice-cream",
  pizza: "pizza",
  sandwich: "food-outline",
  soup: "food-outline",
  salad: "food-outline",
  beef: "food-steak",
  fish: "fish",
  egg: "egg-outline",
  milk: "cup-outline",
  wheat: "barley",
  apple: "food-apple-outline",
  banana: "food-apple-outline",
  cherry: "fruit-cherries",
  citrus: "fruit-citrus",
  popcorn: "popcorn",
  wine: "glass-wine",
  beer: "glass-mug-variant",
  martini: "glass-cocktail",

  palette: "palette-outline",
  paintbrush: "brush",
  brush: "brush",
  paint_bucket: "format-color-fill",
  pencil: "pencil-outline",
  pen_tool: "fountain-pen-tip",
  feather: "feather",
  scissors: "content-cut",

  camera: "camera-outline",
  image: "image-outline",
  film: "filmstrip",
  clapperboard: "movie-open-outline",

  music: "music",
  guitar: "guitar-acoustic",
  headphones: "headphones",
  mic_vocal: "microphone-outline",
  radio: "radio",
  ticket: "ticket-outline",
  drama: "drama-masks",
  gamepad_2: "gamepad-variant-outline",

  book: "book-outline",
  book_open: "book-open-page-variant-outline",
  library: "library",
  graduation_cap: "school-outline",
  newspaper: "newspaper-variant-outline",

  leaf: "leaf",
  sprout: "sprout",
  tree_pine: "pine-tree",
  trees: "forest",
  tree_palm: "palm-tree",
  flower_2: "flower-outline",
  mountain: "image-filter-hdr",
  waves: "waves",
  sun: "weather-sunny",
  sunset: "weather-sunset",

  bike: "bike",
  footprints: "shoe-print",
  compass: "compass-outline",
  binoculars: "binoculars",
  map: "map-outline",
  map_pin: "map-marker-outline",
  route: "map-marker-path",
  navigation: "navigation-variant-outline",

  shopping_bag: "shopping-outline",
  shopping_basket: "basket-outline",
  shopping_cart: "cart-outline",
  store: "store-outline",
  gift: "gift-outline",
  shirt: "tshirt-crew-outline",
  gem: "diamond-stone",

  heart_pulse: "heart-pulse",
  dumbbell: "dumbbell",
  trophy: "trophy-outline",
  activity: "chart-line",

  house: "home-outline",
  building_2: "office-building-outline",
  hotel: "bed",
  bed_double: "bed-double-outline",
  landmark: "bank-outline",
  church: "church",

  car: "car-outline",
  bus: "bus",
  plane: "airplane",
  ship: "ferry",
  sailboat: "ferry",
  train_front: "train",
  anchor: "anchor",

  paw_print: "paw",
  dog: "dog",
  cat: "cat",
  bird: "bird",
};

export function getSpecialtyTagIcon(
  icon: string | null | undefined,
): keyof typeof MaterialCommunityIcons.glyphMap {
  if (!icon) {
    return "tag-outline";
  }

  return SPECIALTY_TAG_ICONS[icon] ?? "tag-outline";
}
