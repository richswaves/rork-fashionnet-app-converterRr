import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ChevronDown, Eye, ImagePlus, ThumbsUp, Bookmark, CheckCircle2, Instagram, Youtube } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sbInsert } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

const NEED_TYPES = [
  "Photographer",
  "Model",
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

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { currentUserId, resolvedProfile, profile } = useProfile();

  const [title, setTitle] = useState("");
  const [needType, setNeedType] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState("");
  const [showNeedDropdown, setShowNeedDropdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!title.trim()) throw new Error("Title is required");
      if (!needType) throw new Error("Need type is required");

      const opportunityData = {
        title: title.trim(),
        type: needType,
        location: location.trim() || null,
        user_id: currentUserId,
        image_url: imageUrl || null,
        description: description.trim() || null,
        requirements: requirements.length > 0 ? requirements : null,
        budget: budget.trim() || null,
      };

      console.log("[CreateOpportunity] Inserting:", JSON.stringify(opportunityData, null, 2));
      const result = await sbInsert("opportunities", opportunityData);
      console.log("[CreateOpportunity] Insert result:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      router.back();
    },
    onError: (error) => {
      console.error("[CreateOpportunity] Error:", error);
      console.error("[CreateOpportunity] Error message:", (error as any)?.message);
      alert("Failed to create opportunity. Please try again.");
    },
  });

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement("");
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUrl(result.assets[0].uri);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }
    if (!needType) {
      alert("Please select a need type");
      return;
    }
    createMutation.mutate();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} testID="close-create">
          <X color="#E5E7EB" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Create New Opportunity</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Share a new opportunity with the community</Text>

        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Fashion Photographer Needed"
          placeholderTextColor="#6B7280"
          value={title}
          onChangeText={setTitle}
          testID="input-title"
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>
              Needs <Text style={styles.required}>*</Text>
            </Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => setShowNeedDropdown(!showNeedDropdown)}
              testID="dropdown-needs"
            >
              <Text style={[styles.dropdownText, !needType && styles.placeholder]}>
                {needType || "Select type"}
              </Text>
              <ChevronDown color="#E5E7EB" size={16} />
            </Pressable>
            {showNeedDropdown && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={styles.dropdownScroll}>
                  {NEED_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setNeedType(type);
                        setShowNeedDropdown(false);
                      }}
                      testID={`need-${type}`}
                    >
                      <Text style={styles.dropdownItemText}>{type}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.halfField}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 123 Main St, New York"
              placeholderTextColor="#6B7280"
              value={location}
              onChangeText={setLocation}
              testID="input-location"
            />
          </View>
        </View>

        <Text style={styles.label}>Budget</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. $1,000 - $5,000 or Negotiable"
          placeholderTextColor="#6B7280"
          value={budget}
          onChangeText={setBudget}
          testID="input-budget"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the opportunity in detail..."
          placeholderTextColor="#6B7280"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          testID="input-description"
        />

        <Text style={styles.label}>Image</Text>
        <Pressable
          style={styles.imagePickerBtn}
          onPress={handlePickImage}
          testID="pick-image"
        >
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              <View style={styles.changeImageOverlay}>
                <ImagePlus color="#E5E7EB" size={24} />
                <Text style={styles.changeImageText}>Change Image</Text>
              </View>
            </View>
          ) : (
            <View style={styles.imagePickerContent}>
              <ImagePlus color="#6B7280" size={32} />
              <Text style={styles.imagePickerText}>Pick from Camera Roll</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.label}>Requirements</Text>
        <View style={styles.requirementsRow}>
          <TextInput
            style={[styles.input, styles.requirementInput]}
            placeholder="Add a requirement"
            placeholderTextColor="#6B7280"
            value={newRequirement}
            onChangeText={setNewRequirement}
            testID="input-requirement"
          />
          <Pressable
            style={styles.addBtn}
            onPress={handleAddRequirement}
            testID="add-requirement"
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {requirements.length > 0 && (
          <View style={styles.requirementsList}>
            {requirements.map((req, i) => (
              <View key={i} style={styles.requirementItem}>
                <Text style={styles.requirementText}>• {req}</Text>
                <Pressable
                  onPress={() => setRequirements(requirements.filter((_, idx) => idx !== i))}
                  style={styles.removeReqBtn}
                  testID={`remove-req-${i}`}
                >
                  <X color="#9CA3AF" size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={styles.createBtn}
          onPress={handleCreate}
          disabled={createMutation.isPending}
          testID="create-opportunity"
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#0B0B0F" />
          ) : (
            <Text style={styles.createBtnText}>Create Opportunity</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.previewBtn}
          onPress={() => setShowPreview(true)}
          testID="preview"
        >
          <Eye color="#E5E7EB" size={18} />
          <Text style={styles.previewBtnText}>Preview</Text>
        </Pressable>
      </View>

      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={[styles.previewContainer, { paddingTop: insets.top }]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewHeaderTitle}>Preview</Text>
            <Pressable
              onPress={() => setShowPreview(false)}
              style={styles.previewCloseBtn}
              testID="close-preview"
            >
              <X color="#E5E7EB" size={24} />
            </Pressable>
          </View>

          <ScrollView style={styles.previewScroll}>
            <View style={styles.previewCard}>
              <View style={styles.previewPostHeader}>
                <Image
                  source={{ uri: resolvedProfile.avatarUrl }}
                  style={styles.previewPostAvatar}
                />
                <View style={styles.previewPostHeaderInfo}>
                  <Text numberOfLines={1} style={styles.previewPostUsername}>
                    {resolvedProfile.displayName}
                  </Text>
                  <Text numberOfLines={1} style={styles.previewPostTime}>
                    Just now
                  </Text>
                </View>
                {profile?.social_links &&
                  (profile.social_links.instagram ||
                    profile.social_links.youtube) && (
                    <View style={styles.previewSocialIcons}>
                      {profile.social_links.instagram && (
                        <View style={styles.previewSocialIconBtn}>
                          <Instagram color="#C13584" size={16} />
                        </View>
                      )}
                      {profile.social_links.youtube && (
                        <View style={styles.previewSocialIconBtn}>
                          <Youtube color="#FF0000" size={16} />
                        </View>
                      )}
                    </View>
                  )}
              </View>

              <View style={styles.previewMediaWrap}>
                <Image
                  source={{
                    uri:
                      imageUrl ||
                      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&auto=format&fit=crop&q=60",
                  }}
                  style={styles.previewCover}
                  resizeMode="cover"
                />
              </View>

              {!!title && (
                <View style={styles.previewBody}>
                  <Text numberOfLines={3} style={styles.previewCaption}>
                    {title}
                  </Text>
                </View>
              )}

              <View style={styles.previewFooterRow}>
                <View style={styles.previewUpvote}>
                  <ThumbsUp color="#E5E7EB" size={16} />
                  <Text style={styles.previewUpvoteText}>0</Text>
                </View>
                <View style={styles.previewActionButtons}>
                  <View style={styles.previewActionBtn}>
                    <CheckCircle2 color="#E5E7EB" size={16} />
                    <Text style={styles.previewActionText}>Apply</Text>
                  </View>
                  <View style={styles.previewActionBtn}>
                    <Bookmark color="#E5E7EB" size={16} />
                    <Text style={styles.previewActionText}>Save</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
  },
  closeBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 24,
  },
  label: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#E5E7EB",
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  placeholder: {
    color: "#6B7280",
  },
  dropdownMenu: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    maxHeight: 200,
    zIndex: 1000,
    ...(Platform.OS === "web" && {
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    }),
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  requirementsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  requirementInput: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addBtnText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  requirementsList: {
    marginTop: 12,
    gap: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#14141C",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  requirementText: {
    color: "#E5E7EB",
    fontSize: 13,
    flex: 1,
  },
  removeReqBtn: {
    padding: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#23232B",
  },
  createBtn: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  createBtnText: {
    color: "#0B0B0F",
    fontSize: 16,
    fontWeight: "900",
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  previewBtnText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  imagePickerBtn: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 150,
  },
  imagePickerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  imagePickerText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    position: "relative" as const,
    width: "100%",
    height: 200,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover" as const,
  },
  changeImageOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 11, 15, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  changeImageText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
    position: "relative" as const,
  },
  previewHeaderTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
  },
  previewCloseBtn: {
    position: "absolute" as const,
    right: 16,
    padding: 8,
  },
  previewScroll: {
    flex: 1,
  },
  previewCard: {
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    margin: 12,
  },
  previewPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  previewSocialIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto" as const,
  },
  previewSocialIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#14141C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#23232B",
  },
  previewPostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  previewPostHeaderInfo: {
    flex: 1,
  },
  previewPostUsername: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "800",
  },
  previewPostTime: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  previewMediaWrap: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  previewCover: {
    width: "100%",
    height: 320,
    borderRadius: 14,
  },
  previewBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewCaption: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
  },
  previewFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  previewUpvote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewUpvoteText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
  },
  previewActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1A1A24",
    borderWidth: 1.5,
    borderColor: "#2A2A38",
  },
  previewActionText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
