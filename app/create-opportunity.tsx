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
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ChevronDown, Eye } from "lucide-react-native";
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
  "Other",
];

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { currentUserId } = useProfile();

  const [title, setTitle] = useState("");
  const [needType, setNeedType] = useState("");
  const [location, setLocation] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState("");
  const [showNeedDropdown, setShowNeedDropdown] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!title.trim()) throw new Error("Title is required");
      if (!needType) throw new Error("Need type is required");

      await sbInsert("opportunities", {
        title: title.trim(),
        type: needType,
        location: location.trim() || null,
        user_id: currentUserId,
        cover_image: imageUrl.trim() || null,
        company: null,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      router.back();
    },
    onError: (error) => {
      console.error("[CreateOpportunity] Error:", error);
      alert("Failed to create opportunity. Please try again.");
    },
  });

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement("");
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

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>From</Text>
            <TextInput
              style={styles.input}
              placeholder="1000"
              placeholderTextColor="#6B7280"
              value={priceFrom}
              onChangeText={setPriceFrom}
              keyboardType="numeric"
              testID="input-from"
            />
          </View>

          <View style={styles.halfField}>
            <Text style={styles.label}>To</Text>
            <TextInput
              style={styles.input}
              placeholder="5000"
              placeholderTextColor="#6B7280"
              value={priceTo}
              onChangeText={setPriceTo}
              keyboardType="numeric"
              testID="input-to"
            />
          </View>
        </View>

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
        <TextInput
          style={styles.input}
          placeholder="Image URL (optional)"
          placeholderTextColor="#6B7280"
          value={imageUrl}
          onChangeText={setImageUrl}
          testID="input-image"
        />

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

        <Pressable style={styles.previewBtn} testID="preview">
          <Eye color="#E5E7EB" size={18} />
          <Text style={styles.previewBtnText}>Preview</Text>
        </Pressable>
      </View>
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
});
