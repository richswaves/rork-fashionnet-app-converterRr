import React, { useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Image, Platform } from "react-native";
import { Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/contexts/ProfileContext";
import { sbInsert, getSupabase } from "@/integrations/supabase/client";
import GrainTexture from "@/components/GrainTexture";

type ChoiceQuestion = { id: string; prompt: string; options: string[]; multiple?: boolean };

const sharedWhatDoYouWant = [
  "Paid projects",
  "Exposure and portfolio growth",
  "Creative collabs",
  "Mentorship or learning",
  "Build long-term industry relationships",
];

const sharedWhatMattersMost = [
  "Trust and clear communication",
  "Fair pay or value exchange",
  "Strong creative vision / aesthetic fit",
  "Professionalism and dependability",
  "Potential exposure or audience growth",
  "Long-term potential to build together",
];

const sharedFollowerRanges = ["<1k", "1–5k", "5–25k", "25–100k", "100k+"];

const connectWithOptions = [
  "Models",
  "Photographers",
  "Videographers",
  "Content creators",
  "Influencers",
  "Stylists",
  "Designers",
  "Creative directors",
  "Photography businesses",
  "Agencies",
  "Publishers",
];

const roleQuestions: Record<string, ChoiceQuestion[]> = {
  model: [
    { id: "shoot_types", prompt: "What types of shoots do you focus on?", options: ["Streetwear campaigns", "Editorial / magazine work", "Commercial / e-commerce", "Music / culture collaborations", "Social media"], multiple: true },
    { id: "showcase_where", prompt: "Where do you showcase most of your work?", options: ["Instagram", "TikTok", "Portfolio / website"], multiple: true },
    { id: "connect_with", prompt: "Who are you most interested in connecting with?", options: connectWithOptions, multiple: true },
    { id: "audience_size", prompt: "Roughly how many followers / audience reach do you have?", options: sharedFollowerRanges },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  photographer: [
    { id: "primarily_shoot", prompt: "What do you primarily shoot?", options: ["Street/editorial fashion", "Sneakers / products", "Lifestyle / culture", "Artists / events"], multiple: true },
    { id: "aesthetic", prompt: "How would you describe your aesthetic?", options: ["Raw and street-focused", "Clean and luxury-inspired", "Experimental / artistic", "Documentary-style realism"], multiple: true },
    { id: "connect_with", prompt: "Who would you like to connect with most?", options: connectWithOptions, multiple: true },
    { id: "projects_per_month", prompt: "Average number of projects per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  videographer: [
    { id: "video_work", prompt: "What type of video work do you create most often?", options: ["Fashion films", "Sneaker or brand promos", "Music x fashion collaborations", "Behind-the-scenes / culture docs"], multiple: true },
    { id: "approach", prompt: "What best describes your approach?", options: ["Cinematic and polished", "Raw handheld", "Fast-cut, short-form edits", "Artistic / experimental"], multiple: true },
    { id: "prefer_collab", prompt: "Who do you prefer collaborating with?", options: connectWithOptions, multiple: true },
    { id: "monthly_output", prompt: "Average monthly content output?", options: ["<5 videos", "5–15 videos", "15–30 videos", "30+ videos"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  content_creator: [
    { id: "content_kind", prompt: "What kind of content do you create most?", options: ["Styling / GRWM videos", "Fashion x lifestyle storytelling", "Brand collaborations", "Culture commentary"], multiple: true },
    { id: "audience_strongest", prompt: "Where is your audience strongest?", options: ["TikTok", "Instagram", "YouTube", "Multi-platform"] },
    { id: "collab_with", prompt: "Who do you want to collaborate with here?", options: connectWithOptions, multiple: true },
    { id: "follower_range", prompt: "Follower range / audience size?", options: ["<1k", "1–10k", "10–50k", "50–200k", "200k+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  stylist: [
    { id: "style_for", prompt: "You mainly style for…", options: ["Editorial shoots", "Artists / music videos", "Personal clients", "Events / live culture moments", "Influencers"], multiple: true },
    { id: "approach", prompt: "How would you describe your approach?", options: ["Streetwear layering", "Luxury streetwear", "Bold / experimental", "Archive + contemporary mix"], multiple: true },
    { id: "top_collaborators", prompt: "Who are your top collaborators?", options: connectWithOptions, multiple: true },
    { id: "projects_per_month", prompt: "Average projects styled per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  designer: [
    { id: "design_focus", prompt: "Your design focus is…", options: ["Streetwear-focused", "Archive-inspired / vintage revivals", "Sustainable / upcycled", "Luxury street", "Experimental / avant-garde", "Minimalist / refined", "Gender-fluid / unisex"], multiple: true },
    { id: "release_where", prompt: "Where do you release?", options: ["Instagram drops", "TikTok previews", "Online shop / Shopify", "In-person pop-ups", "Wholesale / stockists"], multiple: true },
    { id: "ideal_collaborators", prompt: "Who are your ideal collaborators?", options: connectWithOptions, multiple: true },
    { id: "pieces_per_year", prompt: "How many pieces or collections do you produce per year?", options: ["1–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  creative_director: [
    { id: "connect_with", prompt: "Who would you like to connect with?", options: connectWithOptions, multiple: true },
    { id: "direct_mainly", prompt: "You mainly direct…", options: ["Campaigns for streetwear brands", "Content teams / fashion shoots", "Music x culture projects", "Concept / visual development"], multiple: true },
    { id: "strongest_contrib", prompt: "What is your strongest contribution?", options: ["Vision + brand storytelling", "Team leadership", "Moodboarding / trend direction", "Brand positioning"], multiple: true },
    { id: "partnerships_prioritize", prompt: "What types of partnerships do you prioritize?", options: ["Leading full creative teams", "Co-developing with brands", "Conceptual collaborations", "Mentorship / talent development"], multiple: true },
    { id: "team_size", prompt: "Approximate team size you manage or lead?", options: ["Solo / 1–2", "Small team (3–5)", "Medium team (6–10)", "Large team (10+)"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  clothing_brand: [
    { id: "what_make", prompt: "What do you make or sell?", options: ["Skate-Rooted Streetwear", "Hip-Hop / Urban Streetwear", "Luxury Streetwear", "Techwear / Futuristic Streetwear", "Japanese / Eastern Streetwear", "Sneaker-Centric Streetwear", "Sports-Inspired / Ath-Street Hybrid", "Preppy Streetwear / Street-Prep Hybrid"], multiple: true },
    { id: "who_need", prompt: "Who do you need to work with?", options: ["Photographers", "Videographers", "Models", "Content creators", "Influencers", "Designers", "Stylists", "Marketing / promotion partners", "Other brands"], multiple: true },
    { id: "most_help_with", prompt: "What do you most need help with?", options: ["Shoots (photo / video)", "Brand collaborations", "Marketing / promotion", "Talent relationships"], multiple: true },
    { id: "monthly_output", prompt: "How often do you post?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "drop_frequency", prompt: "How often do you drop?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "drop_frequency_followup", prompt: "How often do you drop (collections)?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  agency: [
    { id: "specialize_in", prompt: "What does your agency specialize in?", options: ["Talent management (models, creators, stylists)", "Creative production (shoots, campaigns, content)", "Brand strategy / marketing", "Full-service fashion / lifestyle agency"], multiple: true },
    { id: "typical_clients", prompt: "Who are your typical clients?", options: ["Emerging streetwear brands", "Established fashion / luxury brands", "Artists / musicians / culture collaborators", "Lifestyle / wellness brands", "Content creators", "Models", "Videographers / photographers"], multiple: true },
    { id: "work_with_most", prompt: "What types of creatives do you work with most?", options: ["Models", "Photographers / videographers", "Content creators / influencers", "Stylists", "Designers"], multiple: true },
    { id: "monthly_projects", prompt: "Average monthly projects?", options: ["0–5", "6–15", "16–30", "30+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  photography_business: [
    { id: "business_offer", prompt: "What does your business offer?", options: ["Studio rental / production space", "Photography / videography services", "Full creative production support", "Event or pop-up shoots"], multiple: true },
    { id: "primarily_serve", prompt: "Who do you primarily serve?", options: ["Clothing brands", "Agencies", "Models / creatives", "Publications / media", "Other businesses"], multiple: true },
    { id: "open_collaborations", prompt: "What types of collaborations are you open to?", options: ["Studio partnerships", "Freelance creative hires", "Brand shoots", "Long-term creative partnerships"], multiple: true },
    { id: "shoots_per_month", prompt: "Average shoots per month?", options: ["0–5", "6–15", "16–30", "30+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  publisher: [
    { id: "publication_kind", prompt: "What kind of publication do you run?", options: ["Print magazine / publication", "Digital / online publication", "Hybrid print + digital"] },
    { id: "editorial_focus", prompt: "What is your main editorial focus?", options: ["Streetwear / sneaker culture", "Broader fashion / lifestyle", "Music x fashion / culture", "Art / creative industries"], multiple: true },
    { id: "publish_how_often", prompt: "How often do you publish?", options: ["Monthly", "Bi-monthly / seasonal", "Quarterly", "Ongoing / digital-first"] },
    { id: "feature_collab_with", prompt: "Who do you typically feature or collaborate with?", options: ["Photographers", "Models", "Brands", "Designers", "Creative directors", "Writers / journalists"], multiple: true },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  other_business: [
    { id: "business_desc", prompt: "What best describes your business?", options: ["Manufacturing / production", "Distribution / wholesale", "Services (creative, marketing, etc.)", "E-commerce / retail", "Events / experiences"], multiple: true },
    { id: "need_connect_with", prompt: "Who do you need to connect with?", options: ["Brands", "Designers", "Creatives (photo/video)", "Models", "Publications", "Other businesses"], multiple: true },
    { id: "primary_goals", prompt: "What are your primary business goals?", options: ["Grow partnerships", "Expand client base", "Develop new projects", "Long-term collaborations"], multiple: true },
    { id: "projects_per_month", prompt: "Average projects or partnerships per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
};

const creativeRoles = ["model", "photographer", "videographer", "content_creator", "stylist", "designer", "creative_director"] as const;
const businessRoles = ["clothing_brand", "agency", "photography_business", "publisher", "other_business"] as const;

export default function ProfileSetup() {
  const router = useRouter();
  const { currentUserId, updateProfileAsync, profile } = useProfile() as any;

  const [userType, setUserType] = useState<"creative" | "business" | undefined>(undefined);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const [location, setLocation] = useState<string>(profile?.location ?? "");
  const [bio, setBio] = useState<string>(profile?.bio ?? "");

  const [height, setHeight] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [hips, setHips] = useState<string>("");
  const [bust, setBust] = useState<string>("");
  const [chest, setChest] = useState<string>("");
  const [shoeSize, setShoeSize] = useState<string>("");
  const [hairColor, setHairColor] = useState<string>("");
  const [eyeColor, setEyeColor] = useState<string>("");

  const [instagram, setInstagram] = useState<string>(profile?.social_links?.instagram ?? "");
  const [youtube, setYoutube] = useState<string>(profile?.social_links?.youtube ?? "");
  const [twitter, setTwitter] = useState<string>(profile?.social_links?.twitter ?? "");
  const [tiktok, setTiktok] = useState<string>(profile?.social_links?.tiktok ?? "");
  const [profilePictureUri, setProfilePictureUri] = useState<string>(profile?.profile_picture ?? "");
  const [displayName, setDisplayName] = useState<string>(profile?.full_name ?? "");

  const [showModelDetails, setShowModelDetails] = useState<boolean>(false);
  const [agreed, setAgreed] = useState<boolean>(false);

  const sessionIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const availableQuestions = useMemo<ChoiceQuestion[]>(() => {
    if (!role) return [];
    return roleQuestions[role] ?? [];
  }, [role]);

  const toggleAnswer = useCallback((qid: string, option: string, multiple?: boolean) => {
    setAnswers((prev) => {
      const existing = prev[qid] ?? [];
      if (multiple) {
        return {
          ...prev,
          [qid]: existing.includes(option) ? existing.filter((o) => o !== option) : [...existing, option],
        };
      }
      return { ...prev, [qid]: [option] };
    });
  }, []);

  const recordEvent = useCallback(async (step: number, name: string, type: string) => {
    try {
      await sbInsert("onboarding_step_events", {
        session_id: sessionIdRef.current,
        user_id: currentUserId,
        step_number: step,
        step_name: name,
        event_type: type,
        user_type: userType,
        specific_role: role,
      } as any);
    } catch (e: any) {
      console.error("[Onboarding] Event tracking failed:", e?.message || e);
    }
  }, [currentUserId, role, userType]);

  const uploadToSupabase = useCallback(async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
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
    } catch {
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
  }, []);

  const onContinueFromProfile = useCallback(() => {
    setShowModelDetails(true);
  }, []);

  const onSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert("Required Field", "Please enter your display name");
      return;
    }
    if (!profilePictureUri) {
      Alert.alert("Required Field", "Please upload a profile picture");
      return;
    }
    
    try {
      console.log("[ProfileSetup] Saving profile with userId:", currentUserId);
      await recordEvent(3, "profile_details", "complete");

      let finalProfilePictureUrl = profilePictureUri;
      if (profilePictureUri && profilePictureUri.startsWith("file://")) {
        console.log("[ProfileSetup] Uploading profile picture to Supabase Storage");
        try {
          const mockAsset: ImagePicker.ImagePickerAsset = {
            uri: profilePictureUri,
            width: 0,
            height: 0,
            fileName: `profile_${Date.now()}.jpg`,
            base64: undefined,
          } as any;
          finalProfilePictureUrl = await uploadToSupabase(mockAsset);
          console.log("[ProfileSetup] Profile picture uploaded:", finalProfilePictureUrl);
        } catch (uploadError: any) {
          console.error("[ProfileSetup] Failed to upload profile picture:", uploadError);
          Alert.alert("Upload failed", "Could not upload profile picture. Please try again.");
          return;
        }
      }

      const profileData: any = {
        full_name: displayName.trim() || undefined,
        username: displayName.trim().toLowerCase().replace(/\s+/g, "") || undefined,
        profile_picture: finalProfilePictureUrl || undefined,
        location: location || undefined,
        bio: bio || undefined,
        profession: role,
        is_profile_updated: true,
        account_status: 'pending',
      };

      const socialLinks: any = {};
      if (instagram?.trim()) socialLinks.instagram = instagram.trim();
      if (youtube?.trim()) socialLinks.youtube = youtube.trim();
      if (twitter?.trim()) socialLinks.twitter = twitter.trim();
      if (tiktok?.trim()) socialLinks.tiktok = tiktok.trim();
      
      if (Object.keys(socialLinks).length > 0) {
        profileData.social_links = socialLinks;
      }

      if (role === "model") {
        profileData.height = height || undefined;
        profileData.waist = waist || undefined;
        profileData.hips = hips || undefined;
        profileData.bust = bust || undefined;
        profileData.chest = chest || undefined;
        profileData.shoe_size = shoeSize || undefined;
        profileData.hair_color = hairColor || undefined;
        profileData.eye_color = eyeColor || undefined;
      }

      await updateProfileAsync(profileData);

      const qs = availableQuestions;
      for (const q of qs) {
        const a = answers[q.id] ?? [];
        try {
          await sbInsert("onboarding_responses", {
            user_id: currentUserId,
            role,
            question: q.id,
            answer: a,
          } as any);
        } catch (e: any) {
          console.error("[Onboarding] Response insert failed for question", q.id, ":", e?.message || e);
        }
      }

      await recordEvent(4, "profile_setup_complete", "complete");

      if (profile?.account_status && profile.account_status !== "approved") {
        router.replace("/onboarding/pending-approval" as any);
      } else {
        router.replace("/(tabs)/network" as any);
      }
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Could not save";
      Alert.alert("Save failed", msg);
    }
  }, [answers, availableQuestions, bio, bust, chest, currentUserId, displayName, eyeColor, hairColor, height, hips, instagram, location, profile?.account_status, profilePictureUri, recordEvent, role, router, shoeSize, tiktok, twitter, updateProfileAsync, waist, youtube, uploadToSupabase]);

  if (!currentUserId) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <GrainTexture />
        <View style={styles.content}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <GrainTexture />
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>Set up your profile</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tell us more</Text>
          
          <View style={styles.questionBlock}>
            <Text style={styles.prompt}>You are joining as</Text>
            <View style={styles.row}>
              {(["creative", "business"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  testID={`type-${t}`}
                  style={[styles.pill, userType === t && styles.pillActive]}
                  onPress={async () => {
                    setUserType(t);
                    setRole(undefined);
                    await recordEvent(2, "user_type_selection", "complete");
                  }}
                >
                  <Text style={[styles.pillText, userType === t && styles.pillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!!userType && (
            <View style={styles.questionBlock}>
              <Text style={styles.prompt}>Select your role</Text>
              <View style={styles.rowWrap}>
                {(userType === "creative" ? creativeRoles : businessRoles).map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.pill, role === r && styles.pillActive]} 
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.pillText, role === r && styles.pillTextActive]}>{r.replace(/_/g, " ")}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!!role && availableQuestions.map((q) => (
            <View key={q.id} style={styles.questionBlock}>
              <Text style={styles.prompt}>{q.prompt}</Text>
              <View style={styles.rowWrap}>
                {q.options.map((opt) => {
                  const selected = (answers[q.id] ?? []).includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      testID={`q-${q.id}-${opt}`}
                      style={[styles.pill, selected && styles.pillActive]}
                      onPress={() => toggleAnswer(q.id, opt, q.multiple)}
                    >
                      <Text style={[styles.pillText, selected && styles.pillTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {!!role && !showModelDetails && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            <Text style={styles.fieldLabel}>Display Name *</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              testID="ps-display-name"
              autoCapitalize="words"
            />
            
            <Text style={styles.fieldLabel}>Profile Picture *</Text>
            <TouchableOpacity
              testID="ps-profile-pic"
              style={styles.imagePickerBtn}
              onPress={async () => {
                try {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                    base64: Platform.OS !== "web",
                  });
                  if (!result.canceled && result.assets[0]) {
                    setProfilePictureUri(result.assets[0].uri);
                  }
                } catch (e) {
                  console.log("Image picker error:", e);
                }
              }}
            >
              {profilePictureUri ? (
                <Image source={{ uri: profilePictureUri }} style={styles.profilePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Tap to upload</Text>
                </View>
              )}
            </TouchableOpacity>
            
          </View>
        )}

        {!!role && !showModelDetails && (
          <>
            <TouchableOpacity testID="ps-continue-profile" style={[styles.primaryBtn, { opacity: !agreed ? 0.6 : 1 }]} onPress={() => { if (!agreed) { Alert.alert("Agreement required", "Please confirm you agree to the Terms and policies to continue."); return; } if (role === "model") { onContinueFromProfile(); } else { onSave(); } }}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
            <View style={styles.agreeRow}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                onPress={() => setAgreed((v) => !v)}
                style={[styles.checkbox, agreed && styles.checkboxChecked]}
                testID="ps-agree-1"
              >
                <Text style={styles.checkboxTick}>{agreed ? "✓" : ""}</Text>
              </TouchableOpacity>
              <View style={styles.legalNote} testID="ps-legal-note-1">
                <Text style={styles.legalText}>I agree to the </Text>
                <Link href="/legal/terms"><Text style={styles.legalLink}>Terms</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/privacy"><Text style={styles.legalLink}>Privacy Policy</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/subscription"><Text style={styles.legalLink}>Subscription Addendum</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/community-guidelines"><Text style={styles.legalLink}>Community Guidelines</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/dmca"><Text style={styles.legalLink}>DMCA</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/dpa"><Text style={styles.legalLink}>DPA</Text></Link>
                <Text style={styles.legalText}> and </Text>
                <Link href="/legal/cookie-policy"><Text style={styles.legalLink}>Cookie Policy</Text></Link>
                <Text style={styles.legalText}>.</Text>
              </View>
            </View>
          </>
        )}

        {!!role && showModelDetails && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            <Text style={styles.fieldLabel}>Display Name *</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              testID="ps-display-name-2"
              autoCapitalize="words"
              editable={false}
            />
            
            <Text style={styles.fieldLabel}>Profile Picture *</Text>
            {profilePictureUri && (
              <Image source={{ uri: profilePictureUri }} style={styles.profilePreviewSmall} />
            )}
            
            <TextInput value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor="#9CA3AF" style={styles.input} testID="ps-location" />
            <TextInput value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor="#9CA3AF" style={[styles.input, { height: 90 }]} multiline testID="ps-bio" />
          </View>
        )}

        {!!role && showModelDetails && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Social Links (optional)</Text>
            <TextInput 
              value={instagram} 
              onChangeText={setInstagram} 
              placeholder="Instagram (username or link)" 
              placeholderTextColor="#9CA3AF" 
              style={styles.input} 
              autoCapitalize="none" 
              testID="ps-instagram" 
            />
            <TextInput 
              value={youtube} 
              onChangeText={setYoutube} 
              placeholder="YouTube (username or link)" 
              placeholderTextColor="#9CA3AF" 
              style={styles.input} 
              autoCapitalize="none" 
              testID="ps-youtube" 
            />
            <TextInput 
              value={twitter} 
              onChangeText={setTwitter} 
              placeholder="Twitter/X (username or link)" 
              placeholderTextColor="#9CA3AF" 
              style={styles.input} 
              autoCapitalize="none" 
              testID="ps-twitter" 
            />
            <TextInput 
              value={tiktok} 
              onChangeText={setTiktok} 
              placeholder="TikTok (username or link)" 
              placeholderTextColor="#9CA3AF" 
              style={styles.input} 
              autoCapitalize="none" 
              testID="ps-tiktok" 
            />
          </View>
        )}

        {role === "model" && showModelDetails && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Physical & Appearance Details</Text>
            <View style={styles.row}>
              <TextInput value={height} onChangeText={setHeight} placeholder="Height" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-height" />
              <TextInput value={waist} onChangeText={setWaist} placeholder="Waist" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-waist" />
            </View>
            <View style={styles.row}>
              <TextInput value={hips} onChangeText={setHips} placeholder="Hips" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-hips" />
              <TextInput value={bust} onChangeText={setBust} placeholder="Bust" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-bust" />
            </View>
            <View style={styles.row}>
              <TextInput value={chest} onChangeText={setChest} placeholder="Chest" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-chest" />
              <TextInput value={shoeSize} onChangeText={setShoeSize} placeholder="Shoe size" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-shoe" />
            </View>
            <View style={styles.row}>
              <TextInput value={hairColor} onChangeText={setHairColor} placeholder="Hair color" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-hair" />
              <TextInput value={eyeColor} onChangeText={setEyeColor} placeholder="Eye color" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="ps-eye" />
            </View>
          </View>
        )}

        {!!role && showModelDetails && (
          <>
            <TouchableOpacity testID="ps-save" style={[styles.primaryBtn, { opacity: !agreed ? 0.6 : 1 }]} onPress={() => { if (!agreed) { Alert.alert("Agreement required", "Please confirm you agree to the Terms and policies to continue."); return; } onSave(); }}>
              <Text style={styles.primaryBtnText}>Create account</Text>
            </TouchableOpacity>
            <View style={styles.agreeRow}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                onPress={() => setAgreed((v) => !v)}
                style={[styles.checkbox, agreed && styles.checkboxChecked]}
                testID="ps-agree-2"
              >
                <Text style={styles.checkboxTick}>{agreed ? "✓" : ""}</Text>
              </TouchableOpacity>
              <View style={styles.legalNote} testID="ps-legal-note-2">
                <Text style={styles.legalText}>I agree to the </Text>
                <Link href="/legal/terms"><Text style={styles.legalLink}>Terms</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/privacy"><Text style={styles.legalLink}>Privacy Policy</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/subscription"><Text style={styles.legalLink}>Subscription Addendum</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/community-guidelines"><Text style={styles.legalLink}>Community Guidelines</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/dmca"><Text style={styles.legalLink}>DMCA</Text></Link>
                <Text style={styles.legalText}>, </Text>
                <Link href="/legal/dpa"><Text style={styles.legalLink}>DPA</Text></Link>
                <Text style={styles.legalText}> and </Text>
                <Link href="/legal/cookie-policy"><Text style={styles.legalLink}>Cookie Policy</Text></Link>
                <Text style={styles.legalText}>.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  content: { padding: 20, gap: 16, paddingBottom: 100 },
  title: { color: "#F9FAFB", fontSize: 24, fontWeight: "700" as const, marginBottom: 8 },
  sectionTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" as const, marginBottom: 10 },
  card: { backgroundColor: "rgba(15, 15, 15, 0.85)", borderColor: "#404040", borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  questionBlock: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  row: { flexDirection: "row", gap: 10 },
  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#404040", backgroundColor: "rgba(20, 20, 20, 0.85)" },
  pillActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  pillText: { color: "#D1D5DB", fontWeight: "600" as const },
  pillTextActive: { color: "#111827", fontWeight: "700" as const },
  input: { backgroundColor: "rgba(20, 20, 20, 0.85)", borderColor: "#404040", borderWidth: 1, color: "#FFFFFF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  inputHalf: { flex: 1 },
  prompt: { color: "#E5E7EB", marginBottom: 6, fontWeight: "600" as const },
  primaryBtn: { backgroundColor: "#FFFFFF", paddingVertical: 16, alignItems: "center", borderRadius: 14, marginTop: 8 },
  primaryBtnText: { color: "#111827", fontSize: 16, fontWeight: "700" as const },
  fieldLabel: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" as const, marginBottom: 6, marginTop: 6 },
  imagePickerBtn: { width: "100%", height: 120, borderRadius: 12, overflow: "hidden" as const, marginBottom: 6 },
  profilePreview: { width: "100%", height: "100%", resizeMode: "cover" as const },
  imagePlaceholder: { width: "100%", height: "100%", backgroundColor: "rgba(20, 20, 20, 0.85)", borderWidth: 1, borderColor: "#404040", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  imagePlaceholderText: { color: "#9CA3AF", fontSize: 14 },
  profilePreviewSmall: { width: 80, height: 80, borderRadius: 12, marginBottom: 6 },
  legalNote: { marginTop: 8, flexDirection: "row", flexWrap: "wrap" as const, alignItems: "center", flex: 1 },
  agreeRow: { marginTop: 8, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: "#404040", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,20,20,0.85)" },
  checkboxChecked: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  checkboxTick: { color: "#111827", fontSize: 14, fontWeight: "800" as const },
  legalText: { color: "#9CA3AF", fontSize: 12 },
  legalLink: { color: "#93C5FD", fontSize: 12, textDecorationLine: "underline" as const },
});
