import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bell, ChevronDown, MapPin, Search, Send, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";
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
}

const ROLES: string[] = ["Professional Role", "Photographer", "Model", "Videographer", "Designer", "Other"];

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<string>(ROLES[0]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [roleMenuOpen, setRoleMenuOpen] = useState<boolean>(false);

  const { resolvedProfile, getDisplayForProfile } = useProfile();
  const router = useRouter();
  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  const { data: topProfiles, isLoading: loadingTop, error: topErr } = useQuery<{ id: string; name: string; image: string; location?: string }[]>({
    queryKey: ["profiles", "top"],
    queryFn: async () => {
      const rows = await sbSelect<ProfileRow>("profiles", {
        select: "user_id,full_name,profile_picture,location,profession,professions,username,created_at",
        query: { account_status: "eq.approved" },
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
        };
      });
    },
  });

  const { data: newProfiles, isLoading: loadingNew, error: newErr } = useQuery<MemberCard[]>({
    queryKey: ["profiles", "new"],
    queryFn: async () => {
      const rows = await sbSelect<ProfileRow>("profiles", {
        select: "user_id,full_name,profile_picture,location,username,created_at",
        query: { account_status: "eq.approved" },
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
        };
      });
    },
  });

  function toggleFollow(id: string) {
    setFollowing((cur) => ({ ...cur, [id]: !cur[id] }));
  }

  return (
    <View style={containerStyle} testID="network-screen">
      <View style={styles.topBar}>
        <Pressable style={styles.profile} testID="top-profile" onPress={() => console.log("profile")}>
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

        <Pressable style={styles.selector} onPress={() => setRoleMenuOpen((s) => !s)} testID="role-selector">
          <User color="#E5E7EB" size={18} />
          <Text style={styles.selectorText}>{selectedRole}</Text>
          <ChevronDown color="#E5E7EB" size={18} />
        </Pressable>

        {roleMenuOpen && (
          <View style={styles.roleChips} testID="role-chips">
            {ROLES.slice(1).map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setSelectedRole(r);
                  setRoleMenuOpen(false);
                }}
                style={[styles.chip, selectedRole === r && styles.chipActive]}
                testID={`chip-${r}`}
              >
                <Text style={[styles.chipText, selectedRole === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>
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
        <View style={styles.grid}>
          {(topProfiles ?? []).map((m) => (
            <Pressable key={m.id} style={styles.card} testID={`top-${m.id}`} onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: m.id } })}>
              <Image source={{ uri: m.image }} style={styles.cardImage} resizeMode="cover" />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{m.name}</Text>
                {!!m.location && (
                  <View style={styles.locationRow}>
                    <MapPin color="#9CA3AF" size={14} />
                    <Text numberOfLines={1} style={styles.locationText}>{m.location}</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => toggleFollow(m.id)}
                  style={[styles.followBtn, following[m.id] && styles.followBtnActive]}
                  testID={`follow-${m.id}`}
                >
                  <Text style={[styles.followLabel, following[m.id] && styles.followLabelActive]}>
                    {following[m.id] ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>

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
                {!!m.location && (
                  <View style={styles.locationRow}>
                    <MapPin color="#9CA3AF" size={14} />
                    <Text numberOfLines={1} style={styles.locationText}>{m.location}</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => toggleFollow(m.id)}
                  style={[styles.followBtn, following[m.id] && styles.followBtnActive]}
                  testID={`follow-${m.id}`}
                >
                  <Text style={[styles.followLabel, following[m.id] && styles.followLabelActive]}>
                    {following[m.id] ? "Following" : "Follow"}
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
  roleChips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderColor: "#2C2C33", borderWidth: 1, backgroundColor: "#0F0F14" },
  chipActive: { backgroundColor: "#1A1A22", borderColor: "#3A3A44" },
  chipText: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },

  h1: { color: "#E5E7EB", fontSize: 24, fontWeight: "900", marginTop: 16, marginBottom: 12 },

  grid: { flexDirection: "row", gap: 12 },
  card: { flex: 1, backgroundColor: "#121218", borderRadius: 16, overflow: "hidden", borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth },
  cardImage: { width: "100%", height: 200 },
  cardBody: { padding: 12 },
  cardTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "800", marginBottom: 6 },
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
