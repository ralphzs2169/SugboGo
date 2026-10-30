import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PropsWithChildren } from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import BusinessSentimentRating from "../../components/business-profile/BusinessSentimentRating";
import type { ExploreBusinessDetail } from "../../types/exploreBusiness.types";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { ReviewDerivedDataSyncProvider } from "../ReviewDerivedDataSyncProvider";
import { beginBusinessRatingSync } from "../businessRatingSync";
import { exploreBusinessDetailKey } from "../reviewQueryKeys";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
}));
// Native transport is supplied by Node in this opt-in integration test. Payloads
// come from a real authenticated Django HTTP server, not mocked rating responses.
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(async (businessId: number) => {
    const fs = jest.requireActual("node:fs");
    const http = jest.requireActual("node:http");
    const state = JSON.parse(
      fs.readFileSync(process.env.SUGBOGO_RATING_RUNTIME_STATE, "utf8"),
    );
    return new Promise((resolve, reject) => {
      const request = http.get(
        `${state.api_base}/explorer/explore/businesses/${businessId}/`,
        { headers: { Authorization: `Bearer ${state.access_token}` } },
        (response: any) => {
          let body = "";
          response.on("data", (chunk: string) => {
            body += chunk;
          });
          response.on("end", () => {
            if (response.statusCode !== 200) {
              reject(new Error(`Fixture HTTP status ${response.statusCode}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      request.on("error", reject);
      request.setTimeout(15_000, () => {
        request.destroy(new Error("Fixture HTTP timeout"));
      });
    });
  }),
}));

const runtimeTest = process.env.SUGBOGO_RATING_RUNTIME_STATE ? it : it.skip;

runtimeTest("updates an already-mounted rating from actual Redis/Celery and HTTP output", async () => {
  const statePath = process.env.SUGBOGO_RATING_RUNTIME_STATE!;
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  expect(state.database).toMatch(/^test_sugbogo_phase6b_/);
  useAuthStore.setState({
    user: { id: state.owner_id } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  /** Presents the same shared rating while its existing detail observer refreshes. */
  function MountedRating() {
    const query = useQuery({
      queryKey: exploreBusinessDetailKey(state.business_id),
      queryFn: async () => {
        const response = await getExploreBusinessDetail(state.business_id);
        return response.data as ExploreBusinessDetail;
      },
      enabled: false,
    });
    return (
      <BusinessSentimentRating
        businessId={state.business_id}
        rating={query.data?.sentiment_rating}
      />
    );
  }
  /** Keeps one mounted profile synchronization owner throughout the live mutation. */
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <ReviewDerivedDataSyncProvider
          businessId={state.business_id}
          observeAuthorReview={false}
        >
          {children}
        </ReviewDerivedDataSyncProvider>
      </QueryClientProvider>
    );
  }
  const view = await render(<MountedRating />, { wrapper: Wrapper });
  try {
    await waitFor(() => {
      expect(view.getByText("4.5/5 · 5 scored reviews")).toBeTruthy();
    }, { timeout: 30_000 });
    await act(async () => {
      const detail = client.getQueryData<ExploreBusinessDetail>(
        exploreBusinessDetailKey(state.business_id),
      );
      beginBusinessRatingSync(client, state.business_id, detail?.sentiment_rating);
    });
    writeFileSync(join(dirname(statePath), "mobile-mounted"), "mounted");
    await waitFor(() => {
      const updated = JSON.parse(readFileSync(statePath, "utf8"));
      const receipt = updated.results.negative_publication;
      expect(receipt).toBeDefined();
      expect(
        view.getByText(`${receipt.api_value.toFixed(1)}/5 · 6 scored reviews`),
      ).toBeTruthy();
    }, { timeout: 60_000, interval: 250 });
    writeFileSync(join(dirname(statePath), "mobile-observed"), "observed");
    expect(jest.mocked(getExploreBusinessDetail).mock.calls.length).toBeGreaterThanOrEqual(2);
  } finally {
    await view.unmount();
    client.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  }
}, 100_000);
