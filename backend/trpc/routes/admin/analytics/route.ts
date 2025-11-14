import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase not configured");
  }
  return createClient(url, key);
}

type CountAccumulator = { label: string; count: number };

function toTitleCaseLabel(input: string) {
  const normalized = input.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Unspecified";
  }
  return normalized
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function accumulateCount(
  map: Map<string, CountAccumulator>,
  raw: string | null | undefined,
  fallback: string,
  options?: { transform?: (value: string) => string },
) {
  const base = (raw ?? "").trim();
  const key = base ? base.toLowerCase() : fallback.toLowerCase();
  const labelSource = base || fallback;
  const transform = options?.transform;
  const label = transform ? transform(labelSource) : labelSource;
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    map.set(key, { label, count: 1 });
  }
}

function mapToShare(map: Map<string, CountAccumulator>, total: number): { label: string; count: number; percent: number }[] {
  return Array.from(map.values())
    .map((entry) => ({
      label: entry.label,
      count: entry.count,
      percent: total > 0 ? Number(((entry.count / total) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export const getPostAnalyticsProcedure = publicProcedure
  .input(z.object({ daysBack: z.number().int().min(1).max(365).optional() }).optional())
  .query(async ({ input }) => {
    const supabase = getSupabase();
    const days = input?.daysBack;
    const sinceIso = typeof days === "number" ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null;

    let oppQuery = supabase
      .from("opportunities")
      .select("id,title,created_at,location,type,user_id,profiles:profiles(profession)")
      .order("created_at", { ascending: false });

    if (sinceIso) {
      oppQuery = oppQuery.gte("created_at", sinceIso);
    }

    const { data: opportunityRows, error: opportunitiesError } = await oppQuery;
    if (opportunitiesError) {
      console.error("[analytics.getPostAnalytics] opportunities error", opportunitiesError);
      return {
        totalPosts: 0,
        totalApplications: 0,
        averageApplicationsPerPost: 0,
        posterRoleShare: [],
        seekingRoleShare: [],
        locationShare: [],
        posts: [],
        timeframe: sinceIso,
      };
    }

    const opportunities = (opportunityRows ?? []) as {
      id: string;
      title: string | null;
      created_at: string | null;
      location: string | null;
      type: string | null;
      user_id: string | null;
      profiles: { profession?: string | null } | null;
    }[];

    const postIds = opportunities.map((opp) => opp.id).filter(Boolean);

    let applicationsData: { opportunity_id: string | null; created_at: string | null }[] = [];
    if (postIds.length > 0) {
      let appsQuery = supabase
        .from("applications")
        .select("opportunity_id,created_at")
        .in("opportunity_id", postIds)
        .limit(10000);

      if (sinceIso) {
        appsQuery = appsQuery.gte("created_at", sinceIso);
      }

      const { data: appRows, error: appsError } = await appsQuery;
      if (appsError) {
        console.error("[analytics.getPostAnalytics] applications error", appsError);
      } else {
        applicationsData = (appRows ?? []) as { opportunity_id: string | null; created_at: string | null }[];
      }
    }

    const applicationCounts = new Map<string, number>();
    applicationsData.forEach((row) => {
      const key = row.opportunity_id ?? "";
      if (!key) return;
      applicationCounts.set(key, (applicationCounts.get(key) ?? 0) + 1);
    });

    const totalPosts = opportunities.length;
    const totalApplications = applicationsData.length;
    const averageApplicationsPerPost = totalPosts > 0 ? Number((totalApplications / totalPosts).toFixed(2)) : 0;

    const posterRoleMap = new Map<string, CountAccumulator>();
    const seekingRoleMap = new Map<string, CountAccumulator>();
    const locationMap = new Map<string, CountAccumulator>();

    const posts = opportunities.map((opp) => {
      const posterRoleRaw = opp.profiles?.profession ?? null;
      const seekingRoleRaw = opp.type ?? null;
      const locationRaw = opp.location ?? null;

      accumulateCount(posterRoleMap, posterRoleRaw, "Unspecified", { transform: toTitleCaseLabel });
      accumulateCount(seekingRoleMap, seekingRoleRaw, "Other", { transform: toTitleCaseLabel });
      accumulateCount(locationMap, locationRaw, "Unlisted", { transform: (value) => value.trim() || "Unlisted" });

      const applications = applicationCounts.get(opp.id) ?? 0;
      const applicationsPercent = totalApplications > 0 ? Number(((applications / totalApplications) * 100).toFixed(2)) : 0;

      return {
        id: opp.id,
        title: opp.title ?? "Untitled opportunity",
        createdAt: opp.created_at,
        location: locationRaw?.trim() || "Unlisted",
        seekingRole: toTitleCaseLabel(seekingRoleRaw ?? ""),
        posterRole: toTitleCaseLabel(posterRoleRaw ?? ""),
        applications,
        applicationsPercent,
      };
    });

    const posterRoleShare = mapToShare(posterRoleMap, totalPosts);
    const seekingRoleShare = mapToShare(seekingRoleMap, totalPosts);
    const locationShare = mapToShare(locationMap, totalPosts);

    posts.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    return {
      totalPosts,
      totalApplications,
      averageApplicationsPerPost,
      posterRoleShare,
      seekingRoleShare,
      locationShare,
      posts,
      timeframe: sinceIso,
    };
  });

export const getUserActivitySummaryProcedure = publicProcedure
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
  });

export const getSearchPatternsProcedure = publicProcedure
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
  });

export const getFilterUsageStatsProcedure = publicProcedure
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
  });

export const getOpportunityStatsProcedure = publicProcedure
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
  });

export const getLocationStatsProcedure = publicProcedure
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
  });

export const listRecentUserEventsProcedure = publicProcedure
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
  });