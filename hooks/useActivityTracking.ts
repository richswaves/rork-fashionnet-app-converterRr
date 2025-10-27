import { useMutation } from "@tanstack/react-query";
import { sbInsert } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

export type ActivityEvent = {
  event_type: string;
  page: string;
  metadata?: Record<string, any>;
};

export type SearchEvent = {
  page: string;
  search_query?: string;
  filters?: Record<string, any>;
  results_count?: number;
};

export type OpportunityInteraction = {
  opportunity_id: string;
  interaction_type: "view" | "apply" | "save" | "unsave" | "unapply";
  metadata?: Record<string, any>;
};

export type NetworkInteraction = {
  target_user_id: string;
  interaction_type: "view_profile" | "follow" | "unfollow" | "message";
  metadata?: Record<string, any>;
};

export function useActivityTracking() {
  const { currentUserId } = useProfile();

  const trackActivity = useMutation({
    mutationFn: async (event: ActivityEvent) => {
      if (!currentUserId) {
        console.log("[ActivityTracking] No user logged in, skipping track");
        return;
      }

      console.log(`[ActivityTracking] Tracking activity: ${event.event_type} on ${event.page}`);
      
      await sbInsert("user_activity_events", {
        user_id: currentUserId,
        event_type: event.event_type,
        page: event.page,
        metadata: event.metadata || null,
      });
    },
    onError: (error) => {
      console.error("[ActivityTracking] Failed to track activity:", error);
    },
  });

  const trackSearch = useMutation({
    mutationFn: async (event: SearchEvent) => {
      if (!currentUserId) {
        console.log("[ActivityTracking] No user logged in, skipping search track");
        return;
      }

      console.log(`[ActivityTracking] Tracking search on ${event.page}:`, {
        query: event.search_query,
        filters: event.filters,
        results: event.results_count,
      });

      await sbInsert("search_analytics", {
        user_id: currentUserId,
        page: event.page,
        search_query: event.search_query || null,
        filters: event.filters || null,
        results_count: event.results_count || null,
      });
    },
    onError: (error) => {
      console.error("[ActivityTracking] Failed to track search:", error);
    },
  });

  const trackOpportunityInteraction = useMutation({
    mutationFn: async (interaction: OpportunityInteraction) => {
      if (!currentUserId) {
        console.log("[ActivityTracking] No user logged in, skipping opportunity track");
        return;
      }

      console.log(`[ActivityTracking] Tracking opportunity ${interaction.interaction_type}:`, interaction.opportunity_id);

      await sbInsert("opportunity_interactions", {
        user_id: currentUserId,
        opportunity_id: interaction.opportunity_id,
        interaction_type: interaction.interaction_type,
        metadata: interaction.metadata || null,
      });
    },
    onError: (error) => {
      console.error("[ActivityTracking] Failed to track opportunity interaction:", error);
    },
  });

  const trackNetworkInteraction = useMutation({
    mutationFn: async (interaction: NetworkInteraction) => {
      if (!currentUserId) {
        console.log("[ActivityTracking] No user logged in, skipping network track");
        return;
      }

      console.log(`[ActivityTracking] Tracking network ${interaction.interaction_type}:`, interaction.target_user_id);

      await sbInsert("network_interactions", {
        user_id: currentUserId,
        target_user_id: interaction.target_user_id,
        interaction_type: interaction.interaction_type,
        metadata: interaction.metadata || null,
      });
    },
    onError: (error) => {
      console.error("[ActivityTracking] Failed to track network interaction:", error);
    },
  });

  return {
    trackActivity: trackActivity.mutate,
    trackSearch: trackSearch.mutate,
    trackOpportunityInteraction: trackOpportunityInteraction.mutate,
    trackNetworkInteraction: trackNetworkInteraction.mutate,
  };
}
