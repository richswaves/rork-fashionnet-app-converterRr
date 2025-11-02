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
        return;
      }
      
      try {
        await sbInsert("user_activity_events", {
          user_id: currentUserId,
          event_type: event.event_type,
          page: event.page,
          metadata: event.metadata || null,
        });
      } catch {
        // Silently fail if tables don't exist yet
      }
    },
    onError: () => {
      // Silently fail - activity tracking is optional
    },
  });

  const trackSearch = useMutation({
    mutationFn: async (event: SearchEvent) => {
      if (!currentUserId) {
        return;
      }
      
      try {
        await sbInsert("search_analytics", {
          user_id: currentUserId,
          page: event.page,
          search_query: event.search_query || null,
          filters: event.filters || null,
          results_count: event.results_count || null,
        });
      } catch {
        // Silently fail if tables don't exist yet
      }
    },
    onError: () => {
      // Silently fail - activity tracking is optional
    },
  });

  const trackOpportunityInteraction = useMutation({
    mutationFn: async (interaction: OpportunityInteraction) => {
      if (!currentUserId) {
        return;
      }
      
      try {
        await sbInsert("opportunity_interactions", {
          user_id: currentUserId,
          opportunity_id: interaction.opportunity_id,
          interaction_type: interaction.interaction_type,
          metadata: interaction.metadata || null,
        });
      } catch {
        // Silently fail if tables don't exist yet
      }
    },
    onError: () => {
      // Silently fail - activity tracking is optional
    },
  });

  const trackNetworkInteraction = useMutation({
    mutationFn: async (interaction: NetworkInteraction) => {
      if (!currentUserId) {
        return;
      }
      
      try {
        await sbInsert("network_interactions", {
          user_id: currentUserId,
          target_user_id: interaction.target_user_id,
          interaction_type: interaction.interaction_type,
          metadata: interaction.metadata || null,
        });
      } catch {
        // Silently fail if tables don't exist yet
      }
    },
    onError: () => {
      // Silently fail - activity tracking is optional
    },
  });

  return {
    trackActivity: (event: ActivityEvent) => {
      trackActivity.mutate(event);
    },
    trackSearch: (event: SearchEvent) => {
      trackSearch.mutate(event);
    },
    trackOpportunityInteraction: (interaction: OpportunityInteraction) => {
      trackOpportunityInteraction.mutate(interaction);
    },
    trackNetworkInteraction: (interaction: NetworkInteraction) => {
      trackNetworkInteraction.mutate(interaction);
    },
  };
}
