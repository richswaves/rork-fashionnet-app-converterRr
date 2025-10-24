import React, { useMemo, useState } from "react";
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, ArrowLeft, Instagram, Youtube } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { sbSelect, getSupabase } from "@/integrations/supabase/client";
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

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getDisplayForProfile, currentUserId, updateProfileAsync } = useProfile();
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
    data?.profile_customization?.backgroundImage,
    Array.isArray(data?.model_photos) ? data?.model_photos[0] : undefined,
    Array.isArray(data?.portfolio_photos) ? data?.portfolio_photos[0] : undefined,
  ];
  const cover = (coverCandidates.find((c) => typeof c === "string" && !!c) ?? "https://images.unsplash.com/photo-1517816428104-797678c7cf0d?w=1600&auto=format&fit=crop&q=60") as string;

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

    let blob: Blob;
    try {
      if (Platform.OS === "web") {
        blob = await (await fetch(uri)).blob();
      } else if (asset.base64) {
        const mime = (asset as any).mimeType ?? "image/jpeg";
        const dataUrl = `data:${mime};base64,${asset.base64}`;
        blob = await (await fetch(dataUrl)).blob();
      } else {
        blob = await (await fetch(uri)).blob();
      }
    } catch (e) {
      throw new Error("Could not read selected image on this device");
    }

    const contentType = (asset as any).mimeType ?? (blob as any).type ?? "image/jpeg";
    const { error } = await supabase.storage.from("model-photos").upload(path, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });
    if (error) throw error as Error;
    const { data: pub } = supabase.storage.from("model-photos").getPublicUrl(path);
    return pub.publicUrl as string;
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
          <Pressable
            onPress={() => {
              if (!isOwn) {
                Alert.alert("Not allowed", "You can only change your own profile picture");
                return;
              }
              onChangeAvatar();
            }}
            style={styles.avatarWrap}
            testID="avatar-press"
            accessibilityRole="button"
            accessibilityLabel={isOwn ? "Change profile picture" : undefined}
          >
            <Image source={{ uri: display.avatarUrl }} style={styles.avatar} />
          </Pressable>
          <View style={styles.nameCol}>
            <Text style={styles.username}>{display.displayName}</Text>
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

        {data?.social_links && (data.social_links.instagram || data.social_links.youtube) && (
          <View style={styles.socialRow}>
            {data.social_links.instagram && (
              <Pressable
                onPress={() => {
                  const url = data.social_links?.instagram ?? "";
                  const fullUrl = url.startsWith("http") ? url : `https://instagram.com/${url.replace(/^@/, "")}`;
                  if (Platform.OS === "web") {
                    window.open(fullUrl, "_blank");
                  } else {
                    Linking.openURL(fullUrl).catch(() => {});
                  }
                }}
                style={styles.socialBtn}
                testID="social-instagram"
              >
                <Instagram color="#C13584" size={20} />
                <Text style={styles.socialLabel}>Instagram</Text>
              </Pressable>
            )}
            {data.social_links.youtube && (
              <Pressable
                onPress={() => {
                  const url = data.social_links?.youtube ?? "";
                  const fullUrl = url.startsWith("http") ? url : `https://youtube.com/${url}`;
                  if (Platform.OS === "web") {
                    window.open(fullUrl, "_blank");
                  } else {
                    Linking.openURL(fullUrl).catch(() => {});
                  }
                }}
                style={styles.socialBtn}
                testID="social-youtube"
              >
                <Youtube color="#FF0000" size={20} />
                <Text style={styles.socialLabel}>YouTube</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
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
  socialRow: { flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" },
  socialBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#14141C", borderWidth: StyleSheet.hairlineWidth, borderColor: "#23232B" },
  socialLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 24, marginTop: 16 },
  statItem: { alignItems: "center" },
  statValue: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
});