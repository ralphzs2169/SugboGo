export type HiddenGem = {
  id: string;
  name: string;
  photoUrl: string;
  tags: string[];
  category: "Culinary" | "Leisure" | "Creative";
  location: string;
  distanceKm?: number;
  isInterestMatch?: boolean;
  isDiscoverMore?: boolean;
  isTrending?: boolean;
  trendDirection?: "up" | "down";
  trendValue?: number;
};

export const MOCK_HIDDEN_GEMS: HiddenGem[] = [
  {
    id: "1",
    name: "Kawayan Artisans Hub",
    photoUrl: "https://images.unsplash.com/photo-1606077089838-0ac4a27fc96f?q=80&w=1578&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tags: ["AUTHENTIC", "HERITAGE", "HANDCRAFTED"],
    category: "Creative",
    location: "Madaue City, Cebu",
    isInterestMatch: true,
  },
  {
    id: "2",
    name: "Maayo Kitchen",
    photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?",
    tags: ["AUTHENTIC", "LOCAL"],
    category: "Culinary",
    location: "Cebu City, Cebu",
  },
  {
    id: "3",
    name: "Carcar Lechon House",
    photoUrl: "https://images.unsplash.com/photo-1742056024474-345507034245?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tags: ["AUTHENTIC", "HERITAGE"],
    category: "Culinary",
    location: "Carcar City, Cebu",
    isInterestMatch: true,
  },
  {
    id: "4",
    name: "Bantayan Island Sailing",
    photoUrl:  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?",
    tags: ["ADVENTURE", "SCENIC"],
    category: "Leisure",
    location:  "Bantayan Island, Cebu",
  },
  {
    id: "5",
    name: "Kawasan Falls Trek",
    photoUrl: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?",
    tags: ["NATURE", "ADVENTURE"],
    category: "Leisure",
    location: "Badian, Cebu",
    isInterestMatch: true,
  },
  {
    id: "6",
    name: "Danao Weaves & Crafts",
    photoUrl:  "https://images.unsplash.com/photo-1729383456185-dec6084f0271?q=80&w=846&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tags: ["HERITAGE", "HANDCRAFTED"],
    category: "Creative",
    location: "Danao City, Cebu",
    isInterestMatch: true,
  },
  {
  id: "7",
  name: "Larsian Grills",
  photoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&h=300&fit=crop",
  tags: ["BBQ", "SPICY"],
  category: "Culinary",
  location: "Fuente, Cebu City",
  distanceKm: 5.2,
  isDiscoverMore: true,
},
{
  id: "8",
  name: "Sugbo Brews",
  photoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop",
  tags: ["CRAFT BEER", "VIBE"],
  category: "Leisure",
  location: "IT Park, Lahug",
  distanceKm: 3.8,
  isDiscoverMore: true,
},
{
  id: "9",
  name: "Cebuano Loom Weavers",
  photoUrl: "https://images.unsplash.com/photo-1729383456185-dec6084f0271?q=80&w=846&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3Dw=300&h=300&fit=crop",
  tags: ["HANDCRAFTED", "HERITAGE"],
  category: "Creative",
  location: "Argao, Cebu",
  distanceKm: 8.4,
  isDiscoverMore: true,
},
{
  id: "10",
  name: "Lecheria Pottery Studio",
  photoUrl: "https://images.unsplash.com/photo-1493106819501-66d381c466f1?w=300&h=300&fit=crop",
  tags: ["ARTISANAL", "HANDCRAFTED"],
  category: "Creative",
  location: "Talisay City, Cebu",
  distanceKm: 9.1,
  isDiscoverMore: true,
},
{
  id: "11",
  name: "Talisay Paddle Adventures",
  photoUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=300&h=300&fit=crop",
  tags: ["ADVENTURE", "SCENIC"],
  category: "Leisure",
  location: "Talisay City, Cebu",
  distanceKm: 2.3,
  isDiscoverMore: true,
},
{
  id: "12",
  name: "Golden Cowrie Native Restaurant",
  photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300&h=300&fit=crop",
  tags: ["AUTHENTIC", "LOCAL"],
  category: "Culinary",
  location: "Salinas Drive, Cebu City",
  distanceKm: 3.1,
  isDiscoverMore: true,
},
{
  id: "13",
  name: "Woodcraft Cebu",
  photoUrl: "https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=400&h=500&fit=crop",
  tags: ["HANDCRAFTED", "HERITAGE", "ARTISANAL"],
  category: "Creative",
  location: "Mactan, Cebu",
  isTrending: true,
  trendDirection: "down",
  trendValue: 3,
},
{
  id: "14",
  name: "Casa Verde Farm Table",
  photoUrl: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400&h=500&fit=crop",
  tags: ["LOCAL", "ECO-FRIENDLY"],
  category: "Culinary",
  location: "Balamban, Cebu",
  isTrending: true,
  trendDirection: "up",
  trendValue: 12,
},
{
  id: "15",
  name: "Hidden Cove Camp",
  photoUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=500&fit=crop",
  tags: ["PRIVATE COVE", "SCENIC"],
  category: "Leisure",
  location: "Moalboal, Cebu",
  isTrending: true,
  trendDirection: "up",
  trendValue: 8,
},
];

