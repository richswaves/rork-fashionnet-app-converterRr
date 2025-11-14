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
  query: string;
  filters?: Record<string, any>;
  location?: string | null;
  clickedResultId?: string | null;
  resultsCount?: number;
  timeSpentSeconds?: number;
};

export type FilterEvent = {
  page: string;
  filters: Record<string, any>;
  location?: string | null;
};

export type OpportunityInteraction = {
  opportunity_id: string;
  interaction_type: "view" | "view_duration" | "apply" | "save" | "unsave" | "unapply" | "share" | "open_link";
  metadata?: Record<string, any>;
  time_spent_seconds?: number;
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
      try {
        await sbInsert("user_activity_events", {
          user_id: currentUserId ?? null,
          event_type: event.event_type,
          page: event.page,
          metadata: event.metadata || null,
        });
      } catch {
      }
    },
    onError: () => {
    },
  });

  const trackSearch = useMutation({
    mutationFn: async (event: SearchEvent) => {
      const filtersPayload = event.filters ? { ...event.filters } : {};
      if (typeof event.resultsCount === "number") {
        filtersPayload.results_count = event.resultsCount;
      }
      try {
        await sbInsert("search_analytics", {
          user_id: currentUserId ?? null,
          page: event.page,
          query: event.query,
          filters: Object.keys(filtersPayload).length > 0 ? filtersPayload : null,
          location: event.location ?? null,
          clicked_result_id: event.clickedResultId ?? null,
          time_spent_seconds: event.timeSpentSeconds ?? null,
        });
      } catch (error) {
        console.log("[ActivityTracking] Search analytics insert failed:", error);
      }
    },
    onError: () => {
    },
  });

  const trackFilterApplication = useMutation({
    mutationFn: async (event: FilterEvent) => {
      try {
        await sbInsert("search_analytics", {
          user_id: currentUserId ?? null,
          page: event.page,
          query: "filter_applied",
          filters: event.filters,
          location: event.location ?? null,
        });
      } catch (error) {
        console.log("[ActivityTracking] Filter analytics insert failed:", error);
      }
    },
    onError: () => {
    },
  });

  const trackOpportunityInteraction = useMutation({
    mutationFn: async (interaction: OpportunityInteraction) => {
      try {
        await sbInsert("opportunity_interactions", {
          user_id: currentUserId ?? null,
          opportunity_id: interaction.opportunity_id,
          interaction_type: interaction.interaction_type,
          metadata: interaction.metadata
            ? {
                ...interaction.metadata,
                ...(typeof interaction.time_spent_seconds === "number" ? { time_spent_seconds: interaction.time_spent_seconds } : {}),
              }
            : typeof interaction.time_spent_seconds === "number"
            ? { time_spent_seconds: interaction.time_spent_seconds }
            : null,
        });
      } catch {
      }
    },
    onError: () => {
    },
  });

  const trackNetworkInteraction = useMutation({
    mutationFn: async (interaction: NetworkInteraction) => {
      try {
        await sbInsert("network_interactions", {
          user_id: currentUserId ?? null,
          target_user_id: interaction.target_user_id,
          interaction_type: interaction.interaction_type,
          metadata: interaction.metadata || null,
        });
      } catch {
      }
    },
    onError: () => {
    },
  });

  return {
    trackActivity: (event: ActivityEvent) => {
      trackActivity.mutate(event);
    },
    trackSearch: (event: SearchEvent) => {
      trackSearch.mutate(event);
    },
    trackFilterApplication: (event: FilterEvent) => {
      trackFilterApplication.mutate(event);
    },
    trackOpportunityInteraction: (interaction: OpportunityInteraction) => {
      trackOpportunityInteraction.mutate(interaction);
    },
    trackNetworkInteraction: (interaction: NetworkInteraction) => {
      trackNetworkInteraction.mutate(interaction);
    },
  };
}
