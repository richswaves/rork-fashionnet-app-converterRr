import React, { useMemo, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";
import { Check, X, Loader2, Pencil, MapPin, Instagram, Youtube, CircleX, Image as ImageIcon, Plus, Trash2 } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { getSupabase, sbSelect, sbInsert, sbDelete } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PortfolioItem } from "@/integrations/supabase/portfolio-types";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isUpdating, updateProfileAsync, resolvedProfile } = useProfile();

  const [fullName, setFullName] = useState<string>(profile?.full_name ?? "");
  const [username, setUsername] = useState<string>(profile?.username ?? resolvedProfile.username ?? "");
  const [location, setLocation] = useState<string>(profile?.location ?? "");
  const [bio, setBio] = useState<string>(profile?.bio ?? "");
  const initialAvatar = profile?.profile_picture ?? resolvedProfile.avatarUrl ?? "";
  const initialBanner = (profile as any)?.profile_customization?.backgroundImage ?? (Array.isArray((profile as any)?.model_photos) && (profile as any)?.model_photos?.length ? ((profile as any)?.model_photos?.[0] as string) : (Array.isArray((profile as any)?.portfolio_photos) && (profile as any)?.portfolio_photos?.length ? ((profile as any)?.portfolio_photos?.[0] as string) : ""));
  
  const [avatarUrl, setAvatarUrl] = useState<string>(initialAvatar);
  const [bannerUrl, setBannerUrl] = useState<string>(initialBanner);
  const [pendingAvatar, setPendingAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pendingBanner, setPendingBanner] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [editing, setEditing] = useState<
    | null
    | "name"
    | "location"
    | "bio"
    | "avatar"
    | "banner"
    | "instagram"
    | "youtube"
    | "twitter"
    | "tiktok"
  >(null);
  const [temp, setTemp] = useState<string>("");
  const [socialLinks, setSocialLinks] = useState<{
    instagram?: string;
    youtube?: string;
    twitter?: string;
    tiktok?: string;
  }>((profile as any)?.social_links ?? {});

  const queryClient = useQueryClient();
  const currentUserId = profile?.user_id;

  const { data: portfolioItems = [] } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const items = await sbSelect<PortfolioItem>("portfolio_items", {
        select: "*",
        query: { user_id: `eq.${currentUserId}` },
        order: { column: "created_at", ascending: false },
      });
      return items;
    },
    enabled: !!currentUserId,
  });

  const [uploadingPortfolio, setUploadingPortfolio] = useState<boolean>(false);

  const addPortfolioMutation = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      if (!currentUserId) throw new Error("Must be logged in");
      console.log("[Portfolio] Uploading asset", asset.uri);
      const url = await uploadToSupabase(asset, "portfolio");
      console.log("[Portfolio] Asset uploaded to", url);
      const item: Record<string, any> = {
        user_id: currentUserId,
        media_url: url,
        media_type: "image",
      };
      const inserted = await sbInsert("portfolio_items", item);
      console.log("[Portfolio] Item inserted", inserted);
      return inserted;
    },
    onSuccess: () => {
      console.log("[Portfolio] Invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["portfolio", currentUserId] });
    },
    onError: (error: any) => {
      console.error("[Portfolio] Upload error", error);
      Alert.alert("Error", "Failed to upload portfolio item");
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      await sbDelete("portfolio_items", { id: itemId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", currentUserId] });
    },
    onError: (error: any) => {
      console.error("[Portfolio] Delete error", error);
      Alert.alert("Error", "Failed to delete portfolio item");
    },
  });

  const canSave = useMemo<boolean>(() => {
    return (
      (fullName ?? "").trim().length > 0 ||
      (username ?? "").trim().length > 0 ||
      (location ?? "").trim().length > 0 ||
      (bio ?? "").trim().length > 0 ||
      (avatarUrl ?? "").trim().length > 0
    );
  }, [fullName, username, location, bio, avatarUrl]);

  function openEditor(kind: NonNullable<typeof editing>) {
    setEditing(kind);
    switch (kind) {
      case "name":
        setTemp(fullName);
        break;
      case "location":
        setTemp(location);
        break;
      case "bio":
        setTemp(bio);
        break;
      case "avatar":
        setTemp(avatarUrl);
        break;
      case "banner":
        setTemp(bannerUrl);
        break;
      case "instagram":
        setTemp(socialLinks.instagram ?? "");
        break;
      case "youtube":
        setTemp(socialLinks.youtube ?? "");
        break;
      case "twitter":
        setTemp(socialLinks.twitter ?? "");
        break;
      case "tiktok":
        setTemp(socialLinks.tiktok ?? "");
        break;
      default:
        setTemp("");
    }
  }

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

  async function pickFromLibrary(allowsEditing = true): Promise<ImagePicker.ImagePickerAsset | null> {
    const ok = await ensureMediaPermission();
    if (!ok) return null;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      selectionLimit: 1,
      allowsEditing,
      base64: true,
      aspect: allowsEditing ? [1, 1] : undefined,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return null;
    return res.assets[0] ?? null;
  }

  async function uploadToSupabase(asset: ImagePicker.ImagePickerAsset, folder: "avatars" | "banners" | "portfolio") {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured");

    const uri = asset.uri;
    const rawName = (asset.fileName ?? `img_${Date.now()}`).replace(/\s+/g, "_");
    const extFromType = (asset as any).mimeType?.split("/")?.[1] ?? uri.split(".").pop() ?? "jpg";
    const fileName = /\.[a-zA-Z0-9]+$/.test(rawName) ? rawName : `${rawName}.${extFromType}`;
    const path = `${folder}/${fileName}`;

    let blob: Blob | null = null;

    try {
      if (Platform.OS === "web") {
        console.log("[upload] Web: fetching blob from uri", uri);
        blob = await (await fetch(uri)).blob();
      } else if (asset.base64 && asset.base64.length > 0) {
        const mime = (asset as any).mimeType ?? "image/jpeg";
        const dataUrl = `data:${mime};base64,${asset.base64}`;
        console.log("[upload] Native: creating blob from base64 data URL");
        blob = await (await fetch(dataUrl)).blob();
      } else {
        console.log("[upload] Native: fetching blob from file uri", uri);
        blob = await (await fetch(uri)).blob();
      }
    } catch (err) {
      console.warn("[upload] Primary blob creation failed, attempting FileSystem fallback", err);
      try {
        const FileSystem = await import("expo-file-system");
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const mime = (asset as any).mimeType ?? "image/jpeg";
        const dataUrl = `data:${mime};base64,${base64}`;
        blob = await (await fetch(dataUrl)).blob();
      } catch (e) {
        console.error("[upload] Fallback blob creation failed", e);
        throw new Error("Could not read selected image. Please try a different photo.");
      }
    }

    const contentType = (asset as any).mimeType ?? (blob as any)?.type ?? "image/jpeg";
    console.log("[upload] Uploading to Supabase Storage", { bucket: "model-photos", path, contentType, size: (blob as any)?.size });
    const { error } = await supabase.storage.from("model-photos").upload(path, blob as any, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("model-photos").getPublicUrl(path);
    return data.publicUrl as string;
  }

  async function onPickAvatar() {
    try {
      console.log("[onPickAvatar] Starting image picker");
      const asset = await pickFromLibrary();
      if (!asset) {
        console.log("[onPickAvatar] No asset selected");
        return;
      }
      console.log("[onPickAvatar] Asset selected:", asset.uri);
      setPendingAvatar(asset);
      setAvatarUrl(asset.uri);
      console.log("[onPickAvatar] State updated with preview");
    } catch (e: any) {
      console.error("[onPickAvatar] Error:", e);
      const msg = typeof e?.message === "string" ? e.message : "Failed to pick image";
      Alert.alert("Error", msg);
    }
  }

  async function onPickBanner() {
    try {
      console.log("[onPickBanner] Starting image picker");
      const asset = await pickFromLibrary();
      if (!asset) {
        console.log("[onPickBanner] No asset selected");
        return;
      }
      console.log("[onPickBanner] Asset selected:", asset.uri);
      setPendingBanner(asset);
      setBannerUrl(asset.uri);
      console.log("[onPickBanner] State updated with preview");
    } catch (e: any) {
      console.error("[onPickBanner] Error:", e);
      const msg = typeof e?.message === "string" ? e.message : "Failed to pick image";
      Alert.alert("Error", msg);
    }
  }

  function applyEdit() {
    if (!editing) return;
    const val = temp.trim();
    if (editing === "name") setFullName(val);
    if (editing === "location") setLocation(val);
    if (editing === "bio") setBio(val);
    if (editing === "avatar") setAvatarUrl(val);
    if (editing === "banner") setBannerUrl(val);
    if (editing === "instagram") setSocialLinks(prev => ({ ...prev, instagram: val }));
    if (editing === "youtube") setSocialLinks(prev => ({ ...prev, youtube: val }));
    if (editing === "twitter") setSocialLinks(prev => ({ ...prev, twitter: val }));
    if (editing === "tiktok") setSocialLinks(prev => ({ ...prev, tiktok: val }));
    setEditing(null);
  }

  async function onSave() {
    try {
      console.log("[onSave] Starting save process");
      console.log("[onSave] pendingAvatar:", !!pendingAvatar, pendingAvatar?.uri?.substring(0, 50));
      console.log("[onSave] pendingBanner:", !!pendingBanner, pendingBanner?.uri?.substring(0, 50));
      console.log("[onSave] avatarUrl:", avatarUrl?.substring(0, 50));
      console.log("[onSave] bannerUrl:", bannerUrl?.substring(0, 50));
      
      const updates: Record<string, any> = {};
      let finalAvatarUrl = avatarUrl?.trim() ?? "";
      let finalBannerUrl = bannerUrl?.trim() ?? "";

      if (pendingAvatar) {
        console.log("[onSave] Uploading pending avatar to Supabase");
        try {
          finalAvatarUrl = await uploadToSupabase(pendingAvatar, "avatars");
          console.log("[onSave] Avatar uploaded successfully:", finalAvatarUrl);
          setAvatarUrl(finalAvatarUrl);
          setPendingAvatar(null);
        } catch (uploadError: any) {
          console.error("[onSave] Avatar upload failed:", uploadError);
          throw new Error(`Failed to upload profile picture: ${uploadError.message || 'Unknown error'}`);
        }
      }
      
      if (pendingBanner) {
        console.log("[onSave] Uploading pending banner to Supabase");
        try {
          finalBannerUrl = await uploadToSupabase(pendingBanner, "banners");
          console.log("[onSave] Banner uploaded successfully:", finalBannerUrl);
          setBannerUrl(finalBannerUrl);
          setPendingBanner(null);
        } catch (uploadError: any) {
          console.error("[onSave] Banner upload failed:", uploadError);
          throw new Error(`Failed to upload background image: ${uploadError.message || 'Unknown error'}`);
        }
      }

      if (fullName !== (profile?.full_name ?? "")) updates.full_name = fullName.trim();
      if (username !== (profile?.username ?? resolvedProfile.username ?? "")) updates.username = username.trim();
      if (location !== (profile?.location ?? "")) updates.location = location.trim();
      if (bio !== (profile?.bio ?? "")) updates.bio = bio.trim();

      if (finalAvatarUrl && finalAvatarUrl !== (profile?.profile_picture ?? resolvedProfile.avatarUrl ?? "")) {
        console.log("[onSave] Adding profile_picture to updates:", finalAvatarUrl);
        updates.profile_picture = finalAvatarUrl;
      }

      if ((finalBannerUrl ?? "").length > 0 && finalBannerUrl !== initialBanner) {
        const prev = (profile as any)?.profile_customization ?? {};
        updates.profile_customization = {
          ...prev,
          backgroundType: "image",
          backgroundImage: finalBannerUrl,
        };
        console.log("[onSave] Adding profile_customization to updates:", updates.profile_customization);
      }

      const existingSocial = (profile as any)?.social_links ?? {};
      const hasChangedSocial = JSON.stringify(socialLinks) !== JSON.stringify(existingSocial);
      if (hasChangedSocial) {
        updates.social_links = socialLinks;
        console.log("[onSave] Adding social_links to updates:", socialLinks);
      }

      if (Object.keys(updates).length === 0) {
        console.log("[onSave] No changes to save");
        router.back();
        return;
      }
      
      console.log("[onSave] Updating profile with:", updates);
      await updateProfileAsync(updates as any);
      console.log("[onSave] Profile updated successfully, navigating back");
      
      setTimeout(() => {
        router.back();
      }, 100);
    } catch (e: any) {
      console.error("[onSave] Save error:", e);
      const msg = typeof e?.message === "string" ? e.message : "Failed to update profile";
      Alert.alert("Error", msg);
    }
  }

  async function onAddPortfolio() {
    try {
      console.log("[Portfolio] Starting picker");
      setUploadingPortfolio(true);
      const asset = await pickFromLibrary(false);
      if (!asset) {
        console.log("[Portfolio] No asset selected");
        setUploadingPortfolio(false);
        return;
      }
      console.log("[Portfolio] Asset selected, uploading");
      await addPortfolioMutation.mutateAsync(asset);
      console.log("[Portfolio] Upload complete");
      setUploadingPortfolio(false);
    } catch (e: any) {
      console.error("[Portfolio] Error", e);
      setUploadingPortfolio(false);
      const msg = typeof e?.message === "string" ? e.message : "Failed to add portfolio item";
      Alert.alert("Error", msg);
    }
  }

  async function onDeletePortfolio(itemId: string) {
    Alert.alert(
      "Delete Portfolio Item",
      "Are you sure you want to delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePortfolioMutation.mutate(itemId),
        },
      ]
    );
  }

  return (
    <View style={styles.container} testID="edit-profile-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <View style={styles.coverWrap}>
          <Image 
            key={bannerUrl}
            source={{ uri: bannerUrl || "https://images.unsplash.com/photo-1517816428104-797678c7cf0d?w=1600&auto=format&fit=crop&q=60" }} 
            style={styles.cover} 
            resizeMode="cover" 
          />
          <View style={styles.coverOverlay} />
          <LinearGradient
            colors={["rgba(11,11,15,0)", "rgba(11,11,15,0.35)", "rgba(11,11,15,0.85)", "#0B0B0F"]}
            locations={[0, 0.5, 0.8, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.coverFade}
          />
          <Pressable
            testID="edit-banner"
            onPress={onPickBanner}
            style={[styles.coverEditFab, { top: 12 + insets.top }]}
            accessibilityLabel="Edit background"
          >
            <ImageIcon color="#0B0B0F" size={16} />
          </Pressable>
          <View style={styles.avatarFloating}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={onPickAvatar} style={styles.avatarWrap} testID="avatar-press">
              <Image 
                key={avatarUrl}
                source={{ uri: avatarUrl || resolvedProfile.avatarUrl }} 
                style={styles.avatar} 
              />
              <Pressable testID="edit-avatar" onPress={onPickAvatar} style={styles.editFab}>
                <Pencil color="#0B0B0F" size={16} />
              </Pressable>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroContent}>

            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{fullName || resolvedProfile.displayName || "Your name"}</Text>
              <Pressable testID="edit-name" onPress={() => openEditor("name")} style={styles.inlineEditBtn}>
                <Pencil color="#E5E7EB" size={16} />
              </Pressable>
            </View>

            <View style={styles.locationRow}>
              <MapPin color="#9CA3AF" size={14} />
              <Text style={styles.locationText}>{location || "City, State"}</Text>
              <Pressable testID="edit-location" onPress={() => openEditor("location")} style={styles.inlineEditBtnSmall}>
                <Pencil color="#E5E7EB" size={14} />
              </Pressable>
            </View>

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

            <View style={styles.socialRow}>
              <Pressable testID="social-instagram" style={[styles.socialBtn, { backgroundColor: "#C13584" }]} onPress={() => openEditor("instagram")}>
                <Instagram color="#fff" size={20} />
              </Pressable>
              <Pressable testID="social-youtube" style={[styles.socialBtn, { backgroundColor: "#FF0000" }]} onPress={() => openEditor("youtube")}>
                <Youtube color="#fff" size={20} />
              </Pressable>
              <View style={[styles.socialBtn, { backgroundColor: "#2C2C33" }]}> 
                <CircleX color="#9CA3AF" size={20} />
              </View>
              <View style={[styles.socialBtn, { backgroundColor: "#2C2C33" }]}>
                <Text style={{ color: "#9CA3AF", fontWeight: "800" }}>t</Text>
              </View>
            </View>

            <View style={styles.bioWrap}>
              <Text style={styles.bioText}>{bio || "Tell people about yourself..."}</Text>
              <Pressable testID="edit-bio" onPress={() => openEditor("bio")} style={styles.inlineEditBtn}>
                <Pencil color="#E5E7EB" size={16} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.portfolioSection}>
          <View style={styles.portfolioHeader}>
            <Text style={styles.portfolioTitle}>Portfolio</Text>
            <Pressable 
              onPress={onAddPortfolio} 
              style={styles.addPortfolioBtn}
              disabled={uploadingPortfolio || addPortfolioMutation.isPending}
              testID="add-portfolio-btn"
            >
              {uploadingPortfolio || addPortfolioMutation.isPending ? (
                <Loader2 color="#E5E7EB" size={18} />
              ) : (
                <Plus color="#E5E7EB" size={18} />
              )}
            </Pressable>
          </View>
          {portfolioItems.length === 0 ? (
            <Pressable onPress={onAddPortfolio} style={styles.cardUpload}>
              <View style={styles.dashed} />
              <Text style={styles.uploadTitle}>Add portfolio photos</Text>
              <Text style={styles.uploadSubtitle}>Tap to upload</Text>
            </Pressable>
          ) : (
            <View style={styles.portfolioGrid}>
              {portfolioItems.map((item) => (
                <View key={item.id} style={styles.portfolioItemWrap}>
                  <Image source={{ uri: item.media_url }} style={styles.portfolioImage} resizeMode="cover" />
                  <Pressable
                    onPress={() => onDeletePortfolio(item.id)}
                    style={styles.deletePortfolioBtn}
                    testID={`delete-portfolio-${item.id}`}
                  >
                    <Trash2 color="#FFF" size={14} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn} testID="btn-cancel">
            <X color="#E5E7EB" size={18} />
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={onSave} disabled={!canSave || isUpdating} style={[styles.saveBtn, (!canSave || isUpdating) && styles.saveBtnDisabled]} testID="btn-save">
            {isUpdating ? <Loader2 color="#0B0B0F" size={16} /> : <Check color="#0B0B0F" size={16} />}
            <Text style={styles.saveText}>{isUpdating ? "Saving..." : "Save"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing === "name" && "Edit name"}
              {editing === "location" && "Edit location"}
              {editing === "bio" && "Edit bio"}
              {editing === "avatar" && "Edit avatar URL"}
              {editing === "banner" && "Edit cover image URL"}
              {editing === "instagram" && "Instagram link"}
              {editing === "youtube" && "YouTube link"}
              {editing === "twitter" && "Twitter link"}
              {editing === "tiktok" && "TikTok link"}
            </Text>
            <TextInput
              value={temp}
              onChangeText={setTemp}
              placeholder={editing === "bio" ? "About you" : "https://"}
              placeholderTextColor="#6B7280"
              style={[styles.input, styles.modalInput, editing === "bio" ? styles.multiline : undefined]}
              autoCapitalize="none"
              multiline={editing === "bio"}
              numberOfLines={editing === "bio" ? 4 : 1}
              maxLength={editing === "bio" ? 200 : 200}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(null)} style={styles.cancelBtn}>
                <X color="#E5E7EB" size={18} />
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
              <Pressable onPress={applyEdit} style={styles.saveBtn}>
                <Check color="#0B0B0F" size={16} />
                <Text style={styles.saveText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  coverWrap: { width: "100%", height: 320, backgroundColor: "#111318" },
  cover: { width: "100%", height: 320 },
  coverOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#00000040" },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 260 },
  coverEditFab: { position: "absolute", right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  avatarFloating: { position: "absolute", bottom: -56, left: 0, right: 0, alignItems: "center" },
  hero: { width: "100%", paddingTop: 80, paddingBottom: 24 },
  heroGradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0B0B0F" },
  heroContent: { alignItems: "center", paddingHorizontal: 16 },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, overflow: "hidden", borderWidth: 3, borderColor: "#0B0B0F", backgroundColor: "#111318" },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  editFab: { position: "absolute", right: -2, bottom: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  nameRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  nameText: { color: "#E5E7EB", fontSize: 22, fontWeight: "900" },
  inlineEditBtn: { marginLeft: 6, padding: 6, borderRadius: 16 },
  inlineEditBtnSmall: { marginLeft: 6, padding: 4, borderRadius: 14 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  locationText: { color: "#9CA3AF", fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 36, marginTop: 18 },
  statItem: { alignItems: "center" },
  statValue: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  socialRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  socialBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  bioWrap: { marginTop: 18, maxWidth: 360, width: "100%", alignItems: "center" },
  bioText: { color: "#E5E7EB", fontSize: 14, textAlign: "center" as const },
  portfolioSection: { marginTop: 24, marginHorizontal: 16 },
  portfolioHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  portfolioTitle: { color: "#E5E7EB", fontSize: 18, fontWeight: "900" },
  addPortfolioBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#14141C", borderWidth: 1, borderColor: "#23232B", alignItems: "center", justifyContent: "center" },
  cardUpload: { backgroundColor: "#111318", borderRadius: 16, padding: 16, alignItems: "center" },
  dashed: { width: "100%", height: 90, borderRadius: 12, borderStyle: "dashed", borderWidth: 2, borderColor: "#2C2C33" },
  uploadTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "900", marginTop: 12 },
  uploadSubtitle: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  portfolioItemWrap: { width: "31%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#14141C" },
  portfolioImage: { width: "100%", height: "100%" },
  deletePortfolioBtn: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingHorizontal: 16 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "#2C2C33", backgroundColor: "#121218", flexDirection: "row", alignItems: "center", gap: 8 },
  cancelText: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#E5E7EB", flexDirection: "row", alignItems: "center", gap: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: "#0B0B0F", fontSize: 14, fontWeight: "900" },
  input: { color: "#E5E7EB", fontSize: 15, fontWeight: "600" },
  multiline: { minHeight: 100, textAlignVertical: "top" as const },
  modalBackdrop: { flex: 1, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: "#0F0F14", borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "#2C2C33" },
  modalTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "900", marginBottom: 8 },
  modalInput: { backgroundColor: "#14141C", borderColor: "#23232B", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
});
