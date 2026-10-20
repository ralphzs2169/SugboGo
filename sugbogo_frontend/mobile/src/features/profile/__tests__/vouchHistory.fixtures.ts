import type {
  ExploreBusinessDetail,
  ExploreBusinessSpecialtyTag,
} from "@/features/explore/types/exploreBusiness.types";
import type {
  VouchHistoryBusiness,
  VouchHistoryResponse,
} from "../types/vouchHistory.types";

export function historyBusiness(
  id = 1,
  endorsedIds = [1, 2],
): VouchHistoryBusiness {
  const specialty_tags: ExploreBusinessSpecialtyTag[] = [1, 2, 3, 4].map(
    (tagId) => ({
      id: tagId,
      name: `Specialty ${tagId}`,
      color: "blue",
      icon: null,
      vouch_count: endorsedIds.includes(tagId) ? 1 : 0,
      is_vouched: endorsedIds.includes(tagId),
    }),
  );
  return {
    id,
    business_id: id,
    business_name: `Business ${id}`,
    cover_photo_url: null,
    category: { id: 1, name: "Cafe" },
    last_vouched_at: "2026-10-11T00:00:00Z",
    specialty_tags,
    vouches: endorsedIds.map((tagId) => ({
      id: id * 100 + tagId,
      specialty: {
        id: tagId,
        name: `Specialty ${tagId}`,
        color: "blue",
        icon: null,
      },
      created_at: "2026-10-11T00:00:00Z",
    })),
  };
}

export function businessDetail(
  business = historyBusiness(),
): ExploreBusinessDetail {
  return {
    id: business.id,
    business_name: business.business_name,
    cover_photo_url: business.cover_photo_url,
    display_cover_photo_url: business.cover_photo_url,
    category: business.category,
    specialty_tags: business.specialty_tags,
    review_count: 0,
    overall_vibe: null,
    is_pocketed: false,
    cluster: { id: 1, name: "Food", icon: "store" },
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.3,
      longitude: 123.9,
    },
    description: null,
    contact_number: "",
    email: null,
    website: null,
    photos: [],
    operating_hours: [],
    is_own_business: false,
    has_own_review: false,
  };
}

export function historyPage(
  items = [historyBusiness()],
  page = 1,
  totalBusinesses = items.length,
  totalVouches = items.reduce(
    (sum, business) => sum + business.vouches.length,
    0,
  ),
): VouchHistoryResponse {
  return {
    items,
    pagination: {
      page,
      page_size: 10,
      total_items: totalBusinesses,
      total_pages: Math.ceil(totalBusinesses / 10),
      has_next: page * 10 < totalBusinesses,
      has_previous: page > 1,
    },
    summary: {
      total_businesses: totalBusinesses,
      total_specialty_vouches: totalVouches,
    },
  };
}
