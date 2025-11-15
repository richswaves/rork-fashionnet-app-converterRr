import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import assignAdminRoleProcedure from "./routes/admin/assign-admin-role/route";
import { isBlockedProcedure, blockProcedure, unblockProcedure, listBlockedProcedure } from "./routes/block/route";
import { getFunnelDataProcedure } from "./routes/admin/get-funnel-data/route";
import {
  getUserActivitySummaryProcedure,
  getSearchPatternsProcedure,
  getFilterUsageStatsProcedure,
  getOpportunityStatsProcedure,
  getLocationStatsProcedure,
  listRecentUserEventsProcedure,
  getPostAnalyticsProcedure,
} from "./routes/admin/analytics/route";
import { getFypOpportunitiesProcedure } from "./routes/opportunities/get-fyp/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  admin: createTRPCRouter({
    assignAdminRole: assignAdminRoleProcedure,
    getFunnelData: getFunnelDataProcedure,
    analytics: createTRPCRouter({
      getUserActivitySummary: getUserActivitySummaryProcedure,
      getSearchPatterns: getSearchPatternsProcedure,
      getFilterUsageStats: getFilterUsageStatsProcedure,
      getOpportunityStats: getOpportunityStatsProcedure,
      getLocationStats: getLocationStatsProcedure,
      listRecentUserEvents: listRecentUserEventsProcedure,
      getPostAnalytics: getPostAnalyticsProcedure,
    }),
  }),
  block: createTRPCRouter({
    isBlocked: isBlockedProcedure,
    block: blockProcedure,
    unblock: unblockProcedure,
    listBlocked: listBlockedProcedure,
  }),
  opportunities: createTRPCRouter({
    getFyp: getFypOpportunitiesProcedure,
  }),
});

export type AppRouter = typeof appRouter;