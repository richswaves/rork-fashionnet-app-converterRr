import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";
import { Check, X, Loader2 } from "lucide-react-native";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isUpdating, updateProfile, resolvedProfile } = useProfile();

  const [fullName, setFullName] = useState<string>(profile?.full_name ?? "");
  const [username, setUsername] = useState<string>(profile?.username ?? resolvedProfile.username ?? "");
  const [location, setLocation] = useState<string>(profile?.location ?? "");
  const [bio, setBio] = useState<string>(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.profile_picture ?? resolvedProfile.avatarUrl ?? "");

  const canSave = useMemo<boolean>(() => {
    return (fullName ?? "").trim().length > 0 || (username ?? "").trim().length > 0 || (location ?? "").trim().length > 0 || (bio ?? "").trim().length > 0 || (avatarUrl ?? "").trim().length > 0;
  }, [fullName, username, location, bio, avatarUrl]);

  async function onSave() {
    try {
      const updates: Record<string, string> = {};
      if (fullName !== (profile?.full_name ?? "")) updates.full_name = fullName.trim();
      if (username !== (profile?.username ?? resolvedProfile.username ?? "")) updates.username = username.trim();
      if (location !== (profile?.location ?? "")) updates.location = location.trim();
      if (bio !== (profile?.bio ?? "")) updates.bio = bio.trim();
      if (avatarUrl !== (profile?.profile_picture ?? resolvedProfile.avatarUrl ?? "")) updates.profile_picture = avatarUrl.trim();

      if (Object.keys(updates).length === 0) {
        router.back();
        return;
      }
      updateProfile(updates);
      router.back();
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Failed to update profile";
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    }
  }

  return (
    <View style={[styles.container]} testID="edit-profile-screen">
      <Stack.Screen options={{ headerShown: true, title: "Edit Profile", headerTintColor: "#E5E7EB", headerStyle: { backgroundColor: "#0B0B0F" } }} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Full name</Text>
        <View style={styles.fieldWrap} testID="field-fullname">
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor="#6B7280"
            style={styles.input}
            autoCapitalize="words"
          />
        </View>

        <Text style={styles.label}>Username</Text>
        <View style={styles.fieldWrap} testID="field-username">
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.replace(/\s+/g, "").toLowerCase())}
            placeholder="username"
            placeholderTextColor="#6B7280"
            style={styles.input}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>Location</Text>
        <View style={styles.fieldWrap} testID="field-location">
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="City, State"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
        </View>

        <Text style={styles.label}>Bio</Text>
        <View style={styles.fieldWrap} testID="field-bio">
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            placeholderTextColor="#6B7280"
            style={[styles.input, styles.multiline]}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
          <Text style={styles.counter}>{bio.length} / 200</Text>
        </View>

        <Text style={styles.label}>Avatar URL</Text>
        <View style={styles.fieldWrap} testID="field-avatar">
          <TextInput
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://..."
            placeholderTextColor="#6B7280"
            style={styles.input}
            autoCapitalize="none"
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  label: { color: "#9CA3AF", fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 6, letterSpacing: 0.4 },
  fieldWrap: { backgroundColor: "#14141C", borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: { color: "#E5E7EB", fontSize: 15, fontWeight: "600" },
  multiline: { minHeight: 100, textAlignVertical: "top" as const },
  counter: { color: "#6B7280", fontSize: 11, marginTop: 6, textAlign: "right" as const },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "#2C2C33", backgroundColor: "#121218", flexDirection: "row", alignItems: "center", gap: 8 },
  cancelText: { color: "#E5E7EB", fontSize: 14, fontWeight: "800" },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#E5E7EB", flexDirection: "row", alignItems: "center", gap: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: "#0B0B0F", fontSize: 14, fontWeight: "900" },
});
