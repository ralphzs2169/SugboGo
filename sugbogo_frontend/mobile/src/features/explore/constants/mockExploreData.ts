export type HiddenGem = {
  id: string;
  name: string;
  photoUrl: string;
  tags: string[];
  category: "Culinary" | "Leisure" | "Creative";
};

export const MOCK_HIDDEN_GEMS: HiddenGem[] = [
  {
    id: "1",
    name: "Kawayan Artisans Hub",
    photoUrl: "https://images.unsplash.com/photo-1606077089838-0ac4a27fc96f?q=80&w=1578&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tags: ["AUTHENTIC", "HERITAGE", "HANDCRAFTED"],
    category: "Creative",
  },
  {
    id: "2",
    name: "Maayo Kitchen",
    photoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?",
    tags: ["AUTHENTIC", "LOCAL"],
    category: "Culinary",
  },
  {
    id: "3",
    name: "Carcar Lechon House",
    photoUrl: "https://images.unsplash.com/photo-1742056024474-345507034245?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tags: ["AUTHENTIC", "HERITGE"],
    category: "Culinary",
  },
  {
    id: "4",
    name: "Bantayan Island Sailing",
    photoUrl:  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?",
    tags: ["ADVENTURE", "SCENIC"],
    category: "Leisure",
  },
  {
    id: "5",
    name: "Kawasan Falls Trek",
    photoUrl: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?",
    tags: ["NATURE", "ADVENTURE"],
    category: "Leisure",
  },
  {
    id: "6",
    name: "Danao Weaves & Crafts",
    photoUrl:  "https://images.unsplash.com/photo-1729383456185-dec6084f0271?q=80&w=846&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tags: ["HERITAGE", "HANDCRAFTED"],
    category: "Creative",
  }
];

