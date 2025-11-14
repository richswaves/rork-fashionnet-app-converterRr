import React, { useMemo, useState, useEffect } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Dimensions } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";
import { Check, X, Loader2, Pencil, MapPin, Instagram, Youtube, CircleX, Image as ImageIcon, Plus, Trash2, Play, Shield, ChevronDown } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { LinearGradient } from "expo-linear-gradient";
import { getSupabase, sbSelect, sbInsert, sbDelete } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PortfolioItem } from "@/integrations/supabase/portfolio-types";

const ROLE_OPTIONS = [
  "Model",
  "Photographer",
  "Videographer",
  "Content Creator",
  "Stylist",
  "Designer",
  "Creative Director",
  "Clothing Brand",
  "Agency",
  "Publisher",
  "Photography Business",
  "Other",
];
import { trpc } from "@/lib/trpc";
import * as FileSystem from "expo-file-system";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isUpdating, updateProfileAsync, resolvedProfile, logout, session } = useProfile();

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
    | "phone"
    | "email"
    | "password"
    | "delete_confirm"
    | "delete_reason"
    | "custom_link"
    | "roles"
  >(null);
  const [temp, setTemp] = useState<string>("");
  const [socialLinks, setSocialLinks] = useState<{
    instagram?: string;
    youtube?: string;
    twitter?: string;
    tiktok?: string;
  }>((profile as any)?.social_links ?? {});
  const [phoneNumber, setPhoneNumber] = useState<string>((profile as any)?.phone_number ?? "");
  const [email, setEmail] = useState<string>(session?.user?.email ?? "");
  const [password, setPassword] = useState<string>("");
  const [oldPassword, setOldPassword] = useState<string>("");
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [customLinks, setCustomLinks] = useState<Array<{ name: string; url: string }>>((profile as any)?.custom_links ?? []);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number>(-1);
  const [linkName, setLinkName] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [inlineEditingIndex, setInlineEditingIndex] = useState<number>(-1);
  const [showBlockedUsers, setShowBlockedUsers] = useState<boolean>(false);
  const [primaryRole, setPrimaryRole] = useState<string>(profile?.profession || "");
  const [secondaryRole, setSecondaryRole] = useState<string>(
    (profile?.professions && profile.professions.length > 1) ? profile.professions[1] : ""
  );
  const [showRoleDropdown, setShowRoleDropdown] = useState<"primary" | "secondary" | null>(null);

  useEffect(() => {
    setPrimaryRole(profile?.profession || "");
    setSecondaryRole(
      (profile?.professions && profile.professions.length > 1) ? profile.professions[1] : ""
    );
  }, [profile?.profession, profile?.professions]);

  const queryClient = useQueryClient();
  const currentUserId = profile?.user_id;

  const { data: blockedList = [] } = trpc.block.listBlocked.useQuery(undefined, {
    enabled: !!currentUserId,
  });

  const { data: blockedUsers = [] } = useQuery<Array<{ blocked_user_id: string; blocked_user_profile: { full_name?: string; username?: string; profile_picture?: string } }>>({
    queryKey: ["blocked-users-profiles", currentUserId, blockedList],
    queryFn: async () => {
      if (!currentUserId || !blockedList || blockedList.length === 0) return [];
      try {
        const blockedIds = blockedList.map((b) => b.blocked_user_id);
        const profiles = await sbSelect<{ user_id: string; full_name?: string; username?: string; profile_picture?: string }>("profiles", {
          select: "user_id,full_name,username,profile_picture",
          query: {},
          limit: 1000,
        });
        
        const blockedProfiles = profiles.filter((p) => blockedIds.includes(p.user_id));
        return blockedProfiles.map((p) => ({
          blocked_user_id: p.user_id,
          blocked_user_profile: {
            full_name: p.full_name,
            username: p.username,
            profile_picture: p.profile_picture,
          },
        }));
      } catch (error) {
        console.error("[BlockedUsers] Error fetching blocked users:", error);
        return [];
      }
    },
    enabled: !!currentUserId && blockedList.length > 0,
  });

  const unblockMutation = trpc.block.unblock.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-users-profiles", currentUserId] });
    },
    onError: (error: any) => {
      console.error("[Unblock] Error:", error);
      Alert.alert("Error", "Failed to unblock user");
    },
  });

  function handleUnblock(blockedUserId: string, userName: string) {
    if (Platform.OS === "web") {
      if (confirm(`Are you sure you want to unblock ${userName}?`)) {
        unblockMutation.mutate({ targetUserId: blockedUserId });
      }
    } else {
      Alert.alert(
        "Unblock User",
        `Are you sure you want to unblock ${userName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: () => unblockMutation.mutate({ targetUserId: blockedUserId }),
          },
        ]
      );
    }
  }

  const { data: isAdmin } = useQuery<boolean>({
    queryKey: ["is-admin", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return false;
      const rows = await sbSelect<{ user_id: string; role: string }>("user_roles", {
        select: "user_id,role",
        query: { user_id: `eq.${currentUserId}`, role: "eq.admin" },
        limit: 1,
      });
      return (rows?.length ?? 0) > 0;
    },
    enabled: !!currentUserId,
  });

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
      console.log("[Portfolio] Uploading asset", asset.uri, asset.type);
      const url = await uploadToSupabase(asset, "portfolio");
      console.log("[Portfolio] Asset uploaded to", url);
      
      const isVideo = asset.type === "video" || (asset as any).mimeType?.startsWith("video/");
      const item: Record<string, any> = {
        user_id: currentUserId,
        media_url: url,
        media_type: isVideo ? "video" : "image",
      };
      
      if (isVideo && asset.duration) {
        item.duration = Math.floor(asset.duration / 1000);
      }
      
      const inserted = await sbInsert("portfolio_items", item);
      console.log("[Portfolio] Item inserted", inserted);
      return inserted;
    },
    onMutate: async (asset: ImagePicker.ImagePickerAsset) => {
      console.log("[Portfolio] Starting optimistic update");
      await queryClient.cancelQueries({ queryKey: ["portfolio", currentUserId] });
      
      const previousItems = queryClient.getQueryData<PortfolioItem[]>(["portfolio", currentUserId]);
      
      const isVideo = asset.type === "video" || (asset as any).mimeType?.startsWith("video/");
      const optimisticItem: PortfolioItem = {
        id: `temp-${Date.now()}`,
        user_id: currentUserId!,
        media_url: asset.uri,
        media_type: isVideo ? "video" : "image",
        created_at: new Date().toISOString(),
        duration: isVideo && asset.duration ? Math.floor(asset.duration / 1000) : undefined,
      } as PortfolioItem;
      
      queryClient.setQueryData<PortfolioItem[]>(["portfolio", currentUserId], (old = []) => [
        optimisticItem,
        ...old,
      ]);
      
      return { previousItems };
    },
    onSuccess: async (data) => {
      console.log("[Portfolio] Upload successful, refetching data");
      await queryClient.invalidateQueries({ queryKey: ["portfolio", currentUserId] });
    },
    onError: (error: any, _variables, context) => {
      console.error("[Portfolio] Upload error", error);
      if (context?.previousItems) {
        queryClient.setQueryData(["portfolio", currentUserId], context.previousItems);
      }
      Alert.alert("Error", "Failed to upload portfolio item");
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!currentUserId) throw new Error("Must be logged in");
      await sbDelete("portfolio_items", { id: itemId });
      return itemId;
    },
    onMutate: async (itemId: string) => {
      console.log("[Portfolio] Starting optimistic delete for", itemId);
      await queryClient.cancelQueries({ queryKey: ["portfolio", currentUserId] });
      const previousItems = queryClient.getQueryData<PortfolioItem[]>(["portfolio", currentUserId]);
      queryClient.setQueryData<PortfolioItem[]>(["portfolio", currentUserId], (old = []) => old.filter((item) => item.id !== itemId));
      return { previousItems };
    },
    onError: (error: any, _variables, context) => {
      console.error("[Portfolio] Delete error", error);
      if (context?.previousItems) {
        queryClient.setQueryData(["portfolio", currentUserId], context.previousItems);
      }
      Alert.alert("Error", "Failed to delete portfolio item");
    },
    onSuccess: async () => {
      console.log("[Portfolio] Delete success, ensuring fresh data");
      await queryClient.invalidateQueries({ queryKey: ["portfolio", currentUserId] });
      queryClient.refetchQueries({ queryKey: ["portfolio", currentUserId] });
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
      case "phone":
        setTemp(phoneNumber);
        break;
      case "email":
        setTemp(email);
        break;
      case "password":
        setOldPassword("");
        setPassword("");
        setTemp("");
        break;
      case "custom_link":
        setLinkName("");
        setLinkUrl("");
        setEditingLinkIndex(-1);
        break;
      case "roles":
        setPrimaryRole(profile?.profession || "");
        setSecondaryRole(
          (profile?.professions && profile.professions.length > 1) ? profile.professions[1] : ""
        );
        setShowRoleDropdown(null);
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

  async function pickFromLibrary(allowsEditing = true, mediaTypes: ImagePicker.MediaTypeOptions = ImagePicker.MediaTypeOptions.Images): Promise<ImagePicker.ImagePickerAsset | null> {
    const ok = await ensureMediaPermission();
    if (!ok) return null;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
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

    const mime = (asset as any).mimeType ?? "image/jpeg";
    let base64Data: string;

    try {
      if (asset.base64 && asset.base64.length > 0) {
        console.log("[upload] Using base64 data from asset");
        base64Data = asset.base64;
      } else {
        console.log("[upload] Reading file using FileSystem");
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

  async function applyEdit() {
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
    if (editing === "phone") setPhoneNumber(val);
    if (editing === "email") setEmail(val);
    if (editing === "password") {
      if (oldPassword.trim().length === 0) {
        Alert.alert("Old Password Required", "Please enter your current password to change it.");
        return;
      }
      if (val.length < 6) {
        Alert.alert("Password Too Short", "Password must be at least 6 characters.");
        return;
      }
      setPassword(val);
    }
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

      if (phoneNumber !== ((profile as any)?.phone_number ?? "")) {
        (updates as any).phone_number = phoneNumber;
        console.log("[onSave] Adding phone_number to updates:", phoneNumber);
      }

      const supabase = getSupabase();
      if (email !== (session?.user?.email ?? "") && supabase) {
        console.log("[onSave] Updating email in auth");
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) {
          console.error("[onSave] Email update failed:", emailError);
          throw new Error(`Failed to update email: ${emailError.message}`);
        }
      }

      if (password.trim().length > 0 && supabase) {
        console.log("[onSave] Verifying old password and updating password in auth");
        
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: session?.user?.email ?? email,
          password: oldPassword,
        });
        
        if (verifyError) {
          console.error("[onSave] Old password verification failed:", verifyError);
          throw new Error("Incorrect old password. Please try again.");
        }
        
        const { error: passwordError } = await supabase.auth.updateUser({ password: password.trim() });
        if (passwordError) {
          console.error("[onSave] Password update failed:", passwordError);
          throw new Error(`Failed to update password: ${passwordError.message}`);
        }
        
        console.log("[onSave] Password updated successfully");
        Alert.alert("Success", "Your password has been updated successfully.");
        setPassword("");
        setOldPassword("");
      }

      const existingLinks = (profile as any)?.custom_links ?? [];
      const hasChangedLinks = JSON.stringify(customLinks) !== JSON.stringify(existingLinks);
      if (hasChangedLinks) {
        updates.custom_links = customLinks;
        console.log("[onSave] Adding custom_links to updates:", customLinks);
      }

      if (primaryRole !== (profile?.profession ?? "")) {
        updates.profession = primaryRole;
        const roles = [primaryRole];
        if (secondaryRole && secondaryRole.trim().length > 0) {
          roles.push(secondaryRole);
        }
        updates.professions = roles;
        console.log("[onSave] Adding profession and professions to updates:", updates.profession, updates.professions);
      } else if (secondaryRole !== ((profile?.professions && profile.professions.length > 1) ? profile.professions[1] : "")) {
        const roles = [primaryRole || profile?.profession || ""];
        if (secondaryRole && secondaryRole.trim().length > 0) {
          roles.push(secondaryRole);
        }
        updates.professions = roles;
        console.log("[onSave] Adding professions to updates:", updates.professions);
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
      const asset = await pickFromLibrary(false, ImagePicker.MediaTypeOptions.All);
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
    if (Platform.OS === "web") {
      const ok = confirm("Delete this portfolio item?");
      if (ok) deletePortfolioMutation.mutate(itemId);
      return;
    }
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
          {(bannerUrl && bannerUrl.trim().length > 0) || "https://images.unsplash.com/photo-1517816428104-797678c7cf0d?w=1600&auto=format&fit=crop&q=60" ? (
            <Image 
              key={bannerUrl}
              source={{ uri: bannerUrl && bannerUrl.trim().length > 0 ? bannerUrl : "https://images.unsplash.com/photo-1517816428104-797678c7cf0d?w=1600&auto=format&fit=crop&q=60" }} 
              style={styles.cover} 
              resizeMode="cover" 
            />
          ) : null}
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
              {(avatarUrl && avatarUrl.trim().length > 0) || resolvedProfile.avatarUrl ? (
                <Image 
                  key={avatarUrl}
                  source={{ uri: (avatarUrl && avatarUrl.trim().length > 0) ? avatarUrl : resolvedProfile.avatarUrl }} 
                  style={styles.avatar} 
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: "#14141C", alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ color: "#9CA3AF", fontSize: 14 }}>No Avatar</Text>
                </View>
              )}
              <Pressable testID="edit-avatar" onPress={onPickAvatar} style={styles.editFab}>
                <Pencil color="#0B0B0F" size={16} />
              </Pressable>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroContent}>

            <View style={styles.saveReminder}>
              <Text style={styles.saveReminderText}>💡 Remember to select Save at the bottom for changes to apply</Text>
            </View>

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

            <View style={styles.bioWrap}>
              <Text style={styles.bioText}>{bio || "Tell people about yourself..."}</Text>
              <Pressable testID="edit-bio" onPress={() => openEditor("bio")} style={styles.inlineEditBtn}>
                <Pencil color="#E5E7EB" size={16} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.rolesSection}>
          <View style={styles.rolesSectionHeader}>
            <Text style={styles.rolesSectionTitle}>Professional Roles</Text>
            <Pressable
              onPress={() => openEditor("roles")}
              style={styles.editRolesBtn}
              testID="edit-roles-btn"
            >
              <Pencil color="#E5E7EB" size={16} />
            </Pressable>
          </View>
          <View style={styles.rolesCards}>
            <View style={styles.roleCard}>
              <Text style={styles.roleCardLabel}>Primary Role</Text>
              <Text style={styles.roleCardValue}>{primaryRole || profile?.profession || "Not set"}</Text>
            </View>
            {(secondaryRole || (profile?.professions && profile.professions.length > 1)) && (
              <View style={styles.roleCard}>
                <Text style={styles.roleCardLabel}>Secondary Role</Text>
                <Text style={styles.roleCardValue}>
                  {secondaryRole || (profile?.professions && profile.professions[1]) || "None"}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.linksSection}>
          <View style={styles.linksSectionHeader}>
            <Text style={styles.linksSectionTitle}>Custom Links</Text>
            <Pressable
              onPress={() => {
                setEditingLinkIndex(-1);
                openEditor("custom_link");
              }}
              style={styles.addLinkBtn}
              testID="add-link-btn"
            >
              <Plus color="#E5E7EB" size={18} />
            </Pressable>
          </View>
          {customLinks.length === 0 ? (
            <Text style={styles.emptyLinksText}>No custom links added yet</Text>
          ) : (
            <View style={styles.linksList}>
              {Array.isArray(customLinks) && customLinks.map((link, index) => (
                <View key={index} style={styles.linkCard}>
                  {inlineEditingIndex === index ? (
                    <View style={styles.linkCardEditMode}>
                      <TextInput
                        value={link.name}
                        onChangeText={(text) => {
                          setCustomLinks(prev => prev.map((l, i) => 
                            i === index ? { ...l, name: text } : l
                          ));
                        }}
                        placeholder="Link Name"
                        placeholderTextColor="#6B7280"
                        style={styles.inlineLinkInput}
                        autoFocus
                      />
                      <TextInput
                        value={link.url}
                        onChangeText={(text) => {
                          setCustomLinks(prev => prev.map((l, i) => 
                            i === index ? { ...l, url: text } : l
                          ));
                        }}
                        placeholder="URL"
                        placeholderTextColor="#6B7280"
                        style={styles.inlineLinkInput}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                      <View style={styles.inlineEditActions}>
                        <Pressable
                          onPress={() => {
                            if (!link.name.trim() || !link.url.trim()) {
                              Alert.alert("Error", "Please fill in both name and URL");
                              return;
                            }
                            setInlineEditingIndex(-1);
                            Alert.alert("Remember", "Select Save on profile page for changes to apply");
                          }}
                          style={styles.inlineSaveBtn}
                          testID={`save-inline-link-${index}`}
                        >
                          <Check color="#0B0B0F" size={16} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setCustomLinks(prev => prev.filter((_, i) => i !== index));
                            setInlineEditingIndex(-1);
                          }}
                          style={styles.inlineDeleteBtn}
                          testID={`delete-inline-link-${index}`}
                        >
                          <Trash2 color="#FFF" size={16} />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.linkCardContent}>
                        <Text style={styles.linkName}>{link.name}</Text>
                        <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                      </View>
                      <View style={styles.linkCardActions}>
                        <Pressable
                          onPress={() => {
                            setInlineEditingIndex(index);
                          }}
                          style={styles.linkEditBtn}
                          testID={`edit-link-${index}`}
                        >
                          <Pencil color="#9CA3AF" size={16} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setCustomLinks(prev => prev.filter((_, i) => i !== index));
                          }}
                          style={styles.linkDeleteBtn}
                          testID={`delete-link-${index}`}
                        >
                          <Trash2 color="#EF4444" size={16} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
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
            <MasonryPortfolio items={portfolioItems} onDelete={onDeletePortfolio} />
          )}
        </View>

        {Array.isArray(blockedUsers) && blockedUsers.length > 0 && (
          <View style={styles.blockedSection}>
            <Pressable 
              onPress={() => setShowBlockedUsers(!showBlockedUsers)}
              style={styles.blockedSectionHeader}
              testID="toggle-blocked-users"
            >
              <Text style={styles.blockedSectionTitle}>Blocked ({blockedUsers.length})</Text>
              <Text style={styles.blockedToggleIcon}>{showBlockedUsers ? '−' : '+'}</Text>
            </Pressable>
            {showBlockedUsers && (
              <View style={styles.blockedUsersList}>
                {blockedUsers.map((block) => {
                  const user = (block as any).blocked_user_profile;
                  const displayName = user?.full_name || user?.username || "Unknown User";
                  const avatarUrl = user?.profile_picture || "";
                  
                  return (
                    <View key={block.blocked_user_id} style={styles.blockedUserCard}>
                      <View style={styles.blockedUserLeft}>
                        {(avatarUrl && avatarUrl.trim().length > 0) || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100" ? (
                          <Image 
                            source={{ uri: (avatarUrl && avatarUrl.trim().length > 0) ? avatarUrl : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100" }}
                            style={styles.blockedUserAvatar}
                          />
                        ) : (
                          <View style={[styles.blockedUserAvatar, { backgroundColor: "#14141C" }]} />
                        )}
                        <Text style={styles.blockedUserName}>{displayName}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleUnblock(block.blocked_user_id, displayName)}
                        disabled={unblockMutation.isPending}
                        style={styles.unblockBtn}
                        testID={`unblock-${block.blocked_user_id}`}
                      >
                        {unblockMutation.isPending ? (
                          <Loader2 color="#E5E7EB" size={16} />
                        ) : (
                          <Text style={styles.unblockText}>Unblock</Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Account Information</Text>
          <View style={styles.infoSection}>
            <Pressable style={styles.infoRow} onPress={() => openEditor("email")} testID="edit-email">
              <Text style={styles.infoLabel}>Email:</Text>
              <View style={styles.infoValueRow}>
                <Text style={styles.infoValue}>{email || "N/A"}</Text>
                <Pencil color="#9CA3AF" size={14} />
              </View>
            </Pressable>
            <Pressable style={styles.infoRow} onPress={() => openEditor("password")} testID="edit-password">
              <Text style={styles.infoLabel}>Password:</Text>
              <View style={styles.infoValueRow}>
                <Text style={styles.infoValue}>••••••••</Text>
                <Pencil color="#9CA3AF" size={14} />
              </View>
            </Pressable>
            <Pressable style={styles.infoRow} onPress={() => openEditor("phone")} testID="edit-phone">
              <Text style={styles.infoLabel}>Phone:</Text>
              <View style={styles.infoValueRow}>
                <Text style={styles.infoValue}>{phoneNumber || "Not set"}</Text>
                <Pencil color="#9CA3AF" size={14} />
              </View>
            </Pressable>
            <View style={[styles.infoRow, styles.infoRowNonEditable]}>
              <Text style={styles.infoLabel}>User ID:</Text>
              <Text style={[styles.infoValue, styles.infoValueNonEditable]}>{currentUserId ?? "N/A"}</Text>
            </View>
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

          {isAdmin && (
            <Pressable
              onPress={() => router.push("/admin/approvals" as any)}
              style={styles.adminBtn}
              testID="btn-admin-access"
            >
              <Shield color="#8B5CF6" size={18} />
              <Text style={styles.adminText}>Admin Panel</Text>
            </Pressable>
          )}
          <Pressable 
            onPress={async () => {
              if (Platform.OS === "web") {
                if (confirm("Are you sure you want to log out?")) {
                  await logout();
                  router.replace("/login");
                }
              } else {
                Alert.alert(
                  "Log Out",
                  "Are you sure you want to log out?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Log Out",
                      style: "destructive",
                      onPress: async () => {
                        await logout();
                        router.replace("/login");
                      },
                    },
                  ]
                );
              }
            }}
            style={styles.logoutBtn}
            testID="btn-logout"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {editing === "delete_confirm" ? (
              <>
                <Text style={styles.modalTitle}>Delete Account?</Text>
                <Text style={styles.modalSubtitle}>Are you sure you want to delete your account? This action cannot be undone.</Text>
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEditing(null)} style={styles.cancelBtn}>
                    <X color="#E5E7EB" size={18} />
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditing("delete_reason")} style={[styles.saveBtn, { backgroundColor: "#DC2626" }]}>
                    <Text style={[styles.saveText, { color: "#FFF" }]}>Continue</Text>
                  </Pressable>
                </View>
              </>
            ) : editing === "delete_reason" ? (
              <>
                <Text style={styles.modalTitle}>Why are you leaving?</Text>
                <Text style={styles.modalSubtitle}>Help us improve by sharing your reason</Text>
                <View style={{ gap: 8, marginVertical: 12 }}>
                  {[
                    "Not finding relevant connections",
                    "Privacy concerns",
                    "Too many notifications",
                    "Not using the app anymore",
                    "Found another platform",
                    "Just trying it out",
                    "Other"
                  ].map((reason) => (
                    <Pressable
                      key={reason}
                      onPress={() => setDeleteReason(reason)}
                      style={[
                        styles.reasonOption,
                        deleteReason === reason && styles.reasonOptionActive
                      ]}
                    >
                      <Text style={[
                        styles.reasonText,
                        deleteReason === reason && styles.reasonTextActive
                      ]}>{reason}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEditing("delete_confirm")} style={styles.cancelBtn}>
                    <X color="#E5E7EB" size={18} />
                    <Text style={styles.cancelText}>Back</Text>
                  </Pressable>
                  <Pressable 
                    onPress={async () => {
                      if (!deleteReason) {
                        Alert.alert("Please select a reason", "We'd appreciate knowing why you're leaving.");
                        return;
                      }
                      try {
                        const supabase = getSupabase();
                        if (!supabase) throw new Error("Supabase not configured");
                        
                        try {
                          await sbInsert("account_deletion_feedback", {
                            user_id: currentUserId,
                            reason: deleteReason,
                            deleted_at: new Date().toISOString(),
                          } as any);
                        } catch (feedbackError: any) {
                          console.error("[Delete] Feedback logging failed (non-critical):", feedbackError?.message || JSON.stringify(feedbackError));
                        }
                        
                        const { error } = await supabase.rpc("delete_user_account", { target_user_id: currentUserId });
                        
                        if (error) {
                          console.error("[Delete] Account deletion failed:", error?.message || JSON.stringify(error));
                          Alert.alert("Error", "Failed to delete account. Please contact support.");
                          return;
                        }
                        
                        await logout();
                        router.replace("/login");
                        Alert.alert("Account Deleted", "Your account has been successfully deleted.");
                      } catch (e: any) {
                        console.error("[Delete] Error:", e?.message || JSON.stringify(e));
                        Alert.alert("Error", e?.message || "Failed to delete account");
                      }
                    }}
                    style={[styles.saveBtn, { backgroundColor: "#DC2626" }]}
                    disabled={!deleteReason}
                  >
                    <Text style={[styles.saveText, { color: "#FFF" }]}>Delete Account</Text>
                  </Pressable>
                </View>
              </>
            ) : editing === "roles" ? (
              <>
                <Text style={styles.modalTitle}>Edit Professional Roles</Text>
                <Text style={styles.fieldLabel}>Primary Role *</Text>
                <Pressable
                  style={styles.roleDropdownBtn}
                  onPress={() => setShowRoleDropdown(showRoleDropdown === "primary" ? null : "primary")}
                >
                  <Text style={[styles.roleDropdownText, !primaryRole && styles.placeholder]}>
                    {primaryRole || "Select primary role"}
                  </Text>
                  <ChevronDown color="#E5E7EB" size={16} />
                </Pressable>
                {showRoleDropdown === "primary" && (
                  <ScrollView style={styles.roleDropdownMenu}>
                    {ROLE_OPTIONS.map((role) => (
                      <Pressable
                        key={role}
                        style={[styles.roleDropdownItem, primaryRole === role && styles.roleDropdownItemActive]}
                        onPress={() => {
                          setPrimaryRole(role);
                          setShowRoleDropdown(null);
                        }}
                      >
                        <Text style={[styles.roleDropdownItemText, primaryRole === role && styles.roleDropdownItemTextActive]}>
                          {role}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Secondary Role (Optional)</Text>
                <Pressable
                  style={styles.roleDropdownBtn}
                  onPress={() => setShowRoleDropdown(showRoleDropdown === "secondary" ? null : "secondary")}
                >
                  <Text style={[styles.roleDropdownText, !secondaryRole && styles.placeholder]}>
                    {secondaryRole || "Select secondary role (optional)"}
                  </Text>
                  <ChevronDown color="#E5E7EB" size={16} />
                </Pressable>
                {showRoleDropdown === "secondary" && (
                  <ScrollView style={styles.roleDropdownMenu}>
                    <Pressable
                      style={[styles.roleDropdownItem, !secondaryRole && styles.roleDropdownItemActive]}
                      onPress={() => {
                        setSecondaryRole("");
                        setShowRoleDropdown(null);
                      }}
                    >
                      <Text style={[styles.roleDropdownItemText, !secondaryRole && styles.roleDropdownItemTextActive]}>
                        None
                      </Text>
                    </Pressable>
                    {ROLE_OPTIONS.filter(r => r !== primaryRole).map((role) => (
                      <Pressable
                        key={role}
                        style={[styles.roleDropdownItem, secondaryRole === role && styles.roleDropdownItemActive]}
                        onPress={() => {
                          setSecondaryRole(role);
                          setShowRoleDropdown(null);
                        }}
                      >
                        <Text style={[styles.roleDropdownItemText, secondaryRole === role && styles.roleDropdownItemTextActive]}>
                          {role}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEditing(null)} style={styles.cancelBtn}>
                    <X color="#E5E7EB" size={18} />
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (!primaryRole) {
                        Alert.alert("Error", "Please select a primary role");
                        return;
                      }
                      setEditing(null);
                      Alert.alert("Remember", "Select Save on profile page for changes to apply");
                    }}
                    style={styles.saveBtn}
                  >
                    <Check color="#0B0B0F" size={16} />
                    <Text style={styles.saveText}>Apply</Text>
                  </Pressable>
                </View>
              </>
            ) : editing === "custom_link" ? (
              <>
                <Text style={styles.modalTitle}>
                  {editingLinkIndex === -1 ? "Add Custom Link" : "Edit Custom Link"}
                </Text>
                <Text style={styles.fieldLabel}>Link Name</Text>
                <TextInput
                  value={linkName}
                  onChangeText={setLinkName}
                  placeholder="e.g., Portfolio, Website, Store"
                  placeholderTextColor="#6B7280"
                  style={[styles.input, styles.modalInput]}
                  autoCapitalize="words"
                />
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Link URL</Text>
                <TextInput
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  placeholder="https://example.com"
                  placeholderTextColor="#6B7280"
                  style={[styles.input, styles.modalInput]}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEditing(null)} style={styles.cancelBtn}>
                    <X color="#E5E7EB" size={18} />
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (!linkName.trim() || !linkUrl.trim()) {
                        Alert.alert("Error", "Please fill in both name and URL");
                        return;
                      }
                      if (editingLinkIndex === -1) {
                        setCustomLinks(prev => [...prev, { name: linkName.trim(), url: linkUrl.trim() }]);
                      } else {
                        setCustomLinks(prev => prev.map((link, i) => 
                          i === editingLinkIndex ? { name: linkName.trim(), url: linkUrl.trim() } : link
                        ));
                      }
                      setEditing(null);
                      setLinkName("");
                      setLinkUrl("");
                      setEditingLinkIndex(-1);
                      Alert.alert("Remember", "Select Save on profile page for changes to apply");
                    }}
                    style={styles.saveBtn}
                  >
                    <Check color="#0B0B0F" size={16} />
                    <Text style={styles.saveText}>{editingLinkIndex === -1 ? "Add" : "Save"}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
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
                  {editing === "phone" && "Phone number"}
                  {editing === "email" && "Email address"}
                  {editing === "password" && "Change password"}
                </Text>
                {editing === "password" && (
                  <>
                    <Text style={styles.fieldLabel}>Current Password</Text>
                    <TextInput
                      value={oldPassword}
                      onChangeText={setOldPassword}
                      placeholder="Enter your current password"
                      placeholderTextColor="#6B7280"
                      style={[styles.input, styles.modalInput]}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                    <Text style={[styles.fieldLabel, { marginTop: 8 }]}>New Password</Text>
                  </>
                )}
                <TextInput
                  value={temp}
                  onChangeText={setTemp}
                  placeholder={
                    editing === "bio" ? "About you" : 
                    editing === "phone" ? "+1 (555) 123-4567" : 
                    editing === "email" ? "email@example.com" :
                    editing === "password" ? "Enter new password" :
                    "https://"
                  }
                  placeholderTextColor="#6B7280"
                  style={[styles.input, styles.modalInput, editing === "bio" ? styles.multiline : undefined]}
                  autoCapitalize={editing === "email" || editing === "password" ? "none" : "sentences"}
                  multiline={editing === "bio"}
                  numberOfLines={editing === "bio" ? 4 : 1}
                  maxLength={editing === "bio" ? 200 : 200}
                  keyboardType={
                    editing === "phone" ? "phone-pad" : 
                    editing === "email" ? "email-address" : 
                    "default"
                  }
                  secureTextEntry={editing === "password"}
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
              </>
            )}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  videoDuration: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDurationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  deletePortfolioBtn: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", zIndex: 10 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 24 },
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
  dangerZone: {
    marginTop: 40,
    marginHorizontal: 16,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2C2C33",
  },
  dangerZoneTitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  logoutBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  adminBtn: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  adminText: {
    color: "#8B5CF6",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  infoSection: {
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
  },
  infoValue: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end" as const,
  },
  infoRowNonEditable: {
    opacity: 0.6,
  },
  infoValueNonEditable: {
    flex: 1,
    textAlign: "right" as const,
  },
  deleteBtn: {
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DC2626",
    marginTop: 8,
  },
  deleteText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  reasonOption: {
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#23232B",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  reasonOptionActive: {
    backgroundColor: "#E5E7EB",
    borderColor: "#E5E7EB",
  },
  reasonText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  reasonTextActive: {
    color: "#0B0B0F",
    fontWeight: "700",
  },
  fieldLabel: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  contactSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  contactCard: {
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "700",
  },
  contactValue: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 2,
  },
  blockedSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  blockedSectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#111318",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  blockedSectionTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "800" as const,
  },
  blockedToggleIcon: {
    color: "#E5E7EB",
    fontSize: 24,
    fontWeight: "300" as const,
  },
  blockedUsersList: {
    gap: 8,
  },
  blockedUserCard: {
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  blockedUserLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  blockedUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#14141C",
  },
  blockedUserName: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "600" as const,
    flex: 1,
  },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  unblockText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  linksSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  linksSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  linksSectionTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900" as const,
  },
  addLinkBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#23232B",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLinksText: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center" as const,
    paddingVertical: 20,
  },
  linksList: {
    gap: 8,
  },
  linkCard: {
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  linkCardContent: {
    flex: 1,
    marginRight: 12,
  },
  linkName: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  linkUrl: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500" as const,
  },
  linkCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  linkEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#23232B",
    alignItems: "center",
    justifyContent: "center",
  },
  linkDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#23232B",
    alignItems: "center",
    justifyContent: "center",
  },
  saveReminder: {
    backgroundColor: "rgba(229, 231, 235, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(229, 231, 235, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  saveReminderText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  linkCardEditMode: {
    flex: 1,
    gap: 8,
  },
  inlineLinkInput: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  inlineEditActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  inlineSaveBtn: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineDeleteBtn: {
    width: 44,
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rolesSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  rolesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rolesSectionTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900" as const,
  },
  editRolesBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#14141C",
    borderWidth: 1,
    borderColor: "#23232B",
    alignItems: "center",
    justifyContent: "center",
  },
  rolesCards: {
    gap: 12,
  },
  roleCard: {
    backgroundColor: "#111318",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2C2C33",
  },
  roleCardLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  roleCardValue: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  roleDropdownBtn: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  roleDropdownText: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  roleDropdownMenu: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  roleDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
  },
  roleDropdownItemActive: {
    backgroundColor: "#1A1A24",
  },
  roleDropdownItemText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  roleDropdownItemTextActive: {
    color: "#4CB963",
    fontWeight: "700" as const,
  },

});

function MasonryPortfolio({ items, onDelete }: { items: PortfolioItem[]; onDelete: (id: string) => void }) {
  const screenWidth = Dimensions.get("window").width;
  const padding = 16;
  const gap = 6;
  const numColumns = 2;
  const columnWidth = (screenWidth - padding * 2 - gap * (numColumns - 1)) / numColumns;

  const columns: PortfolioItem[][] = useMemo(() => {
    const cols: PortfolioItem[][] = Array.from({ length: numColumns }, () => []);
    const columnHeights: number[] = Array(numColumns).fill(0);

    items.forEach((item) => {
      const aspectRatio = 1;
      const itemHeight = columnWidth / aspectRatio;
      
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      cols[shortestColumnIndex].push(item);
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
              <View key={item.id} style={[styles.portfolioItemWrap, { height: itemHeight }]}>
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
                        <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
                      </View>
                    </View>
                    {item.duration && (
                      <View style={styles.videoDuration}>
                        <Text style={styles.videoDurationText}>{formatDuration(item.duration)}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  item.media_url && item.media_url.trim().length > 0 ? (
                    <Image source={{ uri: item.media_url }} style={styles.portfolioImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.portfolioImage, { backgroundColor: "#14141C", alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ color: "#9CA3AF", fontSize: 12 }}>No Image</Text>
                    </View>
                  )
                )}
                <Pressable
                  onPress={() => onDelete(item.id)}
                  style={styles.deletePortfolioBtn}
                  testID={`delete-portfolio-${item.id}`}
                >
                  <Trash2 color="#FFF" size={14} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
