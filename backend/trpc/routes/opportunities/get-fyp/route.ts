import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

export const getFypOpportunitiesProcedure = protectedProcedure
  .input(
    z.object({
      limit: z.number().optional().default(50),
    })
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.userId;
    const { limit } = input;
    const supabase = ctx.supabase;

    console.log("[getFypOpportunities] Fetching FYP opportunities for user:", userId);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("location")
      .eq("user_id", userId)
      .single();

    const userLocation = profileData?.location;
    console.log("[getFypOpportunities] User location:", userLocation);

    const { data: followingData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    const followingIds = (followingData ?? []).map((f) => f.following_id);
    console.log("[getFypOpportunities] User follows:", followingIds.length, "people");

    const { data: mutualFollowersData } = await supabase
      .from("follows")
      .select("follower_id")
      .in("following_id", followingIds.length > 0 ? followingIds : ["never-match"]);

    const mutualFollowerIds = Array.from(
      new Set((mutualFollowersData ?? []).map((f) => f.follower_id))
    );
    console.log("[getFypOpportunities] Mutual followers count:", mutualFollowerIds.length);

    const allRelevantUserIds = Array.from(
      new Set([...followingIds, ...mutualFollowerIds])
    );

    console.log("[getFypOpportunities] Total relevant users:", allRelevantUserIds.length);

    let query = supabase
      .from("opportunities")
      .select("*, profiles:user_id(*)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userLocation) {
      const locationParts = userLocation.split(",");
      const city = locationParts[0]?.trim();
      const state = locationParts[1]?.trim();

      if (city && state) {
        query = query.or(
          `location.ilike.%${city}%,location.ilike.%${state}%,user_id.in.(${
            allRelevantUserIds.length > 0 ? allRelevantUserIds.join(",") : "never-match"
          })`
        );
      } else if (city) {
        query = query.or(
          `location.ilike.%${city}%,user_id.in.(${
            allRelevantUserIds.length > 0 ? allRelevantUserIds.join(",") : "never-match"
          })`
        );
      } else {
        if (allRelevantUserIds.length > 0) {
          query = query.in("user_id", allRelevantUserIds);
        } else {
          query = query.limit(limit);
        }
      }
    } else {
      if (allRelevantUserIds.length > 0) {
        query = query.in("user_id", allRelevantUserIds);
      } else {
        query = query.limit(limit);
      }
    }

    const { data: opportunities, error } = await query;

    if (error) {
      console.error("[getFypOpportunities] Error:", error);
      throw new Error("Failed to fetch FYP opportunities");
    }

    console.log("[getFypOpportunities] Found opportunities:", opportunities?.length ?? 0);

    const uniqueOpportunities = Array.from(
      new Map(opportunities?.map((opp) => [opp.id, opp]) ?? []).values()
    );

    return uniqueOpportunities;
  });
