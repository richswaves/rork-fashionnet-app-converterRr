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
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.24)", "rgba(0,0,0,0.6)", "#0B0B0F"]}
          locations={[0, 0.42, 0.78, 1]}
          start={{ x: 0.5, y: 0.1 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.coverFade}
        />
        <View style={styles.coverCurve} />
        <Pressable testID="back" onPress={() => router.back()} style={[styles.backBtn, { top: 12 + insets.top }]}>
          <ArrowLeft color="#E5E7EB" size={22} />
        </Pressable>
        <View style={styles.avatarFloating}>
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
            <Image source={{ uri: display.avatarUrl }} style={styles.avatarLarge} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}>
        <View style={styles.headerColumn}>
          <Text style={styles.usernameXL}>{display.displayName}</Text>
          {!!data?.location && (
            <View style={styles.locationRowCenter}>
              <MapPin color="#9CA3AF" size={14} />
              <Text numberOfLines={1} style={styles.locationText}>{data.location}</Text>
            </View>
          )}
          <View style={styles.statsAndFollow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <Pressable
              onPress={() => setFollowing((s) => !s)}
              style={[styles.followPill, following && styles.followPillActive]}
              testID="follow-btn"
            >
              <Text style={[styles.followPillText, following && styles.followPillTextActive]}>{following ? "Following" : "Follow"}</Text>
            </Pressable>
          </View>
        </View>

        {data?.social_links && (data.social_links.instagram || data.social_links.youtube) && (
          <View style={styles.socialRowCenter}>
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
                style={styles.socialIconBtn}
                testID="social-instagram"
              >
                <Instagram color="#fff" size={24} />
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
                style={styles.socialIconBtn}
                testID="social-youtube"
              >
                <Youtube color="#fff" size={24} />
              </Pressable>
            )}
          </View>
        )}

        {!!data?.bio && (
          <Text style={styles.bio}>{data.bio}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  coverWrap: { width: "100%", height: 380, backgroundColor: "#111318" },
  cover: { width: "100%", height: 380 },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 340 },
  coverCurve: { position: "absolute", left: -1, right: -1, bottom: -1, height: 160, backgroundColor: "#0B0B0F", borderTopLeftRadius: 48, borderTopRightRadius: 48 },
  backBtn: { position: "absolute", top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingBottom: 32, marginTop: -20 },
  headerColumn: { alignItems: "center" },
  avatarFloating: { position: "absolute", bottom: -64, left: 0, right: 0, alignItems: "center" },
  avatarWrapLarge: { width: 112, height: 112, borderRadius: 56, overflow: "hidden", borderWidth: 4, borderColor: "#0B0B0F", backgroundColor: "#111318" },
  avatarLarge: { width: 112, height: 112, borderRadius: 56 },
  usernameXL: { color: "#E5E7EB", fontSize: 28, fontWeight: "900", marginTop: 74 },
  locationRowCenter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  locationText: { color: "#9CA3AF", fontSize: 13, maxWidth: 220 },
  statsAndFollow: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 12 },
  followPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: "#FFFFFF", backgroundColor: "transparent" },
  followPillActive: { backgroundColor: "#E5E7EB", borderColor: "#E5E7EB" },
  followPillText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  followPillTextActive: { color: "#0B0B0F" },
  bio: { color: "#E5E7EB", fontSize: 14, marginTop: 16, lineHeight: 20, textAlign: "center" },
  socialRowCenter: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 16 },
  socialIconBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#14141C", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "#23232B" },
  statItem: { alignItems: "center" },
  statValue: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" }
});