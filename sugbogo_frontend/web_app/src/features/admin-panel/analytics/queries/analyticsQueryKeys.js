import { normalizeAnalyticsParams } from "../utils/reportParameters";

const all = ["admin", "analytics"];
const reportKey = (report, params) => [...all, report, normalizeAnalyticsParams(report, params)];

export const analyticsQueryKeys = {
  all,
  taxonomy: (kind) => [...all, "taxonomy", kind],
  platformOverview: (params) => reportKey("platformOverview", params),
  platformGrowth: (params) => reportKey("platformGrowth", params),
  discoverySources: (params) => reportKey("discoverySources", params),
  discoverySummary: (params) => reportKey("discoverySummary", params),
  discoveryTrend: (params) => reportKey("discoveryTrend", params),
  onboarding: (params) => reportKey("onboarding", params),
  attentionQueue: (params) => reportKey("attentionQueue", params),
  coverage: (params) => reportKey("coverage", params),
  businessAttention: (params) => reportKey("businessAttention", params),
  lowExposure: (params) => reportKey("lowExposure", params),
  communityHealth: (params) => reportKey("communityHealth", params),
  specialtySupport: (params) => reportKey("specialtySupport", params),
  changeRequests: (params) => reportKey("changeRequests", params),
  discoveryHeatmap: (params) => reportKey("discoveryHeatmap", params),
  discoveryScores: (params) => reportKey("discoveryScores", params),
};
