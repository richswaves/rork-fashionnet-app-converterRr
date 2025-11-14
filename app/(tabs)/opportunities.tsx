import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, Linking, Modal, NativeScrollEvent, NativeSyntheticEvent, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import GrainTexture from "@/components/GrainTexture";
import { ChevronDown, Filter, Layers, CheckCircle2, Send, Bookmark, Instagram, Search, Bell, Users, Trash2, MoreVertical, Twitter, Youtube, ShieldCheck } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, sbSelect, sbInsert, sbDelete } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { trpc } from "@/lib/trpc";

interface ProfileRow {
  user_id: string;
  full_name?: string;
  profile_picture?: string;
  profession?: string;
  username?: string;
  instagram_website?: string;
  social_links?: {
    instagram?: string;
    youtube?: string;
    twitter?: string;
    tiktok?: string;
  } | null;
}

interface OpportunityRow {
  id: string;
  title?: string;
  company?: string | null;
  location?: string | null;
  type?: string | null;
  cover_image?: string | null;
  created_at?: string;
  user_id?: string;
  profiles?: ProfileRow;
  description?: string | null;
  budget?: string | null;
  requirements?: string[] | null;
}

const VIEW_OPTIONS = [
  { key: "all" as const, label: "All Opportunities", Icon: Layers },
  { key: "following" as const, label: "Following", Icon: Users },
  { key: "applied" as const, label: "Applied", Icon: CheckCircle2 },
  { key: "posted" as const, label: "Posted by Me", Icon: Send },
  { key: "saved" as const, label: "Saved", Icon: Bookmark },
];

type ViewKey = typeof VIEW_OPTIONS[number]["key"];

function formatRelativeTime(iso?: string) {
  if (!iso) return "";
  try {
    const posted = new Date(iso).getTime();
    if (Number.isNaN(posted)) return "";
    const now = Date.now();
    const diffMs = Math.max(0, now - posted);
    const sec = Math.floor(diffMs / 1000);
    if (sec < 5) return "Just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const date = new Date(iso);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${m}/${d}`;
  } catch {
    return "";
  }
}

function formatBudget(budget: string): string {
  if (budget.toLowerCase().includes("unpaid")) {
    return budget;
  }
  const parts = budget.split(" ");
  if (parts[0] === "Paid" && parts.length > 1) {
    const numbers = parts.slice(1).map((part) => {
      if (part === "-") return part;
      const num = part.replace(/[^0-9,]/g, "");
      return num ? `${num}` : part;
    });
    return `${parts[0]} ${numbers.join(" ")}`;
  }
  return budget;
}

function normalizeFilterValue(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitFilterTokens(value?: string | null): string[] {
  const normalized = normalizeFilterValue(value);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

type PaymentCategory = "paid" | "unpaid" | "mixed" | "unknown";

const PAID_KEYWORDS = [
  "paid",
  "compensated",
  "stipend",
  "salary",
  "rate",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "per hour",
  "per project",
  "per day",
  "per shoot",
  "per gig",
  "per job",
  "commission",
  "honorarium",
  "budget",
  "grant",
  "payment",
  "paying",
];

const UNPAID_KEYWORDS = [
  "unpaid",
  "volunteer",
  "collab",
  "collaboration",
  "trade",
  "tfp",
  "trade for print",
  "exposure",
  "experience",
  "no pay",
  "non paid",
  "pro bono",
  "uncompensated",
];

function classifyPaymentStatus(budget?: string | null): PaymentCategory {
  if (!budget) return "unknown";
  const normalized = normalizeFilterValue(budget);
  if (!normalized) return "unknown";
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const hasDigits = /\d/.test(budget);
  const hasCurrency = /[$€£¥₹₩₽₺₱]/.test(budget);
  const paidMatch = PAID_KEYWORDS.some((keyword) => {
    if (keyword.includes(" ")) {
      return normalized.includes(keyword);
    }
    return tokens.has(keyword);
  });
  const unpaidMatch = UNPAID_KEYWORDS.some((keyword) => {
    if (keyword.includes(" ")) {
      return normalized.includes(keyword);
    }
    return tokens.has(keyword);
  });
  const hasPaidSignal = paidMatch || hasDigits || hasCurrency;
  const hasUnpaidSignal = unpaidMatch;
  if (hasPaidSignal && hasUnpaidSignal) {
    return "mixed";
  }
  if (hasPaidSignal) {
    return "paid";
  }
  if (hasUnpaidSignal) {
    return "unpaid";
  }
  return "unknown";
}

export default function OpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [city, setCity] = useState<string[]>([]);
  const [seekingRole, setSeekingRole] = useState<string[]>([]);
  const [postedByRole, setPostedByRole] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string[]>([]);
  const [view, setView] = useState<ViewKey>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMenuOpen, setViewMenuOpen] = useState<boolean>(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState<boolean>(false);
  const [applyModalVisible, setApplyModalVisible] = useState<boolean>(false);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [applicationNote, setApplicationNote] = useState<string>("");
  const [isApplyingFilters, setIsApplyingFilters] = useState<boolean>(false);
  const container = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);
  const windowHeight = Dimensions.get("window").height;
  const sheetTranslateY = useRef<Animated.Value>(new Animated.Value(0)).current;
  const sheetScrollOffset = useRef<number>(0);
  const isClosingRef = useRef<boolean>(false);

  const animateSheetToZero = useCallback(() => {
    sheetTranslateY.stopAnimation();
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 1,
      overshootClamping: false,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start();
  }, [sheetTranslateY]);

  const handleSheetScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    sheetScrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const openFilterSheet = useCallback(() => {
    console.log("[Filters] Opening sheet");
    isClosingRef.current = false;
    sheetScrollOffset.current = 0;
    sheetTranslateY.stopAnimation();
    sheetTranslateY.setValue(windowHeight);
    animateSheetToZero();
  }, [animateSheetToZero, sheetTranslateY, windowHeight]);

  const closeFilterSheet = useCallback(() => {
    if (!showFilters || isClosingRef.current) {
      return;
    }
    console.log("[Filters] Closing sheet");
    isClosingRef.current = true;
    sheetScrollOffset.current = 0;
    sheetTranslateY.stopAnimation();
    Animated.timing(sheetTranslateY, {
      toValue: windowHeight,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setShowFilters(false);
      sheetTranslateY.setValue(0);
      isClosingRef.current = false;
    });
  }, [sheetTranslateY, windowHeight, showFilters]);

  useEffect(() => {
    if (showFilters) {
      openFilterSheet();
    } else {
      sheetTranslateY.setValue(0);
      sheetScrollOffset.current = 0;
      isClosingRef.current = false;
    }
  }, [openFilterSheet, sheetTranslateY, showFilters]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (sheetScrollOffset.current > 0) {
          return false;
        }
        const vertical = Math.abs(gestureState.dy);
        const horizontal = Math.abs(gestureState.dx);
        return vertical > horizontal && gestureState.dy > 6;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldClose = gestureState.dy > 140 || gestureState.vy > 0.9;
        if (shouldClose) {
          closeFilterSheet();
        } else {
          animateSheetToZero();
        }
      },
      onPanResponderTerminate: () => {
        animateSheetToZero();
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [animateSheetToZero, closeFilterSheet, sheetTranslateY]);

  const { currentUserId, resolvedProfile, getDisplayForProfile } = useProfile();
  const router = useRouter();
  const { notificationCount, adminNotificationCount, isAdmin } = useNotifications();
  const { trackSearch, trackOpportunityInteraction } = useActivityTracking();
  const trackOpportunityInteractionRef = useRef(trackOpportunityInteraction);

  useEffect(() => {
    trackOpportunityInteractionRef.current = trackOpportunityInteraction;
  }, [trackOpportunityInteraction]);

  const handleApplyFilters = useCallback(async () => {
    if (isApplyingFilters) {
      console.log("[Filters] Apply action ignored while pending");
      return;
    }
    setIsApplyingFilters(true);
    console.log("[Filters] Applying filters", {
      city,
      seekingRole,
      postedByRole,
      paymentStatus,
    });

    const filtersPayload: Record<string, unknown> = {};

    if (city.length > 0) {
      filtersPayload.cities = [...city];
    }
    if (seekingRole.length > 0) {
      filtersPayload.seeking_roles = [...seekingRole];
    }
    if (postedByRole.length > 0) {
      filtersPayload.posted_by_roles = [...postedByRole];
    }
    if (paymentStatus.length > 0) {
      filtersPayload.payment_status = [...paymentStatus];
    }

    if (Object.keys(filtersPayload).length === 0) {
      console.log("[Filters] No filters selected, skipping analytics");
      setIsApplyingFilters(false);
      closeFilterSheet();
      return;
    }

    const supabase = getSupabase();
    const locationValue = city.length === 1 ? city[0] : null;
    let resolvedUserId: string | null = currentUserId ?? null;

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.log("[Filters] Supabase auth getUser error", error);
        } else if (data?.user?.id) {
          resolvedUserId = data.user.id;
        }
      } catch (authError) {
        console.log("[Filters] Unexpected error fetching Supabase user", authError);
      }
    }

    const payload = {
      user_id: resolvedUserId,
      page: "opportunities",
      query: "filter_applied",
      filters: filtersPayload,
      location: locationValue,
    };

    try {
      if (supabase) {
        const { error: insertError } = await supabase.from("search_analytics").insert(payload);
        if (insertError) {
          throw insertError;
        }
        console.log("[Filters] Recorded analytics via Supabase client", payload);
      } else {
        await sbInsert("search_analytics", payload, "return=minimal");
        console.log("[Filters] Recorded analytics via REST helper", payload);
      }
    } catch (error) {
      console.log("[Filters] Failed to record filter analytics", error);
    } finally {
      setIsApplyingFilters(false);
      closeFilterSheet();
    }
  }, [city, seekingRole, postedByRole, paymentStatus, currentUserId, isApplyingFilters, closeFilterSheet]);

  const { data: blockedList } = trpc.block.listBlocked.useQuery(undefined, {
    enabled: !!currentUserId,
  });

  const blockedUserIds = useMemo(() => {
    return new Set((blockedList ?? []).map((b) => b.blocked_user_id));
  }, [blockedList]);

  const { data: applications } = useQuery<Record<string, { applied: boolean; status?: string }>>({
    queryKey: ["applied-ids", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return {};
      const apps = await sbSelect<{ opportunity_id: string; status?: string }>("applications", {
        select: "opportunity_id,status",
        query: { applicant_id: `eq.${currentUserId}` },
        limit: 1000,
      });
      return apps.reduce((acc, app) => {
        acc[app.opportunity_id] = { applied: true, status: app.status };
        return acc;
      }, {} as Record<string, { applied: boolean; status?: string }>);
    },
    enabled: !!currentUserId,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: savedIds } = useQuery<Set<string>>({
    queryKey: ["saved-ids", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return new Set<string>();
      const saves = await sbSelect<{ opportunity_id: string }>("saved_opportunities", {
        select: "opportunity_id",
        query: { user_id: `eq.${currentUserId}` },
        limit: 1000,
      });
      return new Set(saves.map((s) => s.opportunity_id));
    },
    enabled: !!currentUserId,
    placeholderData: new Set<string>(),
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const applyMutation = useMutation({
    mutationFn: async ({ opportunityId, note }: { opportunityId: string; note?: string }) => {
      if (!currentUserId) throw new Error("Must be logged in");
      trackOpportunityInteraction({ opportunity_id: opportunityId, interaction_type: "apply", metadata: { has_note: !!note } });
      await sbInsert("applications", {
        opportunity_id: opportunityId,
        applicant_id: currentUserId,
        note: note || null,
      });
      return opportunityId;
    },
    onSuccess: async (opportunityId) => {
      console.log("[Apply] Success, updating cache for opportunity:", opportunityId);
      
      queryClient.setQueryData<Set<string>>([
        "applied-ids",
        currentUserId,
      ], (old) => {
        return new Set([...(old ?? []), opportunityId]);
      });
      
      await queryClient.refetchQueries({ queryKey: ["applied-ids", currentUserId] });
    },
  });

  const unapplyMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      trackOpportunityInteraction({ opportunity_id: opportunityId, interaction_type: "unapply" });
      await sbDelete("applications", {
        opportunity_id: opportunityId,
        applicant_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: async () => {
      console.log("[Unapply] Success, invalidating queries");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["applied-ids", currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      queryClient.refetchQueries({ queryKey: ["applied-ids", currentUserId] });
      queryClient.refetchQueries({ queryKey: ["opportunities"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      trackOpportunityInteraction({ opportunity_id: opportunityId, interaction_type: "save" });
      await sbInsert("saved_opportunities", {
        opportunity_id: opportunityId,
        user_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: async () => {
      console.log("[Save] Success, invalidating queries");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["saved-ids", currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      queryClient.refetchQueries({ queryKey: ["saved-ids", currentUserId] });
      queryClient.refetchQueries({ queryKey: ["opportunities"] });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      trackOpportunityInteraction({ opportunity_id: opportunityId, interaction_type: "unsave" });
      await sbDelete("saved_opportunities", {
        opportunity_id: opportunityId,
        user_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: async () => {
      console.log("[Unsave] Success, invalidating queries");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["saved-ids", currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      queryClient.refetchQueries({ queryKey: ["saved-ids", currentUserId] });
      queryClient.refetchQueries({ queryKey: ["opportunities"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      console.log("[DeleteOpportunity] Deleting opportunity:", opportunityId);
      await sbDelete("opportunities", { id: opportunityId });
      return opportunityId;
    },
    onSuccess: () => {
      console.log("[DeleteOpportunity] Delete successful");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["applied-ids", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["saved-ids", currentUserId] });
    },
    onError: (error) => {
      console.error("[DeleteOpportunity] Delete failed:", error);
      alert("Failed to delete post. Please try again.");
    },
  });

  const { data: uniqueLocations } = useQuery<string[]>({
    queryKey: ["unique-locations"],
    queryFn: async () => {
      const allOpps = await sbSelect<OpportunityRow>("opportunities", {
        select: "location",
        limit: 5000,
      });
      const locationSet = new Set<string>();
      allOpps.forEach((opp) => {
        if (opp.location && opp.location.trim()) {
          locationSet.add(opp.location.trim());
        }
      });
      return Array.from(locationSet).sort();
    },
    staleTime: 60000,
  });

  const { data: opportunities, isLoading, error } = useQuery<OpportunityRow[]>({
    queryKey: ["opportunities", view, currentUserId ?? "anon"],
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    queryFn: async () => {
      switch (view) {
        case "all": {
          const rows = await sbSelect<OpportunityRow>("opportunities", {
            select: "*,profiles:user_id(*)",
            order: { column: "created_at", ascending: false },
            limit: 50,
          });
          return rows;
        }
        case "following": {
          if (!currentUserId) return [];
          const follows = await sbSelect<{ following_id: string }>("follows", {
            select: "following_id",
            query: { follower_id: `eq.${currentUserId}` },
            limit: 500,
          });
          const followingIds = follows.map((f) => f.following_id).filter(Boolean);
          if (followingIds.length === 0) return [];
          const idList = `in.(${followingIds.join(",")})`;
          const rows = await sbSelect<OpportunityRow>("opportunities", {
            select: "*,profiles:user_id(*)",
            query: { user_id: idList },
            order: { column: "created_at", ascending: false },
            limit: 200,
          });
          return rows;
        }
        case "posted": {
          if (!currentUserId) return [];
          const rows = await sbSelect<OpportunityRow>("opportunities", {
            select: "*,profiles:user_id(*)",
            query: { user_id: `eq.${currentUserId}` },
            order: { column: "created_at", ascending: false },
            limit: 50,
          });
          return rows;
        }
        case "applied": {
          if (!currentUserId) return [];
          const apps = await sbSelect<{ opportunity_id: string }>("applications", {
            select: "opportunity_id",
            query: { applicant_id: `eq.${currentUserId}` },
            limit: 200,
          });
          const ids = apps.map((a) => a.opportunity_id).filter(Boolean);
          if (ids.length === 0) return [];
          const idList = `in.(${ids.join(",")})`;
          const rows = await sbSelect<OpportunityRow>("opportunities", {
            select: "*,profiles:user_id(*)",
            query: { id: idList },
            order: { column: "created_at", ascending: false },
            limit: 200,
          });
          return rows;
        }
        case "saved": {
          if (!currentUserId) return [];
          const saves = await sbSelect<{ opportunity_id: string }>("saved_opportunities", {
            select: "opportunity_id",
            query: { user_id: `eq.${currentUserId}` },
            limit: 200,
          });
          const ids = saves.map((s) => s.opportunity_id).filter(Boolean);
          if (ids.length === 0) return [];
          const idList = `in.(${ids.join(",")})`;
          const rows = await sbSelect<OpportunityRow>("opportunities", {
            select: "*,profiles:user_id(*)",
            query: { id: idList },
            order: { column: "created_at", ascending: false },
            limit: 200,
          });
          return rows;
        }
      }
    },
  });

  const filteredOpportunities = useMemo<OpportunityRow[]>(() => {
    const normalizedSearch = normalizeFilterValue(searchQuery);
    const normalizedCities = city.map(normalizeFilterValue).filter(Boolean);
    const normalizedSeekingRoles = seekingRole.map(normalizeFilterValue).filter(Boolean);
    const normalizedPosterRoles = postedByRole.map(normalizeFilterValue).filter(Boolean);
    const normalizedPaymentStatuses = paymentStatus.map(normalizeFilterValue).filter(Boolean);

    const baseList = (opportunities ?? []).filter((opp) => {
      const userId = opp.profiles?.user_id ?? opp.user_id;
      return userId && !blockedUserIds.has(userId);
    });

    console.log("[Filter] Applying opportunities filters", {
      total: opportunities?.length ?? 0,
      baseCount: baseList.length,
      normalizedSearch,
      normalizedCities,
      normalizedSeekingRoles,
      normalizedPosterRoles,
      normalizedPaymentStatuses,
    });

    return baseList.filter((opp) => {
      const normalizedTitle = normalizeFilterValue(opp.title);
      const normalizedCompany = normalizeFilterValue(opp.company);
      const normalizedLocation = normalizeFilterValue(opp.location);
      const normalizedType = normalizeFilterValue(opp.type);
      const typeTokens = new Set(splitFilterTokens(opp.type));
      const profile = opp.profiles as ProfileRow | undefined;
      const normalizedProfession = normalizeFilterValue(profile?.profession);
      const professionTokens = new Set(splitFilterTokens(profile?.profession));
      const budgetRaw = opp.budget ?? "";
      const paymentCategory = classifyPaymentStatus(budgetRaw);

      if (normalizedSearch) {
        const matchesSearch =
          normalizedTitle.includes(normalizedSearch) ||
          normalizedCompany.includes(normalizedSearch) ||
          normalizedLocation.includes(normalizedSearch);
        if (!matchesSearch) {
          return false;
        }
      }

      if (normalizedCities.length > 0) {
        const matchesCity = normalizedCities.some((cityValue) =>
          normalizedLocation.includes(cityValue),
        );
        if (!matchesCity) {
          return false;
        }
      }

      if (normalizedSeekingRoles.length > 0) {
        const matchesSeeking = normalizedSeekingRoles.some((role) => {
          if (!role) return false;
          if (normalizedType === role) return true;
          if (normalizedType.includes(role)) return true;
          if (typeTokens.size === 0) return false;
          const roleTokens = role.split(" ");
          return roleTokens.every((token) => typeTokens.has(token));
        });
        if (!matchesSeeking) {
          return false;
        }
      }

      if (normalizedPosterRoles.length > 0) {
        const matchesPoster = normalizedPosterRoles.some((role) => {
          if (!role) return false;
          if (normalizedProfession === role) return true;
          if (normalizedProfession.includes(role)) return true;
          if (professionTokens.size === 0) return false;
          const roleTokens = role.split(" ");
          return roleTokens.every((token) => professionTokens.has(token));
        });
        if (!matchesPoster) {
          return false;
        }
      }

      if (normalizedPaymentStatuses.length > 0) {
        console.log("[Filter] Payment evaluation", {
          budgetRaw,
          paymentCategory,
          normalizedPaymentStatuses,
        });
        const matchesPayment = normalizedPaymentStatuses.some((status) => {
          if (status === "paid") {
            return paymentCategory === "paid" || paymentCategory === "mixed";
          }
          if (status === "unpaid") {
            return paymentCategory === "unpaid" || paymentCategory === "mixed";
          }
          return false;
        });
        if (!matchesPayment) {
          return false;
        }
      }

      return true;
    });
  }, [opportunities, blockedUserIds, searchQuery, city, seekingRole, paymentStatus, postedByRole]);

  const viewTimersRef = useRef<Record<string, number>>({});
  const viewedOnceRef = useRef<Set<string>>(new Set());

  const handleViewableItemsChanged = useMemo(() => {
    return ({ changed }: { changed: ViewToken[] }) => {
      const tracker = trackOpportunityInteractionRef.current;
      changed.forEach((item) => {
        const opportunity = item.item as OpportunityRow | undefined;
        const id = opportunity?.id;
        if (!id) {
          return;
        }
        if (item.isViewable) {
          viewTimersRef.current[id] = Date.now();
          if (!viewedOnceRef.current.has(id)) {
            if (tracker) {
              tracker({ opportunity_id: id, interaction_type: "view" });
            }
            viewedOnceRef.current.add(id);
          }
        } else {
          const start = viewTimersRef.current[id];
          if (typeof start === "number") {
            const duration = Math.max(0, Math.round((Date.now() - start) / 1000));
            if (duration > 0 && tracker) {
              tracker({
                opportunity_id: id,
                interaction_type: "view_duration",
                time_spent_seconds: duration,
              });
            }
            delete viewTimersRef.current[id];
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      const entries = Object.entries(viewTimersRef.current);
      entries.forEach(([id, start]) => {
        const duration = Math.max(0, Math.round((Date.now() - start) / 1000));
        if (duration > 0) {
          trackOpportunityInteraction({
            opportunity_id: id,
            interaction_type: "view_duration",
            time_spent_seconds: duration,
          });
        }
      });
      viewTimersRef.current = {};
    };
  }, [trackOpportunityInteraction]);

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);

  return (
    <View style={container} testID="opportunities-screen">
      <GrainTexture />
      <View style={styles.topBar}>
        <Pressable style={styles.topProfile} testID="opp-top-profile" onPress={() => router.push("/profile/edit") }>
          <Image
            source={{ uri: resolvedProfile.avatarUrl }}
            style={styles.topAvatar}
          />
          <Text style={styles.topName}>{resolvedProfile.displayName}</Text>
        </Pressable>

        <View style={styles.topIcons}>
          <Pressable onPress={() => setSearchVisible((s) => !s)} style={styles.iconBtn} testID="opp-top-search">
            <Search color="#E5E7EB" size={20} />
          </Pressable>
          <View style={styles.iconBadgeWrap}>
            <Pressable onPress={() => router.push("/notifications")} style={styles.iconBtn} testID="opp-top-bell">
              <Bell color="#E5E7EB" size={20} />
            </Pressable>
            {(notificationCount ?? 0) > 0 && (
              <View style={styles.notificationBadge} testID="notification-badge">
                <Text style={styles.notificationBadgeText}>
                  {(notificationCount ?? 0) > 99 ? "99+" : String(notificationCount ?? 0)}
                </Text>
              </View>
            )}
          </View>
          {isAdmin ? (
            <View style={styles.iconBadgeWrap}>
              <Pressable onPress={() => router.push("/admin")} style={styles.iconBtn} testID="opp-top-admin">
                <ShieldCheck color="#34D399" size={20} />
              </Pressable>
              {(adminNotificationCount ?? 0) > 0 && (
                <View style={styles.adminBadge} testID="admin-badge">
                  <Text style={styles.adminBadgeText}>
                    {(adminNotificationCount ?? 0) > 99 ? "99+" : String(adminNotificationCount ?? 0)}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.header}>
        <Pressable style={styles.viewSelector} onPress={() => setViewMenuOpen((s) => !s)} testID="opp-view-toggle">
          {(() => {
            const opt = VIEW_OPTIONS.find((o) => o.key === view);
            return opt ? React.createElement(opt.Icon, { color: "#E5E7EB", size: 16 }) : null;
          })()}
          <Text style={styles.viewSelectorText}>{VIEW_OPTIONS.find((o) => o.key === view)?.label ?? "All Opportunities"}</Text>
          <ChevronDown color="#E5E7EB" size={16} />
        </Pressable>

        <Pressable style={styles.filterBtn} onPress={() => setShowFilters(true)} testID="opp-filter">
          <Filter color="#E5E7EB" size={18} />
          <Text style={styles.filterText}>Filters</Text>
          {(() => {
            const activeCount = city.length + seekingRole.length + postedByRole.length + paymentStatus.length;
            return activeCount > 0 ? (
              <View style={styles.filterBadge} testID="opp-filter-badge">
                <Text style={styles.filterBadgeText}>{activeCount}</Text>
              </View>
            ) : null;
          })()}
        </Pressable>
      </View>

      {searchVisible && (
        <View style={styles.searchRow}>
          <Search color="#9CA3AF" size={16} />
          <TextInput
            placeholder="Search title, company, or location"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => {
              const trimmed = searchQuery.trim();
              if (trimmed) {
                trackSearch({
                  page: "opportunities_search",
                  query: trimmed,
                  resultsCount: filteredOpportunities.length,
                });
              }
            }}
            testID="opp-search-input"
          />
        </View>
      )}

      {isLoading && (
        <View style={styles.loaderRow} testID="opps-loading">
          <ActivityIndicator color="#E5E7EB" />
        </View>
      )}
      {!!error && (
        <Text style={styles.errorText} testID="opps-error">Failed to load opportunities</Text>
      )}

      {viewMenuOpen && (
        <View style={styles.viewMenu} testID="opp-view-menu">
          {VIEW_OPTIONS.map(({ key, label, Icon }) => (
            <Pressable
              key={key}
              style={[styles.viewItem, view === key && styles.viewItemActive]}
              onPress={() => {
                setView(key);
                setViewMenuOpen(false);
              }}
              testID={`opp-view-${key}`}
            >
              <Icon color="#E5E7EB" size={16} />
              <Text style={styles.viewItemText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={filteredOpportunities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => {
          const title = item.title ?? "";
          const display = getDisplayForProfile(item.profiles);
          const imageUri = item.cover_image ?? (item as any).image_url;
          return (
            <View style={styles.card} testID={`opp-${item.id}`}>
              <Pressable style={styles.postHeader} onPress={() => { const uid = item.profiles?.user_id ?? item.user_id; if (uid) { router.push({ pathname: "/profile/[userId]", params: { userId: uid } }); } }} testID={`opp-user-${item.profiles?.user_id ?? item.user_id}`}>
                <Image key={item.profiles?.user_id ?? item.user_id} source={{ uri: display.avatarUrl }} style={styles.postAvatar} />
                <View style={styles.postHeaderInfo}>
                  <Text numberOfLines={1} style={styles.postUsername}>{display.displayName}</Text>
                  {item.profiles?.profession && (
                    <Text numberOfLines={1} style={styles.postProfession}>{item.profiles.profession.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                  )}
                  <Text numberOfLines={1} style={styles.postTime}>{formatRelativeTime(item.created_at)}</Text>
                </View>
                {item.user_id === currentUserId && (
                  <Pressable
                    style={styles.moreBtn}
                    onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                    testID={`more-${item.id}`}
                  >
                    <MoreVertical color="#9CA3AF" size={20} />
                  </Pressable>
                )}
                {(() => {
                  const profile = item.profiles as ProfileRow | undefined;
                  console.log(`[OpportunityCard] Checking social links for ${profile?.username}:`, profile?.social_links);
                  
                  const hasInstagram = profile?.social_links?.instagram && profile.social_links.instagram.trim();
                  const hasTwitter = profile?.social_links?.twitter && profile.social_links.twitter.trim();
                  const hasYoutube = profile?.social_links?.youtube && profile.social_links.youtube.trim();
                  const hasTiktok = profile?.social_links?.tiktok && profile.social_links.tiktok.trim();
                  const hasAnySocial = hasInstagram || hasTwitter || hasYoutube || hasTiktok;
                  
                  console.log(`[OpportunityCard] Social presence for ${profile?.username}:`, { hasInstagram, hasTwitter, hasYoutube, hasTiktok, hasAnySocial });
                  
                  if (!hasAnySocial) return null;
                  
                  return (
                    <View style={styles.socialIcons}>
                      {hasInstagram && (
                        <Pressable
                          onPress={() => {
                            const url = profile?.social_links?.instagram ?? "";
                            const fullUrl = url.startsWith("http") ? url : `https://instagram.com/${url.replace(/^@/, "")}`;
                            console.log(`[OpportunityCard] Opening Instagram:`, fullUrl);
                            if (Platform.OS === "web" && typeof window !== "undefined") {
                              (window as any).open(fullUrl, "_blank");
                            } else {
                              Linking.openURL(fullUrl).catch(() => {});
                            }
                          }}
                          style={styles.socialIconBtn}
                          testID={`social-instagram-link-${item.id}`}
                        >
                          <Instagram color="#C13584" size={16} />
                        </Pressable>
                      )}
                      {hasYoutube && (
                        <Pressable
                          onPress={() => {
                            const url = profile?.social_links?.youtube ?? "";
                            const fullUrl = url.startsWith("http") ? url : `https://youtube.com/@${url.replace(/^@/, "")}`;
                            if (Platform.OS === "web" && typeof window !== "undefined") {
                              (window as any).open(fullUrl, "_blank");
                            } else {
                              Linking.openURL(fullUrl).catch(() => {});
                            }
                          }}
                          style={styles.socialIconBtn}
                          testID={`social-youtube-${item.id}`}
                        >
                          <Youtube color="#FF0000" size={16} />
                        </Pressable>
                      )}
                      {hasTwitter && (
                        <Pressable
                          onPress={() => {
                            const url = profile?.social_links?.twitter ?? "";
                            const fullUrl = url.startsWith("http") ? url : `https://twitter.com/${url.replace(/^@/, "")}`;
                            if (Platform.OS === "web" && typeof window !== "undefined") {
                              (window as any).open(fullUrl, "_blank");
                            } else {
                              Linking.openURL(fullUrl).catch(() => {});
                            }
                          }}
                          style={styles.socialIconBtn}
                          testID={`social-twitter-${item.id}`}
                        >
                          <Twitter color="#1DA1F2" size={16} />
                        </Pressable>
                      )}
                      {hasTiktok && (
                        <Pressable
                          onPress={() => {
                            const url = profile?.social_links?.tiktok ?? "";
                            const fullUrl = url.startsWith("http") ? url : `https://tiktok.com/@${url.replace(/^@/, "")}`;
                            if (Platform.OS === "web" && typeof window !== "undefined") {
                              (window as any).open(fullUrl, "_blank");
                            } else {
                              Linking.openURL(fullUrl).catch(() => {});
                            }
                          }}
                          style={styles.socialIconBtn}
                          testID={`social-tiktok-${item.id}`}
                        >
                          <View style={styles.tiktokIcon}>
                            <Text style={styles.tiktokIconText}>♪</Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  );
                })()}
              </Pressable>

              {menuOpenId === item.id && item.user_id === currentUserId && (
                <View style={styles.actionMenu}>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => {
                      if (Platform.OS === "web") {
                        if (confirm("Are you sure you want to delete this post?")) {
                          deleteMutation.mutate(item.id);
                          setMenuOpenId(null);
                        }
                      } else {
                        deleteMutation.mutate(item.id);
                        setMenuOpenId(null);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    testID={`delete-${item.id}`}
                  >
                    {deleteMutation.isPending ? (
                      <ActivityIndicator color="#EF4444" size="small" />
                    ) : (
                      <>
                        <Trash2 color="#EF4444" size={16} />
                        <Text style={styles.deleteBtnText}>Delete Post</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {imageUri && (
                <View style={styles.mediaWrap}>
                  <Image source={{ uri: imageUri }} style={styles.cover} resizeMode="cover" />
                </View>
              )}

              <View style={styles.body}>
                {!!title && (
                  <Text numberOfLines={2} style={styles.caption}>{title}</Text>
                )}
                {!!item.description && (
                  <Text numberOfLines={3} style={styles.description}>{item.description}</Text>
                )}
                <View style={styles.metaRow}>
                  {!!item.type && (
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeText}>{item.type}</Text>
                    </View>
                  )}
                  {!!item.location && (
                    <Text style={styles.metaText}>📍 {item.location}</Text>
                  )}
                </View>
                {item.budget && (
                  <View style={styles.budgetRow}>
                    <View style={item.budget.toLowerCase().includes('unpaid') ? styles.unpaidBadge : styles.paidBadge}>
                      <Text style={item.budget.toLowerCase().includes('unpaid') ? styles.unpaidBadgeText : styles.paidBadgeText}>
                        {formatBudget(item.budget)}
                      </Text>
                    </View>
                  </View>
                )}
                {item.requirements && item.requirements.length > 0 && (
                  <View style={styles.requirementsSection}>
                    <Text style={styles.requirementsTitle}>Requirements:</Text>
                    {item.requirements.map((req, idx) => (
                      <Text key={idx} style={styles.requirementItem}>• {req}</Text>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.footerRow}>
                {(item.user_id !== currentUserId) && (() => {
                  const appInfo = applications?.[item.id];
                  const isApproved = appInfo?.status === "approved";
                  const isRejected = appInfo?.status === "rejected";
                  const isApplied = appInfo?.applied;
                  return (
                  <View style={styles.actionButtons}>
                    <Pressable
                      style={[styles.actionBtn, (isApplied || isApproved) && styles.actionBtnActive, isRejected && styles.actionBtnRejected]}
                      onPress={() => {
                        if (!currentUserId) {
                          console.log("Must be logged in to apply");
                          return;
                        }
                        if (isApproved) {
                          console.log("Cannot unapply from approved opportunity");
                          return;
                        }
                        if (isRejected) {
                          console.log("Cannot unapply from rejected opportunity");
                          return;
                        }
                        if (isApplied) {
                          unapplyMutation.mutate(item.id);
                        } else {
                          setSelectedOpportunityId(item.id);
                          setApplyModalVisible(true);
                        }
                      }}
                      disabled={applyMutation.isPending || unapplyMutation.isPending || isApproved || isRejected}
                      testID={`apply-${item.id}`}
                    >
                      <CheckCircle2 color={isRejected ? "#EF4444" : ((isApplied || isApproved) ? "#4CB963" : "#E5E7EB")} size={16} />
                      <Text style={[styles.actionText, (isApplied || isApproved) && styles.actionTextActive, isRejected && styles.actionTextRejected]}>
                        {isApproved ? "Approved" : isRejected ? "Rejected" : isApplied ? "Applied" : "Apply"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, savedIds?.has(item.id) && styles.actionBtnActive]}
                      onPress={() => {
                        if (!currentUserId) {
                          console.log("Must be logged in to save");
                          return;
                        }
                        if (savedIds?.has(item.id)) {
                          unsaveMutation.mutate(item.id);
                        } else {
                          saveMutation.mutate(item.id);
                        }
                      }}
                      disabled={saveMutation.isPending || unsaveMutation.isPending}
                      testID={`save-${item.id}`}
                    >
                      <Bookmark color={savedIds?.has(item.id) ? "#F59E0B" : "#E5E7EB"} size={16} fill={savedIds?.has(item.id) ? "#F59E0B" : "transparent"} />
                      <Text style={[styles.actionText, savedIds?.has(item.id) && styles.actionTextSaved]}>
                        {savedIds?.has(item.id) ? "Saved" : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                  );
                })()}
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={showFilters}
        transparent
        animationType={Platform.OS === "web" ? "fade" : "none"}
        onRequestClose={closeFilterSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeFilterSheet} testID="filters-backdrop" />
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
          testID="filters-sheet"
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filter Opportunities</Text>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            onScroll={handleSheetScroll}
            scrollEventThrottle={16}
          >
            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.locationChips}>
              {(uniqueLocations ?? []).map((loc) => {
                const isSelected = city.includes(loc);
                return (
                  <Pressable
                    key={loc}
                    style={[
                      styles.locationChip,
                      isSelected && styles.locationChipActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setCity(city.filter(c => c !== loc));
                      } else {
                        setCity([...city, loc]);
                      }
                    }}
                    testID={`location-${loc}`}
                  >
                    <Text
                      style={[
                        styles.locationChipText,
                        isSelected && styles.locationChipTextActive,
                      ]}
                    >
                      {loc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Seeking a</Text>
            <View style={styles.locationChips}>
              {ROLE_SECTIONS.flatMap(sec => sec.options).map((opt) => {
                const isSelected = seekingRole.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.locationChip,
                      isSelected && styles.locationChipActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSeekingRole(seekingRole.filter(r => r !== opt.value));
                      } else {
                        setSeekingRole([...seekingRole, opt.value]);
                      }
                    }}
                    testID={`seeking-${opt.value}`}
                  >
                    <Text
                      style={[
                        styles.locationChipText,
                        isSelected && styles.locationChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Posted by a</Text>
            <View style={styles.locationChips}>
              {ROLE_SECTIONS.flatMap(sec => sec.options).map((opt) => {
                const isSelected = postedByRole.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.locationChip,
                      isSelected && styles.locationChipActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setPostedByRole(postedByRole.filter(r => r !== opt.value));
                      } else {
                        setPostedByRole([...postedByRole, opt.value]);
                      }
                    }}
                    testID={`postedby-${opt.value}`}
                  >
                    <Text
                      style={[
                        styles.locationChipText,
                        isSelected && styles.locationChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Payment Status</Text>
            <View style={styles.locationChips}>
              {[
                { label: "Paid Only", value: "paid" },
                { label: "Unpaid Only", value: "unpaid" },
              ].map((opt) => {
                const isSelected = paymentStatus.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.locationChip,
                      isSelected && styles.locationChipActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setPaymentStatus([]);
                      } else {
                        setPaymentStatus([opt.value]);
                      }
                    }}
                    testID={`payment-${opt.value}`}
                  >
                    <Text
                      style={[
                        styles.locationChipText,
                        isSelected && styles.locationChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <Pressable
              style={styles.resetBtn}
              onPress={() => {
                setCity([]);
                setSeekingRole([]);
                setPostedByRole([]);
                setPaymentStatus([]);
              }}
              testID="filters-reset"
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
            <Pressable
              style={[styles.applyFiltersBtn, isApplyingFilters && styles.applyFiltersBtnDisabled]}
              onPress={handleApplyFilters}
              disabled={isApplyingFilters}
              testID="filters-apply"
            >
              {isApplyingFilters ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.applyFiltersText}>Apply</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Modal>

      <Modal
        visible={applyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setApplyModalVisible(false);
          setApplicationNote("");
        }}
      >
        <Pressable 
          style={styles.backdrop} 
          onPress={() => {
            setApplyModalVisible(false);
            setApplicationNote("");
          }} 
          testID="apply-modal-backdrop" 
        />
        <View style={styles.applyModal} testID="apply-modal">
          <View style={styles.applyModalContent}>
            <Text style={styles.applyModalTitle}>Apply to Opportunity</Text>
            <Text style={styles.applyModalSubtitle}>Add an optional note to your application</Text>
            
            <TextInput
              style={styles.applyModalInput}
              placeholder="Tell them why you're a great fit... (optional)"
              placeholderTextColor="#6B7280"
              value={applicationNote}
              onChangeText={setApplicationNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              testID="apply-note-input"
            />

            <View style={styles.applyModalActions}>
              <Pressable
                style={styles.applyModalCancelBtn}
                onPress={() => {
                  setApplyModalVisible(false);
                  setApplicationNote("");
                }}
                testID="apply-cancel"
              >
                <Text style={styles.applyModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.applyModalSubmitBtn}
                onPress={async () => {
                  if (selectedOpportunityId) {
                    await applyMutation.mutateAsync({ 
                      opportunityId: selectedOpportunityId, 
                      note: applicationNote.trim() || undefined 
                    });
                    setApplyModalVisible(false);
                    setApplicationNote("");
                    setSelectedOpportunityId(null);
                  }
                }}
                disabled={applyMutation.isPending}
                testID="apply-submit"
              >
                {applyMutation.isPending ? (
                  <ActivityIndicator color="#0B0B0F" size="small" />
                ) : (
                  <Text style={styles.applyModalSubmitText}>Apply</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}



const ROLE_SECTIONS: { title?: string; options: { label: string; value: string }[] }[] = [
  {
    title: "Creatives",
    options: [
      { label: "Photographer", value: "photographer" },
      { label: "Model", value: "model" },
      { label: "Videographer", value: "videographer" },
      { label: "Content Creator", value: "content_creator" },
      { label: "Stylist", value: "stylist" },
      { label: "Designer", value: "designer" },
      { label: "Creative Director", value: "creative_director" },
    ],
  },
  {
    title: "Business",
    options: [
      { label: "Clothing Brand", value: "clothing_brand" },
      { label: "Agency", value: "agency" },
      { label: "Publisher", value: "publisher" },
      { label: "Photography Business", value: "photography_business" },
      { label: "Other", value: "other_business" },
    ],
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topProfile: { flexDirection: "row", alignItems: "center", gap: 10 as const },
  topAvatar: { width: 28, height: 28, borderRadius: 14 },
  topName: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" },
  topIcons: { flexDirection: "row", alignItems: "center", gap: 4 as const },
  iconBtn: { padding: 8, borderRadius: 999 },
  iconBadgeWrap: { position: "relative" as const },
  notificationBadge: {
    position: "absolute" as const,
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#000000",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800" as const,
    lineHeight: 12,
  },
  adminBadge: {
    position: "absolute" as const,
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#000000",
  },
  adminBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "800" as const,
    lineHeight: 12,
  },

  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8 as const,
  },
  h1: { color: "#E5E7EB", fontSize: 24, fontWeight: "900" },
  viewSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as const,
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderColor: "#404040",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewSelectorText: { color: "#E5E7EB", fontSize: 14, fontWeight: "800", flex: 1 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as const,
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderColor: "#404040",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700" },
  filterBadge: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#4CB963", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText: { color: "#000000", fontSize: 11, fontWeight: "900" },
  viewMenu: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: "rgba(20, 20, 20, 0.9)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#404040",
    overflow: "hidden",
  },
  viewItem: { flexDirection: "row", alignItems: "center", gap: 10 as const, paddingHorizontal: 12, paddingVertical: 12 },
  viewItemActive: { backgroundColor: "#16161D" },
  viewItemText: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  list: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "rgba(15, 15, 15, 0.9)",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 as const, paddingHorizontal: 12, paddingTop: 12 },
  socialIcons: { flexDirection: "row", alignItems: "center", gap: 8 as const, marginLeft: "auto" as const },
  socialIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(20, 20, 20, 0.85)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#404040" },
  postAvatar: { width: 32, height: 32, borderRadius: 16 },
  postHeaderInfo: { flex: 1 },
  postUsername: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" },
  postProfession: { color: "#9CA3AF", fontSize: 11, fontWeight: "600", textTransform: "capitalize" as const },
  postTime: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
  mediaWrap: { paddingHorizontal: 8, paddingTop: 6 },
  cover: { width: "100%", height: 320, borderRadius: 14 },
  body: { paddingHorizontal: 12, paddingVertical: 10 },
  caption: { color: "#E5E7EB", fontSize: 18, fontWeight: "900", marginBottom: 6 },
  description: { color: "#D1D5DB", fontSize: 14, fontWeight: "400", lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" },
  metaBadge: { 
    backgroundColor: "#1E40AF", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  metaBadgeText: { color: "#BFDBFE", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  metaText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  paidBadge: {
    backgroundColor: "#065F46",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paidBadgeText: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  unpaidBadge: {
    backgroundColor: "#7C2D12",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unpaidBadgeText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  priceLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  priceValue: { color: "#10B981", fontSize: 14, fontWeight: "800" },
  requirementsSection: { marginTop: 8, gap: 4 },
  requirementsTitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  requirementItem: { color: "#D1D5DB", fontSize: 13, fontWeight: "400", lineHeight: 18 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 12, marginTop: 4, marginBottom: 10 },
  actionButtons: { flexDirection: "row", alignItems: "center", gap: 10 as const },
  actionBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 7 as const, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    backgroundColor: "#1A1A24", 
    borderWidth: 1.5, 
    borderColor: "#2A2A38",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnActive: { 
    backgroundColor: "#1A1A24", 
    borderColor: "#4CB963",
    borderWidth: 2,
    shadowColor: "#4CB963",
    shadowOpacity: 0.25,
  },
  actionBtnRejected: {
    backgroundColor: "#1A1A24",
    borderColor: "#EF4444",
    borderWidth: 2,
    shadowColor: "#EF4444",
    shadowOpacity: 0.25,
  },
  actionText: { color: "#D1D5DB", fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  actionTextActive: { color: "#4CB963", fontWeight: "800" },
  actionTextRejected: { color: "#EF4444", fontWeight: "800" },
  actionTextSaved: { color: "#FFFFFF", fontWeight: "800" },
  loaderRow: { paddingVertical: 10, alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: "#404040",
    maxHeight: Dimensions.get("window").height * 0.9,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#404040", marginBottom: 8 },
  sheetTitle: { color: "#E5E7EB", fontSize: 18, fontWeight: "900", marginBottom: 12 },
  sheetScroll: { maxHeight: Dimensions.get("window").height * 0.9 - 100 },
  sheetScrollContent: { paddingBottom: 8 },
  fieldLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "800", marginTop: 6, marginBottom: 6, letterSpacing: 0.4 },
  textFieldWrap: { backgroundColor: "rgba(20, 20, 20, 0.85)", borderColor: "#404040", borderWidth: 1, borderRadius: 10 },
  textField: { color: "#E5E7EB", fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 },
  sheetActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  resetBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(20, 20, 20, 0.85)", borderColor: "#404040", borderWidth: 1 },
  resetText: { color: "#9CA3AF", fontSize: 13, fontWeight: "700" },
  applyFiltersBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#E5E7EB" },
  applyFiltersBtnDisabled: { opacity: 0.7 },
  applyFiltersText: { color: "#000000", fontSize: 14, fontWeight: "900" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 as const, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, backgroundColor: "rgba(20, 20, 20, 0.85)", borderColor: "#404040", borderWidth: 1, borderRadius: 10, color: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  ddContainer: { marginBottom: 10 },
  ddHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(20, 20, 20, 0.85)", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#404040" },
  ddLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  ddMenu: { marginTop: 8, backgroundColor: "rgba(20, 20, 20, 0.85)", borderRadius: 10, borderWidth: 1, borderColor: "#404040" },
  ddMenuHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomColor: "#404040", borderBottomWidth: 1 },
  ddMenuTitle: { color: "#E5E7EB", fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  ddCollapseBtn: { padding: 6, borderRadius: 8 },
  ddScrollContent: { paddingBottom: 8 },
  ddSectionLabel: { color: "#9CA3AF", fontSize: 11, fontWeight: "800", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, letterSpacing: 0.6 },
  ddItem: { paddingVertical: 12, paddingHorizontal: 12 },
  ddItemText: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" },
  moreBtn: {
    padding: 4,
    marginLeft: "auto" as const,
  },
  actionMenu: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: "rgba(20, 20, 20, 0.85)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#404040",
    overflow: "hidden",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10 as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
  },
  locationChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8 as const,
    marginBottom: 8,
  },
  locationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(20, 20, 20, 0.85)",
    borderWidth: 1.5,
    borderColor: "#404040",
  },
  locationChipActive: {
    backgroundColor: "#1E3A2E",
    borderColor: "#4CB963",
  },
  locationChipText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "700",
  },
  locationChipTextActive: {
    color: "#4CB963",
    fontWeight: "800",
  },
  tiktokIcon: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tiktokIconText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "900",
  },
  applyModal: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  applyModalContent: {
    backgroundColor: "rgba(15, 15, 15, 0.98)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#404040",
  },
  applyModalTitle: {
    color: "#E5E7EB",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  applyModalSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 20,
  },
  applyModalInput: {
    backgroundColor: "#14141C",
    borderColor: "#404040",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#E5E7EB",
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
  },
  applyModalActions: {
    flexDirection: "row",
    gap: 12 as const,
  },
  applyModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(20, 20, 20, 0.85)",
    borderColor: "#404040",
    borderWidth: 1,
    alignItems: "center",
  },
  applyModalCancelText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
  },
  applyModalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  applyModalSubmitText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "900",
  },
});