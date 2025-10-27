import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Bell, ChevronDown, MapPin, Search, Send, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sbSelect, sbInsert, sbDelete } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

interface ProfileRow {
  user_id: string;
  full_name?: string;
  profile_picture?: string;
  location?: string;
  profession?: string;
  professions?: string[] | null;
  username?: string;
  created_at?: string;
}

interface MemberCard {
  id: string;
  name: string;
  image: string;
  location?: string;
  profession?: string;
}



export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState<boolean>(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState<boolean>(false);

  const { resolvedProfile, getDisplayForProfile, currentUserId } = useProfile();
  const queryClient = useQueryClient();
  const router = useRouter();
  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  const { width: windowWidth } = useWindowDimensions();

  const { data: availableRoles = [] } = useQuery<string[]>({
    queryKey: ["profiles", "roles"],
    queryFn: async () => {
      const rows = await sbSelect<{ profession?: string }>("profiles", {
        select: "profession",
        query: { account_status: "eq.approved" },
      });
      const uniqueRoles = new Set<string>();
      rows.forEach((r) => {
        if (r.profession && r.profession.trim() && r.profession.toLowerCase() !== "general") {
          uniqueRoles.add(r.profession);
        }
      });
      return Array.from(uniqueRoles).sort();
    },
  });

  const { data: availableLocations = [] } = useQuery<string[]>({
    queryKey: ["profiles", "locations"],
    queryFn: async () => {
      const rows = await sbSelect<{ location?: string }>("profiles", {
        select: "location",
        query: { account_status: "eq.approved" },
      });
      const uniqueLocations = new Set<string>();
      rows.forEach((r) => {
        if (r.location && r.location.trim()) {
          uniqueLocations.add(r.location);
        }
      });
      return Array.from(uniqueLocations).sort();
    },
  });

  const { data: topProfiles, isLoading: loadingTop, error: topErr } = useQuery<MemberCard[]>({
    queryKey: ["profiles", "top", selectedRole, selectedLocation],
    queryFn: async () => {
      let query: Record<string, string> = { account_status: "eq.approved" };
      if (selectedRole) {
        query.profession = `eq.${selectedRole}`;
      }
      if (selectedLocation) {
        query.location = `eq.${selectedLocation}`;
      }
      const rows = await sbSelect<ProfileRow>("profiles", {
        select: "user_id,full_name,profile_picture,location,profession,professions,username,created_at",
        query,
        order: { column: "created_at", ascending: false },
        limit: 8,
      });
      return rows.map((r) => {
        const d = getDisplayForProfile(r);
        return {
          id: r.user_id,
          name: d.displayName,
          image: d.avatarUrl,
          location: r.location ?? undefined,
          profession: r.profession ?? undefined,
        };
      });
    },
  });

  const { data: newProfiles, isLoading: loadingNew, error: newErr } = useQuery<MemberCard[]>({
    queryKey: ["profiles", "new", selectedRole, selectedLocation],
    queryFn: async () => {
      let query: Record<string, string> = { account_status: "eq.approved" };
      if (selectedRole) {
        query.profession = `eq.${selectedRole}`;
      }
      if (selectedLocation) {
        query.location = `eq.${selectedLocation}`;
      }
      const rows = await sbSelect<ProfileRow>("profiles", {
        select: "user_id,full_name,profile_picture,location,profession,username,created_at",
        query,
        order: { column: "created_at", ascending: false },
        limit: 12,
      });
      return rows.map((r) => {
        const d = getDisplayForProfile(r);
        return {
          id: r.user_id,
          name: d.displayName,
          image: d.avatarUrl,
          location: r.location ?? undefined,
          profession: r.profession ?? undefined,
        };
      });
    },
  });

  const { data: followingIds } = useQuery<Set<string>>({
    queryKey: ["following-ids", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return new Set<string>();
      const follows = await sbSelect<{ following_id: string }>("follows", {
        select: "following_id",
        query: { follower_id: `eq.${currentUserId}` },
        limit: 1000,
      });
      return new Set(follows.map((f) => f.following_id));
    },
    enabled: !!currentUserId,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (currentUserId === userId) throw new Error("Cannot follow yourself");
      
      console.log(`[Follow] User ${currentUserId} following user ${userId}`);
      await sbInsert("follows", {
        follower_id: currentUserId,
        following_id: userId,
      });
    },
    onSuccess: (_, userId) => {
      console.log("[Follow] Successfully followed user");
      queryClient.invalidateQueries({ queryKey: ["following-ids", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["follower-count", userId] });
      queryClient.invalidateQueries({ queryKey: ["following-count", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-follows", userId] });
    },
    onError: (error) => {
      console.error("[Follow] Error following user:", error);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      
      console.log(`[Follow] User ${currentUserId} unfollowing user ${userId}`);
      await sbDelete("follows", {
        follower_id: currentUserId,
        following_id: userId,
      });
    },
    onSuccess: (_, userId) => {
      console.log("[Follow] Successfully unfollowed user");
      queryClient.invalidateQueries({ queryKey: ["following-ids", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["follower-count", userId] });
      queryClient.invalidateQueries({ queryKey: ["following-count", currentUserId] });
    },
    onError: (error) => {
      console.error("[Follow] Error unfollowing user:", error);
    },
  });

  function toggleFollow(id: string) {
    if (!currentUserId) {
      console.log("[Follow] User not logged in");
      return;
    }
    if (followingIds?.has(id)) {
      unfollowMutation.mutate(id);
    } else {
      followMutation.mutate(id);
    }
  }

  return (
    <View style={containerStyle} testID="network-screen">
      <View style={styles.topBar}>
        <Pressable style={styles.profile} testID="top-profile" onPress={() => router.push("/profile/edit")}>
          <Image source={{ uri: resolvedProfile.avatarUrl }} style={styles.avatar} />
          <Text style={styles.profileText}>{resolvedProfile.displayName}</Text>
        </Pressable>

        <View style={styles.topIcons}>
          <Pressable onPress={() => console.log("search")} style={styles.iconBtn} testID="top-search">
            <Search color="#E5E7EB" size={20} />
          </Pressable>
          <Pressable onPress={() => console.log("bell")} style={styles.iconBtn} testID="top-bell">
            <Bell color="#E5E7EB" size={20} />
          </Pressable>
          <Pressable onPress={() => console.log("share")} style={styles.iconBtn} testID="top-share">
            <Send color="#E5E7EB" size={20} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="network-scroll">
        <Text style={styles.sectionHeader}>FILTER NETWORK</Text>

        <Pressable style={styles.selector} onPress={() => {
          setRoleMenuOpen((s) => !s);
          setLocationMenuOpen(false);
        }} testID="role-selector">
          <User color="#E5E7EB" size={18} />
          <Text style={styles.selectorText}>{selectedRole ? selectedRole.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "All Roles"}</Text>
          <ChevronDown color="#E5E7EB" size={18} />
        </Pressable>

        {roleMenuOpen && (
          <ScrollView style={styles.roleChipsScroll} contentContainerStyle={styles.roleChips} testID="role-chips">
            <Pressable
              onPress={() => {
                setSelectedRole(null);
                setRoleMenuOpen(false);
              }}
              style={[styles.chip, selectedRole === null && styles.chipActive]}
              testID="chip-all-roles"
            >
              <Text style={[styles.chipText, selectedRole === null && styles.chipTextActive]}>All Roles</Text>
            </Pressable>
            {availableRoles.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setSelectedRole(r);
                  setRoleMenuOpen(false);
                }}
                style={[styles.chip, selectedRole === r && styles.chipActive]}
                testID={`chip-${r}`}
              >
                <Text style={[styles.chipText, selectedRole === r && styles.chipTextActive]}>{r.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable style={[styles.selector, { marginTop: 10 }]} onPress={() => {
          setLocationMenuOpen((s) => !s);
          setRoleMenuOpen(false);
        }} testID="location-selector">
          <MapPin color="#E5E7EB" size={18} />
          <Text style={styles.selectorText}>{selectedLocation ?? "All Locations"}</Text>
          <ChevronDown color="#E5E7EB" size={18} />
        </Pressable>

        {locationMenuOpen && (
          <ScrollView style={styles.roleChipsScroll} contentContainerStyle={styles.roleChips} testID="location-chips">
            <Pressable
              onPress={() => {
                setSelectedLocation(null);
                setLocationMenuOpen(false);
              }}
              style={[styles.chip, selectedLocation === null && styles.chipActive]}
              testID="chip-all-locations"
            >
              <Text style={[styles.chipText, selectedLocation === null && styles.chipTextActive]}>All Locations</Text>
            </Pressable>
            {availableLocations.map((loc) => (
              <Pressable
                key={loc}
                onPress={() => {
                  setSelectedLocation(loc);
                  setLocationMenuOpen(false);
                }}
                style={[styles.chip, selectedLocation === loc && styles.chipActive]}
                testID={`chip-${loc}`}
              >
                <Text style={[styles.chipText, selectedLocation === loc && styles.chipTextActive]}>{loc}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={styles.h1}>Top Members</Text>
        {loadingTop && (
          <View style={styles.loaderRow} testID="top-loading">
            <ActivityIndicator color="#E5E7EB" />
          </View>
        )}
        {!!topErr && (
          <Text style={styles.errorText} testID="top-error">Failed to load members</Text>
        )}
        {(() => {
          const items = topProfiles ?? [];
          const pagePadding = 12 * 2;
          const gap = 12;
          const pageWidth = Math.floor(windowWidth - pagePadding);
          const cardW = Math.floor((pageWidth - gap) / 2);
          const pages: typeof items[] = [];
          for (let i = 0; i < items.length; i += 4) pages.push(items.slice(i, i + 4));
          return (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topPager}
              testID="top-pager"
            >
              {pages.map((page, pIdx) => (
                <View key={`page-${pIdx}`} style={[styles.page, { width: pageWidth }]}> 
                  <View style={styles.grid}> 
                    {page.map((m, idx) => (
                      <Pressable
                        key={m.id}
                        style={[styles.card, { width: cardW }, idx % 2 === 0 ? { marginRight: 12 } : null]}
                        testID={`top-${m.id}`}
                        onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: m.id } })}
                      >
                        <Image source={{ uri: m.image }} style={styles.cardImage} resizeMode="cover" />
                        <View style={styles.cardBody}>
                          <Text numberOfLines={1} style={styles.cardTitle}>{m.name}</Text>
                          {!!m.profession && (
                            <Text numberOfLines={1} style={styles.cardProfession}>{m.profession.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                          )}
                          {!!m.location && (
                            <View style={styles.locationRow}>
                              <MapPin color="#9CA3AF" size={14} />
                              <Text numberOfLines={1} style={styles.locationText}>{m.location}</Text>
                            </View>
                          )}
                          <Pressable
                            onPress={() => toggleFollow(m.id)}
                            style={[styles.followBtn, followingIds?.has(m.id) && styles.followBtnActive]}
                            testID={`follow-${m.id}`}
                            disabled={followMutation.isPending || unfollowMutation.isPending}
                          >
                            <Text style={[styles.followLabel, followingIds?.has(m.id) && styles.followLabelActive]}>
                              {followingIds?.has(m.id) ? "Following" : "Follow"}
                            </Text>
                          </Pressable>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          );
        })()}

        <Text style={[styles.h1, { marginTop: 8 }]}>New to the Network</Text>
        {loadingNew && (
          <View style={styles.loaderRow} testID="new-loading">
            <ActivityIndicator color="#E5E7EB" />
          </View>
        )}
        {!!newErr && (
          <Text style={styles.errorText} testID="new-error">Failed to load new members</Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList} testID="new-list">
          {(newProfiles ?? []).map((m) => (
            <Pressable key={m.id} style={styles.hCard} testID={`new-${m.id}`} onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: m.id } })}>
              <Image source={{ uri: m.image }} style={styles.hImage} resizeMode="cover" />
              <View style={styles.cardBody}>
                <Text numberOfLines={1} style={styles.cardTitle}>{m.name}</Text>
                {!!m.profession && (
                  <Text numberOfLines={1} style={styles.cardProfession}>{m.profession.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                )}
                {!!m.location && (
                  <View style={styles.locationRow}>
                    <MapPin color="#9CA3AF" size={14} />
                    <Text numberOfLines={1} style={styles.locationText}>{m.location}</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => toggleFollow(m.id)}
                  style={[styles.followBtn, followingIds?.has(m.id) && styles.followBtnActive]}
                  testID={`follow-${m.id}`}
                  disabled={followMutation.isPending || unfollowMutation.isPending}
                >
                  <Text style={[styles.followLabel, followingIds?.has(m.id) && styles.followLabelActive]}>
                    {followingIds?.has(m.id) ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profile: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  profileText: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" },
  topIcons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8, borderRadius: 999 },

  scroll: { paddingHorizontal: 12, paddingBottom: 24 },

  sectionHeader: { color: "#E5E7EB", fontSize: 12, fontWeight: "800", letterSpacing: 0.4, marginBottom: 8, marginTop: 4 },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  selectorText: { color: "#E5E7EB", fontSize: 15, fontWeight: "600", flex: 1 },
  roleChipsScroll: { maxHeight: 200, marginTop: 10, marginBottom: 4 },
  roleChips: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderColor: "#2C2C33", borderWidth: 1, backgroundColor: "#0F0F14" },
  chipActive: { backgroundColor: "#1A1A22", borderColor: "#3A3A44" },
  chipText: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },

  h1: { color: "#E5E7EB", fontSize: 24, fontWeight: "900", marginTop: 16, marginBottom: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start" },
  page: { marginRight: 12 },
  topPager: { paddingRight: 12 },
  card: { backgroundColor: "#121218", borderRadius: 16, overflow: "hidden", borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  cardImage: { width: "100%", height: 140 },
  cardBody: { padding: 12 },
  cardTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  cardProfession: { color: "#9CA3AF", fontSize: 12, fontWeight: "600", marginBottom: 4, textTransform: "capitalize" as const },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  locationText: { color: "#9CA3AF", fontSize: 12, flexShrink: 1 },
  followBtn: { borderColor: "#3A3A44", borderWidth: 1, paddingVertical: 10, borderRadius: 20, alignItems: "center" },
  followBtnActive: { backgroundColor: "#E5E7EB" },
  followLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" },
  followLabelActive: { color: "#0B0B0F" },

  loaderRow: { paddingVertical: 10, alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },

  horizontalList: { paddingRight: 12, gap: 12 },
  hCard: { width: 240, backgroundColor: "#121218", borderRadius: 16, overflow: "hidden", borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth },
  hImage: { width: 240, height: 260 },
});
