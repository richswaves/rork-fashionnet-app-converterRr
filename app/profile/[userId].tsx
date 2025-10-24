import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, ArrowLeft } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { sbSelect } from "@/integrations/supabase/client";
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
  banner_image?: string | null;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getDisplayForProfile } = useProfile();
  const [following, setFollowing] = useState<boolean>(false);

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

  const coverCandidates: (string | undefined)[] = [
    data?.banner_image ?? undefined,
    Array.isArray(data?.model_photos) ? data?.model_photos[0] : undefined,
    Array.isArray(data?.portfolio_photos) ? data?.portfolio_photos[0] : undefined,
  ];
  const cover = (coverCandidates.find((c) => typeof c === "string" && !!c) ?? "https://images.unsplash.com/photo-1517816428104-797678c7cf0d?w=1600&auto=format&fit=crop&q=60") as string;

  return (
    <View style={styles.container} testID="profile-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.coverWrap}>
        <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "#0B0B0F"]}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0.2 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.coverFade}
        />
        <Pressable testID="back" onPress={() => router.back()} style={[styles.backBtn, { top: 12 + insets.top }]}>
          <ArrowLeft color="#E5E7EB" size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}>
        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: display.avatarUrl }} style={styles.avatar} />
          </View>
          <View style={styles.nameCol}>
            <Text style={styles.username}>{display.username}</Text>
            {!!data?.location && (
              <View style={styles.locationRow}>
                <MapPin color="#9CA3AF" size={14} />
                <Text numberOfLines={1} style={styles.locationText}>{data.location}</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => setFollowing((s) => !s)}
            style={[styles.followBtn, following && styles.followBtnActive]}
            testID="follow-btn"
          >
            <Text style={[styles.followText, following && styles.followTextActive]}>{following ? "Following" : "Follow"}</Text>
          </Pressable>
        </View>

        {!!data?.bio && (
          <Text style={styles.bio}>{data.bio}</Text>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>1</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  coverWrap: { width: "100%", height: 320, backgroundColor: "#111318" },
  cover: { width: "100%", height: 320 },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 200 },
  backBtn: { position: "absolute", top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingBottom: 32, marginTop: -72 },
  headerRow: { flexDirection: "row", alignItems: "flex-end" },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, overflow: "hidden", borderWidth: 3, borderColor: "#0B0B0F", marginRight: 12 },
  avatar: { width: 96, height: 96 },
  nameCol: { flex: 1, paddingBottom: 8 },
  username: { color: "#E5E7EB", fontSize: 22, fontWeight: "900" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  locationText: { color: "#9CA3AF", fontSize: 13, maxWidth: 180 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: "#2C2C33", backgroundColor: "#0F0F14", marginLeft: 8, marginBottom: 8 },
  followBtnActive: { backgroundColor: "#E5E7EB" },
  followText: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" },
  followTextActive: { color: "#0B0B0F" },
  bio: { color: "#E5E7EB", fontSize: 14, marginTop: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 24, marginTop: 16 },
  statItem: { alignItems: "center" },
  statValue: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
});