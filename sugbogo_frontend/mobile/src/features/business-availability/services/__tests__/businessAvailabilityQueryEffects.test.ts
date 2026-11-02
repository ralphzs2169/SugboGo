import { QueryClient } from "@tanstack/react-query";
import { cachedBusinessIds, refreshAvailabilityCaches } from "../businessAvailabilityQueryEffects";
import { pocketCollectionsQueryKey } from "@/features/pockets/hooks/pocketQueryKeys";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";

jest.mock("@/features/explore/api/exploreBusiness.service", () => ({}));

it("invalidates only affected live business caches and this owner's Pocket counts", async () => {
  const client = new QueryClient();
  const affected = ["explore-discovery-results", "coffee"];
  const untouched = ["explore-discovery-results", "parks"];
  const map = ["map-discovery-directory", "all"];
  const device = ["offline-business-snapshots", 7];
  client.setQueryData(affected, { pages: [{ items: [{ id: 21 }] }] });
  client.setQueryData(untouched, { pages: [{ items: [{ id: 99 }] }] });
  client.setQueryData(map, [{ id: 21 }, { id: 99 }]);
  client.setQueryData(device, { snapshot: "preserved" });
  client.setQueryData(pocketCollectionsQueryKey(7), { count: 1 });
  client.setQueryData(pocketCollectionsQueryKey(8), { count: 2 });
  expect(new Set(cachedBusinessIds(client))).toEqual(new Set([21, 99]));
  await refreshAvailabilityCaches(client, 7, [21]);
  expect(client.getQueryState(affected)?.isInvalidated).toBe(true);
  expect(client.getQueryState(map)?.isInvalidated).toBe(true);
  expect(client.getQueryState(untouched)?.isInvalidated).toBe(false);
  expect(client.getQueryState(pocketCollectionsQueryKey(7))?.isInvalidated).toBe(true);
  expect(client.getQueryState(pocketCollectionsQueryKey(8))?.isInvalidated).toBe(false);
  expect(client.getQueryData(device)).toEqual({ snapshot: "preserved" });
  client.clear();
});
it("reactivation refreshes a denied detail without manufacturing new saved content", async () => {
  const client = new QueryClient();
  client.setQueryData(exploreBusinessDetailKey(21), null);
  await refreshAvailabilityCaches(client, 7, [21]);
  expect(client.getQueryState(exploreBusinessDetailKey(21))?.isInvalidated).toBe(true);
  expect(client.getQueryData(exploreBusinessDetailKey(21))).toBeNull();
  client.clear();
});
