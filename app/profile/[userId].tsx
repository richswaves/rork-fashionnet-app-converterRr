import React, { useMemo, useState, useRef, useEffect } from "react";
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, Dimensions, Animated, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Stack, useLocalSearchParams } from "expo-router";
import { MapPin, Instagram, Youtube, Twitter, Music2, ChevronDown, ChevronUp, CheckCircle2, Bookmark, Play, Ban, Flag } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { sbSelect, getSupabase, sbInsert, sbDelete } from "@/integrations/supabase/client";
import type { PortfolioItem } from "@/integrations/supabase/portfolio-types";
import { useProfile } from "@/contexts/ProfileContext";

interface ProfileRow {
  user_id: string;
  full_name?: string;
  username?: string;
  profile_picture?: string;
  location?: string | null;
  bio?: string | null;
  model_photos?: string[] | null;
  portfolio_photos?: string[] | null;
  profile_customization?: {
    backgroundType?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundImageAdjustments?: { positionX?: number; positionY?: number };
    theme?: string;
    typographyColor?: string;
  } | null;
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
  image_url?: string | null;
  images?: (string | { url?: string | null })[] | null;
  media?: { url?: string | null; type?: string | null }[] | null;
  created_at?: string;
  user_id?: string;
  description?: string | null;
  budget?: string | null;
  requirements?: string[] | null;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { getDisplayForProfile, currentUserId, updateProfileAsync } = useProfile();
  const [opportunitiesExpanded, setOpportunitiesExpanded] = useState<boolean>(true);
  const [portfolioExpanded, setPortfolioExpanded] = useState<boolean>(true);

  const opportunitiesAnimHeight = useRef(new Animated.Value(1)).current;
  const opportunitiesAnimOpacity = useRef(new Animated.Value(1)).current;
  const portfolioAnimHeight = useRef(new Animated.Value(1)).current;
  const portfolioAnimOpacity = useRef(new Animated.Value(1)).current;

  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>("");

  const { data: isBlocked } = useQuery<boolean>({
    queryKey: ["is-blocked", currentUserId, userId],
    queryFn: async () => {
      if (!currentUserId || !userId || currentUserId === userId) return false;
      try {
        const rows = await sbSelect<{ id: string }>("blocked_users", {
          select: "id",
          query: { blocker_id: `eq.${currentUserId}`, blocked_id: `eq.${userId}` },
          limit: 1,
        });
        return rows.length > 0;
      } catch (error: any) {
        console.log("[Block] Table may not exist yet:", error?.message);
        return false;
      }
    },
    enabled: !!currentUserId && !!userId && currentUserId !== userId,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opportunitiesAnimHeight, {
        toValue: opportunitiesExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opportunitiesAnimOpacity, {
        toValue: opportunitiesExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [opportunitiesExpanded]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(portfolioAnimHeight, {
        toValue: portfolioExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(portfolioAnimOpacity, {
        toValue: portfolioExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [portfolioExpanded]);

  const { data, isLoading, error } = useQuery<ProfileRow | null>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const rows = await sbSelect<ProfileRow>("profiles", {
        select: "*",
        query: { user_id: `eq.${userId}` },
        limit: 1,
      });
      return rows[0] ?? null;
    },
    enabled: !!userId,
  });

  const display = useMemo(() => getDisplayForProfile(data ?? undefined), [data, getDisplayForProfile]);

  const { data: userOpps } = useQuery<OpportunityRow[]>({
    queryKey: ["profile-opportunities", userId],
    queryFn: async () => {
      if (!userId) return [] as OpportunityRow[];
      const rows = await sbSelect<OpportunityRow>("opportunities", {
        select: "*",
        query: { user_id: `eq.${userId}` },
        order: { column: "created_at", ascending: false },
        limit: 50,
      });
      return rows;
    },
    enabled: !!userId,
  });

  const { data: appliedIds } = useQuery<Set<string>>({
    queryKey: ["applied-ids", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return new Set<string>();
      const apps = await sbSelect<{ opportunity_id: string }>("applications", {
        select: "opportunity_id",
        query: { applicant_id: `eq.${currentUserId}` },
        limit: 1000,
      });
      return new Set(apps.map((a) => a.opportunity_id));
    },
    enabled: !!currentUserId,
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
  });

  const { data: isFollowing } = useQuery<boolean>({
    queryKey: ["is-following", currentUserId, userId],
    queryFn: async () => {
      if (!currentUserId || !userId || currentUserId === userId) return false;
      const rows = await sbSelect<{ id: string }>("follows", {
        select: "id",
        query: { follower_id: `eq.${currentUserId}`, following_id: `eq.${userId}` },
        limit: 1,
      });
      return rows.length > 0;
    },
    enabled: !!currentUserId && !!userId && currentUserId !== userId,
  });

  const { data: followerCount } = useQuery<number>({
    queryKey: ["follower-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const rows = await sbSelect<{ id: string }>("follows", {
        select: "id",
        query: { following_id: `eq.${userId}` },
        limit: 1000,
      });
      return rows.length;
    },
    enabled: !!userId,
  });

  const { data: followingCount } = useQuery<number>({
    queryKey: ["following-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const rows = await sbSelect<{ id: string }>("follows", {
        select: "id",
        query: { follower_id: `eq.${userId}` },
        limit: 1000,
      });
      return rows.length;
    },
    enabled: !!userId,
  });

  const { data: portfolioItems = [] } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", userId],
    queryFn: async () => {
      if (!userId) return [];
      const items = await sbSelect<PortfolioItem>("portfolio_items", {
        select: "*",
        query: { user_id: `eq.${userId}` },
        order: { column: "created_at", ascending: false },
      });
      return items;
    },
    enabled: !!userId,
  });

  const applyMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      await sbInsert("applications", {
        opportunity_id: opportunityId,
        applicant_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applied-ids", currentUserId] });
    },
  });

  const unapplyMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      await sbDelete("applications", {
        opportunity_id: opportunityId,
        applicant_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applied-ids", currentUserId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      await sbInsert("saved_opportunities", {
        opportunity_id: opportunityId,
        user_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-ids", currentUserId] });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      await sbDelete("saved_opportunities", {
        opportunity_id: opportunityId,
        user_id: currentUserId,
      });
      return opportunityId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-ids", currentUserId] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!userId) throw new Error("No user to follow");
      if (currentUserId === userId) throw new Error("Cannot follow yourself");
      
      console.log(`[Follow] User ${currentUserId} following user ${userId}`);
      await sbInsert("follows", {
        follower_id: currentUserId,
        following_id: userId,
      });
    },
    onSuccess: () => {
      console.log("[Follow] Successfully followed user");
      queryClient.invalidateQueries({ queryKey: ["is-following", currentUserId, userId] });
      queryClient.invalidateQueries({ queryKey: ["follower-count", userId] });
      queryClient.invalidateQueries({ queryKey: ["following-count", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-follows", userId] });
    },
    onError: (error) => {
      console.error("[Follow] Error following user:", error);
      Alert.alert("Error", "Failed to follow user");
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!userId) throw new Error("No user to unfollow");
      
      console.log(`[Follow] User ${currentUserId} unfollowing user ${userId}`);
      await sbDelete("follows", {
        follower_id: currentUserId,
        following_id: userId,
      });
    },
    onSuccess: () => {
      console.log("[Follow] Successfully unfollowed user");
      queryClient.invalidateQueries({ queryKey: ["is-following", currentUserId, userId] });
      queryClient.invalidateQueries({ queryKey: ["follower-count", userId] });
      queryClient.invalidateQueries({ queryKey: ["following-count", currentUserId] });
    },
    onError: (error) => {
      console.error("[Follow] Error unfollowing user:", error);
      Alert.alert("Error", "Failed to unfollow user");
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!userId) throw new Error("No user to block");
      if (currentUserId === userId) throw new Error("Cannot block yourself");
      
      console.log(`[Block] User ${currentUserId} blocking user ${userId}`);
      await sbInsert("blocked_users", {
        blocker_id: currentUserId,
        blocked_id: userId,
      });
    },
    onSuccess: () => {
      console.log("[Block] Successfully blocked user");
      queryClient.invalidateQueries({ queryKey: ["is-blocked", currentUserId, userId] });
      Alert.alert("Success", "User blocked");
    },
    onError: (error) => {
      console.error("[Block] Error blocking user:", error);
      Alert.alert("Error", "Failed to block user");
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!userId) throw new Error("No user to unblock");
      
      console.log(`[Block] User ${currentUserId} unblocking user ${userId}`);
      await sbDelete("blocked_users", {
        blocker_id: currentUserId,
        blocked_id: userId,
      });
    },
    onSuccess: () => {
      console.log("[Block] Successfully unblocked user");
      queryClient.invalidateQueries({ queryKey: ["is-blocked", currentUserId, userId] });
      Alert.alert("Success", "User unblocked");
    },
    onError: (error) => {
      console.error("[Block] Error unblocking user:", error);
      Alert.alert("Error", "Failed to unblock user");
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!userId) throw new Error("No user to report");
      if (!reason || reason.trim().length === 0) throw new Error("Reason is required");
      
      console.log(`[Report] User ${currentUserId} reporting user ${userId}`);
      console.log(`[Report] Reason: ${reason.trim()}`);
      
      try {
        const result = await sbInsert("reports", {
          reporter_id: currentUserId,
          reported_user_id: userId,
          reason: reason.trim(),
          status: "pending",
        });
        console.log("[Report] Insert result:", result);
        return result;
      } catch (err) {
        console.error("[Report] Insert failed:", err);
        console.error("[Report] Error details:", JSON.stringify(err, null, 2));
        throw err;
      }
    },
    onSuccess: () => {
      console.log("[Report] Successfully reported user");
      setReportModalVisible(false);
      setReportReason("");
      Alert.alert("Success", "Report submitted. Our team will review it.");
    },
    onError: (error: any) => {
      console.error("[Report] Error reporting user:", error);
      const errorMsg = error?.message || "Failed to submit report";
      Alert.alert(
        "Error",
        errorMsg.includes("404") 
          ? "Reports feature is not configured. Please contact support."
          : "Failed to submit report. Please try again."
      );
    },
  });

  const coverCandidates: (string | undefined)[] = [
    data?.profile_customization?.backgroundImage,
    Array.isArray(data?.model_photos) ? data?.model_photos[0] : undefined,
    Array.isArray(data?.portfolio_photos) ? data?.portfolio_photos[0] : undefined,
  ];
  const cover = coverCandidates.find((c) => typeof c === "string" && !!c);

  async function ensureMediaPermission(): Promise<boolean> {
    try {
      const isWeb = Platform.select({ web: true, default: false }) as boolean;
      if (isWeb) return true;
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Permission to access photos is required");
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Permission error", e);
      return false;
    }
  }

  async function pickFromLibrary(): Promise<ImagePicker.ImagePickerAsset | null> {
    const ok = await ensureMediaPermission();
    if (!ok) return null;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      selectionLimit: 1,
      allowsEditing: true,
      base64: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return null;
    return res.assets[0] ?? null;
  }

  async function uploadToSupabase(asset: ImagePicker.ImagePickerAsset) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured");
    const uri = asset.uri;
    const fileName = (asset.fileName ?? `${Date.now()}`).replace(/\s+/g, "_");
    const extFromType = (asset as any).mimeType?.split("/")?.[1] ?? uri.split(".").pop() ?? "jpg";
    const namePart = /\.[a-zA-Z0-9]+$/.test(fileName) ? fileName : `${fileName}.${extFromType}`;
    const path = `avatars/${namePart}`;

    const mime = (asset as any).mimeType ?? "image/jpeg";
    let base64Data: string;

    try {
      if (asset.base64 && asset.base64.length > 0) {
        console.log("[upload] Using base64 data from asset");
        base64Data = asset.base64;
      } else {
        console.log("[upload] Reading file using FileSystem");
        const FileSystem = await import("expo-file-system");
        base64Data = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      }
    } catch (err) {
      console.error("[upload] Failed to read image data", err);
      throw new Error(`Could not read selected image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    const isWeb = Platform.select({ web: true, default: false }) as boolean;
    let uploadData: Blob | ArrayBuffer;

    if (isWeb) {
      const dataUrl = `data:${mime};base64,${base64Data}`;
      const response = await fetch(dataUrl);
      uploadData = await response.blob();
      console.log("[upload] Created blob for web", { size: (uploadData as Blob).size });
    } else {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      uploadData = bytes.buffer;
      console.log("[upload] Created ArrayBuffer for native", { size: uploadData.byteLength });
    }

    const contentType = mime;
    console.log("[upload] Uploading to Supabase Storage", { bucket: "model-photos", path, contentType });
    const { error } = await supabase.storage.from("model-photos").upload(path, uploadData, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("model-photos").getPublicUrl(path);
    return data.publicUrl as string;
  }

  async function onChangeAvatar() {
    try {
      if (!data?.user_id || currentUserId !== data.user_id) return;
      const asset = await pickFromLibrary();
      if (!asset) return;
      const url = await uploadToSupabase(asset);
      await updateProfileAsync({ profile_picture: url } as any);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Failed to update avatar";
      Alert.alert("Error", msg);
    }
  }

  const isOwn = !!data?.user_id && currentUserId === data.user_id;

  return (
    <View style={styles.container} testID="profile-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]} testID="profile-scroll">
        {cover && (
          <View style={styles.coverWrap}>
            <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(11,11,15,0)", "rgba(11,11,15,0.35)", "rgba(11,11,15,0.85)", "#0B0B0F"]}
              locations={[0, 0.5, 0.8, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.coverFade}
            />
          </View>
        )}
        <View style={styles.inner}>
          <View style={[styles.headerColumn, !cover && styles.headerColumnNoCover]}>
          <Pressable
            onPress={() => {
              if (!isOwn) {
                Alert.alert("Not allowed", "You can only change your own profile picture");
                return;
              }
              onChangeAvatar();
            }}
            style={styles.avatarWrapLarge}
            testID="avatar-press"
            accessibilityRole="button"
            accessibilityLabel={isOwn ? "Change profile picture" : undefined}
          >
            <Image key={userId} source={{ uri: display.avatarUrl }} style={styles.avatarLarge} />
          </Pressable>
          <Text style={styles.usernameXL}>{display.displayName}</Text>
          {!!data?.location && (
            <View style={styles.locationRowCenter}>
              <MapPin color="#9CA3AF" size={14} />
              <Text numberOfLines={1} style={styles.locationText}>{data.location}</Text>
            </View>
          )}
          <View style={styles.statsAndFollow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followerCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            {!isOwn && (
              <Pressable
                onPress={() => {
                  if (!currentUserId) {
                    Alert.alert("Login Required", "You must be logged in to follow users");
                    return;
                  }
                  if (isFollowing) {
                    unfollowMutation.mutate();
                  } else {
                    followMutation.mutate();
                  }
                }}
                style={[styles.followPill, isFollowing && styles.followPillActive]}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                testID="follow-btn"
              >
                <Text style={[styles.followPillText, isFollowing && styles.followPillTextActive]}>
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </Pressable>
            )}
          </View>
          {(() => {
            const links = data?.social_links ?? {};
            const hasAny = !!(links.instagram || links.youtube || links.twitter || links.tiktok);
            if (!hasAny) return null;
            function open(url: string) {
              const full = url.startsWith("http") ? url : url.includes(".") ? `https://${url}` : url;
              if (Platform.OS === "web") {
                window.open(full, "_blank");
              } else {
                Linking.openURL(full).catch(() => {});
              }
            }
            return (
              <View style={styles.socialRowCenter}>
                {links.instagram && links.instagram.trim() && (
                  <Pressable onPress={() => open(links.instagram!.startsWith("http") ? links.instagram! : `https://instagram.com/${links.instagram!.replace(/^@/, "")}`)} style={[styles.socialIconBtn, { backgroundColor: "#C13584" }]} testID="social-instagram">
                    <Instagram color="#fff" size={20} />
                  </Pressable>
                )}
                {links.youtube && links.youtube.trim() && (
                  <Pressable onPress={() => open(links.youtube!)} style={[styles.socialIconBtn, { backgroundColor: "#FF0000" }]} testID="social-youtube">
                    <Youtube color="#fff" size={20} />
                  </Pressable>
                )}
                {links.twitter && links.twitter.trim() && (
                  <Pressable onPress={() => open(links.twitter!)} style={[styles.socialIconBtn, { backgroundColor: "#1DA1F2" }]} testID="social-twitter">
                    <Twitter color="#fff" size={20} />
                  </Pressable>
                )}
                {links.tiktok && links.tiktok.trim() && (
                  <Pressable onPress={() => open(links.tiktok!)} style={[styles.socialIconBtn, { backgroundColor: "#000000" }]} testID="social-tiktok">
                    <Music2 color="#fff" size={20} />
                  </Pressable>
                )}
              </View>
            );
          })()}
        </View>

        {!isOwn && currentUserId && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                if (isBlocked) {
                  unblockMutation.mutate();
                } else {
                  Alert.alert(
                    "Block User",
                    "Are you sure you want to block this user? You won't see their content anymore.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Block", style: "destructive", onPress: () => blockMutation.mutate() },
                    ]
                  );
                }
              }}
              style={[styles.actionButton, isBlocked && styles.actionButtonActive]}
              disabled={blockMutation.isPending || unblockMutation.isPending}
              testID="block-btn"
            >
              <Ban color={isBlocked ? "#10B981" : "#EF4444"} size={16} />
              <Text style={[styles.actionButtonText, isBlocked && styles.actionButtonTextActive]}>
                {isBlocked ? "Unblock" : "Block"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setReportModalVisible(true)}
              style={styles.actionButton}
              testID="report-btn"
            >
              <Flag color="#F59E0B" size={16} />
              <Text style={styles.actionButtonText}>Report</Text>
            </Pressable>
          </View>
        )}

        {!!data?.bio && (
          <Text style={styles.bio}>{data.bio}</Text>
        )}

        <View style={styles.section} testID="profile-opportunities-section">
          <Pressable 
            onPress={() => setOpportunitiesExpanded(prev => !prev)}
            style={styles.sectionHeader}
            testID="opportunities-toggle"
          >
            <Text style={styles.sectionTitle}>Opportunities</Text>
            {opportunitiesExpanded ? (
              <ChevronUp color="#9CA3AF" size={24} />
            ) : (
              <ChevronDown color="#9CA3AF" size={24} />
            )}
          </Pressable>
          <Animated.View 
            style={[
              styles.animatedContent,
              { 
                maxHeight: opportunitiesAnimHeight.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 10000],
                }),
                opacity: opportunitiesAnimOpacity,
              }
            ]}
          >
          {userOpps && userOpps.length > 0 ? (
            <View style={styles.oppList}>
              {userOpps.map((opp) => {
                console.log(`[Profile] Opp ${opp.id} images:`, { 
                  cover_image: opp.cover_image, 
                  image_url: opp.image_url, 
                  images: opp.images, 
                  media: opp.media 
                });
                
                const fromArray = Array.isArray(opp.images)
                  ? (opp.images[0] && (typeof opp.images[0] === "string" ? opp.images[0] : opp.images[0]?.url))
                  : undefined;
                const fromMedia = Array.isArray(opp.media) ? opp.media[0]?.url : undefined;
                
                const imageUri = (
                  opp.cover_image ?? 
                  opp.image_url ?? 
                  fromArray ?? 
                  fromMedia
                );
                
                console.log(`[Profile] Using imageUri for opp ${opp.id}:`, imageUri);
                const isOwnPost = opp.user_id === currentUserId;
                return (
                  <View key={opp.id} style={styles.oppCard} testID={`opp-${opp.id}`}>
                    {imageUri && (
                      <Image source={{ uri: imageUri }} style={styles.oppImage} resizeMode="cover" />
                    )}
                    <View style={styles.oppBody}>
                      <Text numberOfLines={2} style={styles.oppTitle}>{opp.title ?? "Untitled"}</Text>
                      {!!opp.description && (
                        <Text numberOfLines={3} style={styles.oppDescription}>{opp.description}</Text>
                      )}
                      <View style={styles.oppMetaRow}>
                        {!!opp.type && (
                          <View style={styles.oppTypeBadge}>
                            <Text style={styles.oppTypeBadgeText}>{opp.type}</Text>
                          </View>
                        )}
                        {!!opp.location && (
                          <Text numberOfLines={1} style={styles.oppMeta}>📍 {opp.location}</Text>
                        )}
                      </View>
                      {!!opp.budget && (
                        <View style={styles.oppBudgetRow}>
                          <View style={opp.budget.toLowerCase().includes('unpaid') ? styles.oppUnpaidBadge : styles.oppPaidBadge}>
                            <Text style={opp.budget.toLowerCase().includes('unpaid') ? styles.oppUnpaidBadgeText : styles.oppPaidBadgeText}>
                              {opp.budget.toLowerCase().includes('unpaid') ? opp.budget : (opp.budget.split(' ').map((part, idx) => {
                                if (idx === 0) return part;
                                if (part === '-') return part;
                                const num = part.replace(/[^0-9,]/g, '');
                                return num ? `${num}` : part;
                              }).join(' '))}
                            </Text>
                          </View>
                        </View>
                      )}
                      {opp.requirements && opp.requirements.length > 0 && (
                        <View style={styles.oppRequirements}>
                          <Text style={styles.oppRequirementsTitle}>Requirements:</Text>
                          {opp.requirements.map((req, idx) => (
                            <Text key={idx} style={styles.oppRequirementItem}>• {req}</Text>
                          ))}
                        </View>
                      )}
                      {!isOwnPost && (
                        <View style={styles.oppActions}>
                          <Pressable
                            style={[styles.oppActionBtn, appliedIds?.has(opp.id) && styles.oppActionBtnApplied]}
                            onPress={() => {
                              if (!currentUserId) {
                                Alert.alert("Login Required", "You must be logged in to apply");
                                return;
                              }
                              if (appliedIds?.has(opp.id)) {
                                unapplyMutation.mutate(opp.id);
                              } else {
                                applyMutation.mutate(opp.id);
                              }
                            }}
                            disabled={applyMutation.isPending || unapplyMutation.isPending}
                            testID={`apply-${opp.id}`}
                          >
                            <CheckCircle2 color={appliedIds?.has(opp.id) ? "#4CB963" : "#E5E7EB"} size={14} />
                            <Text style={[styles.oppActionText, appliedIds?.has(opp.id) && styles.oppActionTextActive]}>
                              {appliedIds?.has(opp.id) ? "Applied" : "Apply"}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[styles.oppActionBtn, savedIds?.has(opp.id) && styles.oppActionBtnSaved]}
                            onPress={() => {
                              if (!currentUserId) {
                                Alert.alert("Login Required", "You must be logged in to save");
                                return;
                              }
                              if (savedIds?.has(opp.id)) {
                                unsaveMutation.mutate(opp.id);
                              } else {
                                saveMutation.mutate(opp.id);
                              }
                            }}
                            disabled={saveMutation.isPending || unsaveMutation.isPending}
                            testID={`save-${opp.id}`}
                          >
                            <Bookmark color={savedIds?.has(opp.id) ? "#FFFFFF" : "#E5E7EB"} size={14} fill={savedIds?.has(opp.id) ? "#FFFFFF" : "transparent"} />
                            <Text style={[styles.oppActionText, savedIds?.has(opp.id) && styles.oppActionTextActive]}>
                              {savedIds?.has(opp.id) ? "Saved" : "Save"}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No opportunities yet.</Text>
          )}
          </Animated.View>
        </View>

        {portfolioItems.length > 0 && (
          <View style={styles.section} testID="profile-portfolio-section">
            <Pressable 
              onPress={() => setPortfolioExpanded(prev => !prev)}
              style={styles.sectionHeader}
              testID="portfolio-toggle"
            >
              <Text style={styles.sectionTitle}>Portfolio</Text>
              {portfolioExpanded ? (
                <ChevronUp color="#9CA3AF" size={24} />
              ) : (
                <ChevronDown color="#9CA3AF" size={24} />
              )}
            </Pressable>
            <Animated.View 
              style={[
                styles.animatedContent,
                { 
                  maxHeight: portfolioAnimHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10000],
                  }),
                  opacity: portfolioAnimOpacity,
                }
              ]}
            >
              <MasonryPortfolio items={portfolioItems} onItemPress={setSelectedItem} />
            </Animated.View>
          </View>
        )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedItem(null)}
        >
          <View style={styles.modalContent}>
            {selectedItem?.media_type === "video" ? (
              <Video
                source={{ uri: selectedItem.media_url }}
                style={styles.modalMedia}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                useNativeControls
              />
            ) : selectedItem ? (
              <Image
                source={{ uri: selectedItem.media_url }}
                style={styles.modalMedia}
                resizeMode="contain"
              />
            ) : null}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedItem(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setReportModalVisible(false);
          setReportReason("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.reportModalOverlay}
            onPress={() => {
              setReportModalVisible(false);
              setReportReason("");
            }}
          >
            <Pressable style={styles.reportModalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.reportModalTitle}>Report User</Text>
              <Text style={styles.reportModalSubtitle}>Please tell us why you&apos;re reporting this account</Text>
              <TextInput
                style={styles.reportInput}
                placeholder="Reason for reporting..."
                placeholderTextColor="#6B7280"
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={styles.reportModalActions}>
                <TouchableOpacity
                  style={[styles.reportModalButton, styles.reportModalButtonCancel]}
                  onPress={() => {
                    setReportModalVisible(false);
                    setReportReason("");
                  }}
                >
                  <Text style={styles.reportModalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportModalButton, styles.reportModalButtonSubmit]}
                  onPress={() => {
                    if (!reportReason || reportReason.trim().length === 0) {
                      Alert.alert("Error", "Please provide a reason for reporting");
                      return;
                    }
                    reportMutation.mutate(reportReason);
                  }}
                  disabled={reportMutation.isPending}
                >
                  <Text style={styles.reportModalButtonTextSubmit}>
                    {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  coverWrap: { width: "100%", height: 380, backgroundColor: "#111318" },
  cover: { width: "100%", height: 380 },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 380 },

  scroll: { paddingBottom: 32 },
  inner: { paddingHorizontal: 16 },
  headerColumn: { alignItems: "center", paddingTop: 12 },
  headerColumnNoCover: { paddingTop: 120 },
  avatarWrapLarge: { width: 116, height: 116, borderRadius: 58, overflow: "hidden", borderWidth: 4, borderColor: "#0B0B0F", backgroundColor: "#0B0B0F" },
  avatarLarge: { width: 116, height: 116 },
  usernameXL: { color: "#E5E7EB", fontSize: 28, fontWeight: "900", marginTop: 12 },
  locationRowCenter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  locationText: { color: "#9CA3AF", fontSize: 13, maxWidth: 220 },
  statsAndFollow: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 14 },
  followPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: "#FFFFFF", backgroundColor: "transparent" },
  followPillActive: { backgroundColor: "#E5E7EB", borderColor: "#E5E7EB" },
  followPillText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  followPillTextActive: { color: "#0B0B0F" },
  bio: { color: "#E5E7EB", fontSize: 14, marginTop: 16, lineHeight: 20, textAlign: "center" },
  socialRowCenter: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 12 },
  socialIconBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#14141C", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "#23232B" },
  statItem: { alignItems: "center" },
  statValue: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  oppList: { gap: 12 },
  oppCard: { backgroundColor: "#121218", borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: "hidden" },
  oppImage: { width: "100%", height: 180 },
  oppBody: { padding: 12 },
  oppTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  oppDescription: { color: "#D1D5DB", fontSize: 14, fontWeight: "400", lineHeight: 20, marginBottom: 8 },
  oppMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" },
  oppTypeBadge: { 
    backgroundColor: "#1E40AF", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  oppTypeBadgeText: { color: "#BFDBFE", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  oppMeta: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  oppBudgetRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, marginBottom: 8 },
  oppPaidBadge: {
    backgroundColor: "#065F46",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  oppPaidBadgeText: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  oppUnpaidBadge: {
    backgroundColor: "#7C2D12",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  oppUnpaidBadgeText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  oppRequirements: { marginTop: 4, gap: 4, marginBottom: 4 },
  oppRequirementsTitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  oppRequirementItem: { color: "#D1D5DB", fontSize: 13, fontWeight: "400", lineHeight: 18 },
  oppActions: { flexDirection: "row", gap: 10 as const, marginTop: 12 },
  oppActionBtn: { 
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 7 as const, 
    paddingVertical: 11, 
    paddingHorizontal: 14,
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
  oppActionBtnApplied: { 
    backgroundColor: "#1A1A24", 
    borderColor: "#4CB963",
    borderWidth: 2,
    shadowColor: "#4CB963",
    shadowOpacity: 0.25,
  },
  oppActionBtnSaved: { 
    backgroundColor: "#F59E0B", 
    borderColor: "#D97706",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
  },
  oppActionText: { color: "#D1D5DB", fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  oppActionTextActive: { color: "#4CB963", fontWeight: "800" },
  emptyText: { color: "#9CA3AF", fontSize: 14 },
  animatedContent: { overflow: "hidden" },
  portfolioMasonry: { marginTop: 8, flexDirection: "row", gap: 6 },
  portfolioColumn: { flex: 1, gap: 6 },
  portfolioItemWrap: { borderRadius: 12, overflow: "hidden", backgroundColor: "#14141C", position: "relative" },
  portfolioImage: { width: "100%", height: "100%" },
  portfolioVideo: { width: "100%", height: "100%" },
  videoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  videoDuration: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  videoDurationText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalMedia: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 0,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(30, 30, 40, 0.7)",
    borderWidth: 1.5,
    borderColor: "#2A2A38",
  },
  actionButtonActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  actionButtonText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  actionButtonTextActive: {
    color: "#10B981",
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  reportModalContent: {
    backgroundColor: "#1A1A24",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  reportModalTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  reportModalSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
  },
  reportInput: {
    backgroundColor: "#0F0F15",
    borderWidth: 1.5,
    borderColor: "#2A2A38",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 15,
    minHeight: 120,
  },
  reportModalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  reportModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  reportModalButtonCancel: {
    backgroundColor: "#2A2A38",
  },
  reportModalButtonTextCancel: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "700",
  },
  reportModalButtonSubmit: {
    backgroundColor: "#EF4444",
  },
  reportModalButtonTextSubmit: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

function MasonryPortfolio({ items, onItemPress }: { items: PortfolioItem[]; onItemPress: (item: PortfolioItem) => void }) {
  const screenWidth = Dimensions.get("window").width;
  const padding = 16;
  const gap = 6;
  const numColumns = 2;
  const columnWidth = (screenWidth - padding * 2 - gap * (numColumns - 1)) / numColumns;

  const columns: PortfolioItem[][] = useMemo(() => {
    const cols: PortfolioItem[][] = [];
    for (let i = 0; i < numColumns; i++) {
      cols.push([]);
    }
    const columnHeights: number[] = [];
    for (let i = 0; i < numColumns; i++) {
      columnHeights.push(0);
    }

    items.forEach((item) => {
      const aspectRatio = 1;
      const itemHeight = columnWidth / aspectRatio;
      
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      cols[shortestColumnIndex]?.push(item);
      columnHeights[shortestColumnIndex] += itemHeight + gap;
    });

    return cols;
  }, [items, columnWidth]);

  function formatDuration(seconds?: number): string {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <View style={styles.portfolioMasonry}>
      {columns.map((column, colIndex) => (
        <View key={colIndex} style={styles.portfolioColumn}>
          {column.map((item) => {
            const aspectRatio = 1;
            const itemHeight = columnWidth / aspectRatio;

            return (
              <Pressable
                key={item.id}
                style={[styles.portfolioItemWrap, { height: itemHeight }]}
                onPress={() => onItemPress(item)}
              >
                {item.media_type === "video" ? (
                  <>
                    <Video
                      source={{ uri: item.media_url }}
                      style={styles.portfolioVideo}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      isLooping={false}
                      useNativeControls={false}
                    />
                    <View style={styles.videoOverlay}>
                      <View style={styles.playIcon}>
                        <Play color="#FFFFFF" size={24} fill="#FFFFFF" />
                      </View>
                    </View>
                    {item.duration && (
                      <View style={styles.videoDuration}>
                        <Text style={styles.videoDurationText}>{formatDuration(item.duration)}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Image source={{ uri: item.media_url }} style={styles.portfolioImage} resizeMode="cover" />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}