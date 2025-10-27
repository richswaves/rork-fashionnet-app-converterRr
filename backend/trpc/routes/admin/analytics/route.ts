import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase not configured");
  }
  return createClient(url, key);
}

export default createTRPCRouter({
  getUserActivitySummary: publicProcedure
    .input(z.object({ userId: z.string().uuid(), daysBack: z.number().int().min(1).max(365).optional() }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabase();
      const days = input?.daysBack ?? 30;
      const userId = input?.userId;
      if (!userId) return null;
      const { data, error } = await supabase.rpc("get_user_activity_summary", { target_user_id: userId, days_back: days });
      if (error) {
        console.error("[analytics.getUserActivitySummary] error", error);
        return null;
      }
      return data as Record<string, unknown> | null;
    }),

  getSearchPatterns: publicProcedure
    .input(z.object({ daysBack: z.number().int().min(1).max(365).optional() }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabase();
      const days = input?.daysBack ?? 30;
      const { data, error } = await supabase.rpc("get_search_patterns", { days_back: days });
      if (error) {
        console.error("[analytics.getSearchPatterns] error", error);
        return [];
      }
      return (data ?? []) as { page: string; search_query: string; search_count: number; avg_results: number }[];
    }),

  getFilterUsageStats: publicProcedure
    .input(z.object({ page: z.string(), daysBack: z.number().int().min(1).max(365).optional() }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      const days = input.daysBack ?? 30;
      const { data, error } = await supabase.rpc("get_filter_usage_stats", { target_page: input.page, days_back: days });
      if (error) {
        console.error("[analytics.getFilterUsageStats] error", error);
        return [];
      }
      return (data ?? []) as { filter_key: string; filter_value: string; usage_count: number }[];
    }),

  getOpportunityStats: publicProcedure
    .input(z.object({ daysBack: z.number().int().min(1).max(365).optional() }).optional())
    .query(async ({ input }) => {
      const supabase = getSupabase();
      const days = input?.daysBack ?? 30;
      const { data, error } = await supabase.rpc("get_opportunity_stats", { days_back: days });
      if (error) {
        console.error("[analytics.getOpportunityStats] error", error);
        return [];
      }
      return (data ?? []) as { opportunity_id: string; title: string | null; view_count: number; application_count: number; save_count: number }[];
    }),

  getLocationStats: publicProcedure
    .input(z.object({ page: z.string(), daysBack: z.number().int().min(1).max(365).optional() }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      const days = input.daysBack ?? 30;
      const { data, error } = await supabase.rpc("get_location_stats", { target_page: input.page, days_back: days });
      if (error) {
        console.error("[analytics.getLocationStats] error", error);
        return [];
      }
      return (data ?? []) as { location: string; interaction_count: number }[];
    }),

  listRecentUserEvents: publicProcedure
    .input(z.object({ userId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("user_activity_events")
        .select("event_type,page,metadata,created_at")
        .eq("user_id", input.userId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 50);
      if (error) {
        console.error("[analytics.listRecentUserEvents] error", error);
        return [];
      }
      return (data ?? []) as { event_type: string; page: string; metadata: unknown; created_at: string }[];
    }),
});