import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getSupabase, sbInsert } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

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

const roleQuestions: Record<string, ChoiceQuestion[]> = {
  model: [
    { id: "shoot_types", prompt: "What types of shoots do you focus on?", options: ["Streetwear campaigns", "Editorial / magazine work", "Commercial / e-commerce", "Music / culture collaborations"], multiple: true },
    { id: "showcase_where", prompt: "Where do you showcase most of your work?", options: ["Instagram", "TikTok", "Portfolio / website"], multiple: true },
    { id: "connect_with", prompt: "Who are you most interested in connecting with?", options: ["Photographers", "Creative directors", "Clothing brands / designers", "Stylists", "Content creators"], multiple: true },
    { id: "audience_size", prompt: "Roughly how many followers / audience reach do you have?", options: sharedFollowerRanges },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  photographer: [
    { id: "primarily_shoot", prompt: "What do you primarily shoot?", options: ["Street/editorial fashion", "Sneakers / products", "Lifestyle / culture", "Artists / events"], multiple: true },
    { id: "aesthetic", prompt: "How would you describe your aesthetic?", options: ["Raw and street-focused", "Clean and luxury-inspired", "Experimental / artistic", "Documentary-style realism"], multiple: true },
    { id: "connect_with", prompt: "Who would you like to connect with most?", options: ["Models", "Designers / brands", "Videographers", "Content creators", "Stylists"], multiple: true },
    { id: "projects_per_month", prompt: "Average number of projects per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  videographer: [
    { id: "video_work", prompt: "What type of video work do you create most often?", options: ["Fashion films", "Sneaker or brand promos", "Music x fashion collaborations", "Behind-the-scenes / culture docs"], multiple: true },
    { id: "approach", prompt: "What best describes your approach?", options: ["Cinematic and polished", "Raw handheld", "Fast-cut, short-form edits", "Artistic / experimental"], multiple: true },
    { id: "prefer_collab", prompt: "Who do you prefer collaborating with?", options: ["Photographers", "Clothing brands", "Models", "Creative directors", "Content creators"], multiple: true },
    { id: "monthly_output", prompt: "Average monthly content output?", options: ["<5 videos", "5–15 videos", "15–30 videos", "30+ videos"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  content_creator: [
    { id: "content_kind", prompt: "What kind of content do you create most?", options: ["Styling / GRWM videos", "Fashion x lifestyle storytelling", "Brand collaborations", "Culture commentary"], multiple: true },
    { id: "audience_strongest", prompt: "Where is your audience strongest?", options: ["TikTok", "Instagram", "YouTube", "Multi-platform"] },
    { id: "collab_with", prompt: "Who do you want to collaborate with here?", options: ["Clothing brands", "Photographers / videographers", "Stylists", "Other creators", "Models"], multiple: true },
    { id: "follower_range", prompt: "Follower range / audience size?", options: ["<1k", "1–10k", "10–50k", "50–200k", "200k+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  stylist: [
    { id: "style_for", prompt: "You mainly style for…", options: ["Editorial shoots", "Artists / music videos", "Personal clients", "Events / live culture moments"], multiple: true },
    { id: "approach", prompt: "How would you describe your approach?", options: ["Streetwear layering", "Luxury streetwear", "Bold / experimental", "Archive + contemporary mix"], multiple: true },
    { id: "top_collaborators", prompt: "Who are your top collaborators?", options: ["Models", "Designers", "Photographers", "Brands", "Content creators"], multiple: true },
    { id: "projects_per_month", prompt: "Average projects styled per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  designer: [
    { id: "design_focus", prompt: "Your design focus is…", options: ["Streetwear-focused", "Archive-inspired / vintage revivals", "Sustainable / upcycled", "Luxury street", "Experimental / avant-garde", "Minimalist / refined", "Gender-fluid / unisex"], multiple: true },
    { id: "release_where", prompt: "Where do you release?", options: ["Instagram drops", "TikTok previews", "Online shop / Shopify", "In-person pop-ups", "Wholesale / stockists"], multiple: true },
    { id: "ideal_collaborators", prompt: "Who are your ideal collaborators?", options: ["Models", "Photographers", "Stylists", "Creative directors", "Other designers", "Brands"], multiple: true },
    { id: "pieces_per_year", prompt: "How many pieces or collections do you produce per year?", options: ["1–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  creative_director: [
    { id: "direct_mainly", prompt: "You mainly direct…", options: ["Campaigns for streetwear brands", "Content teams / fashion shoots", "Music x culture projects", "Concept / visual development"], multiple: true },
    { id: "strongest_contrib", prompt: "What is your strongest contribution?", options: ["Vision + brand storytelling", "Team leadership", "Moodboarding / trend direction", "Brand positioning"] },
    { id: "partnerships_prioritize", prompt: "What types of partnerships do you prioritize?", options: ["Leading full creative teams", "Co-developing with brands", "Conceptual collaborations", "Mentorship / talent development"], multiple: true },
    { id: "team_size", prompt: "Approximate team size you manage or lead?", options: ["Solo / 1–2", "Small team (3–5)", "Medium team (6–10)", "Large team (10+)"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  clothing_brand: [
    { id: "what_make", prompt: "What do you make or sell?", options: ["Retail / pop-ups", "Lifestyle fashion", "Wholesale / distribution", "Online-only drops"], multiple: true },
    { id: "who_need", prompt: "Who do you need to work with?", options: ["Photographers", "Videographers", "Models", "Designers", "Stylists", "Marketing / promotion partners", "Other brands"], multiple: true },
    { id: "most_help_with", prompt: "What do you most need help with?", options: ["Shoots (photo / video)", "Brand collaborations", "Marketing / promotion", "Talent relationships"], multiple: true },
    { id: "monthly_output", prompt: "Estimated monthly projects or content output?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  agency: [
    { id: "specialize_in", prompt: "What does your agency specialize in?", options: ["Talent management (models, creators, stylists)", "Creative production (shoots, campaigns, content)", "Brand strategy / marketing", "Full-service fashion / lifestyle agency"], multiple: true },
    { id: "typical_clients", prompt: "Who are your typical clients?", options: ["Emerging streetwear brands", "Established fashion / luxury brands", "Artists / musicians / culture collaborators", "Lifestyle / wellness brands"], multiple: true },
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

export default function SignupScreen() {
  const router = useRouter();
  const { updateProfileAsync } = useProfile();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [dateOfBirth, setDateOfBirth] = useState<string>("");
  const [cityLocation, setCityLocation] = useState<string>("");
  const [notifOptIn, setNotifOptIn] = useState<boolean>(false);
  const [notifMethod, setNotifMethod] = useState<"sms" | "instagram" | undefined>(undefined);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [instagramLink, setInstagramLink] = useState<string>("");

  const [userType, setUserType] = useState<"creative" | "business" | undefined>(undefined);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const [height, setHeight] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [hips, setHips] = useState<string>("");
  const [bust, setBust] = useState<string>("");
  const [chest, setChest] = useState<string>("");
  const [shoeSize, setShoeSize] = useState<string>("");
  const [hairColor, setHairColor] = useState<string>("");
  const [eyeColor, setEyeColor] = useState<string>("");

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);

  const sessionIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const availableQuestions = useMemo<ChoiceQuestion[]>(() => {
    if (!role) return [];
    return roleQuestions[role] ?? [];
  }, [role]);

  const totalSteps = useMemo(() => {
    let count = 1;
    if (userType) count++;
    if (role) {
      count++;
      count += availableQuestions.length;
      if (role === "model") count++;
    }
    return count;
  }, [userType, role, availableQuestions]);

  const currentStep = useMemo(() => {
    let step = 1;
    if (userType) step++;
    if (role) {
      step++;
      if (currentQuestionIndex >= 0) step += currentQuestionIndex + 1;
    }
    return step;
  }, [userType, role, currentQuestionIndex]);

  const progress = useMemo(() => {
    return totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  }, [currentStep, totalSteps]);

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

  const handleContinueQuestion = useCallback(() => {
    if (currentQuestionIndex < availableQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, availableQuestions]);

  const isCurrentQuestionAnswered = useMemo(() => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= availableQuestions.length) return false;
    const q = availableQuestions[currentQuestionIndex];
    return (answers[q.id] ?? []).length > 0;
  }, [currentQuestionIndex, availableQuestions, answers]);

  const canSubmit = useMemo(() => {
    const baseValid = email.trim().length > 3 && password.trim().length >= 6;
    const onboardingValid = !!userType && !!role && availableQuestions.every((q) => (answers[q.id] ?? []).length > 0);
    const notifValid = !notifOptIn || (notifMethod === "sms" ? phoneNumber.trim().length >= 7 : notifMethod === "instagram" ? instagramLink.trim().length > 0 : false);
    const allQuestionsAnswered = currentQuestionIndex >= availableQuestions.length - 1 && availableQuestions.every((q) => (answers[q.id] ?? []).length > 0);
    return baseValid && onboardingValid && notifValid && allQuestionsAnswered;
  }, [email, password, userType, role, availableQuestions, answers, notifOptIn, notifMethod, phoneNumber, instagramLink, currentQuestionIndex]);

  const onSubmit = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert("Error", "Supabase is not configured.");
      return;
    }
    if (!canSubmit) {
      Alert.alert("Incomplete", "Please fill out all fields and onboarding questions.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: {
          data: fullName.trim().length > 0 ? { full_name: fullName.trim() } : undefined,
        },
      });
      if (error) throw error;
      const userId = data.user?.id as string | undefined;
      if (!userId) {
        Alert.alert("Sign up", "Check your email to confirm your account.");
        return;
      }

      try {
        await updateProfileAsync({
          user_id: userId,
          full_name: fullName.trim() || undefined,
          location: cityLocation.trim() || undefined,
          account_status: "pending",
          is_profile_updated: true,
          profession: role,
          ...(role === "model"
            ? {
                height: height || undefined,
                waist: waist || undefined,
                hips: hips || undefined,
                bust: bust || undefined,
                chest: chest || undefined,
                shoe_size: shoeSize || undefined,
                hair_color: hairColor || undefined,
                eye_color: eyeColor || undefined,
              }
            : {}),
        } as any);
      } catch (e) {
        console.log("Profile upsert after signup failed", e);
      }

      try {
        for (const q of availableQuestions) {
          const a = answers[q.id] ?? [];
          await sbInsert("onboarding_responses", {
            user_id: userId,
            role,
            question: q.prompt,
            answer: a,
          } as any);
        }
        if (cityLocation.trim().length > 0) {
          await sbInsert("onboarding_responses", {
            user_id: userId,
            role,
            question: "Location",
            answer: [cityLocation.trim()],
          } as any);
        }
        if (dateOfBirth.trim().length > 0) {
          await sbInsert("onboarding_responses", {
            user_id: userId,
            role,
            question: "Date of birth",
            answer: [dateOfBirth.trim()],
          } as any);
        }
        await sbInsert("onboarding_responses", {
          user_id: userId,
          role,
          question: "Notifications opt-in",
          answer: [notifOptIn ? "enabled" : "disabled"],
        } as any);
        if (notifOptIn && notifMethod) {
          await sbInsert("onboarding_responses", {
            user_id: userId,
            role,
            question: "Notifications channel",
            answer: [notifMethod],
          } as any);
          if (notifMethod === "sms" && phoneNumber.trim().length > 0) {
            await sbInsert("onboarding_responses", {
              user_id: userId,
              role,
              question: "Phone number for notifications",
              answer: [phoneNumber.trim()],
            } as any);
          }
          if (notifMethod === "instagram" && instagramLink.trim().length > 0) {
            await sbInsert("onboarding_responses", {
              user_id: userId,
              role,
              question: "Instagram for notifications",
              answer: [instagramLink.trim()],
            } as any);
          }
        }
      } catch (e) {
        console.log("Failed inserting onboarding responses", e);
      }

      try {
        await sbInsert("onboarding_step_events", {
          session_id: sessionIdRef.current,
          user_id: userId,
          step_number: 1,
          step_name: "auth_and_onboarding",
          event_type: "complete",
          user_type: userType,
          specific_role: role,
        } as any);
      } catch (e) {
        console.log("Failed to record onboarding event", e);
      }

      router.replace("/onboarding/pending-approval" as any);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Failed to sign up";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 16 }}>
          <Text style={styles.title}>account application</Text>
          <TextInput
            testID="signup-fullname"
            placeholder="Full name"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            testID="signup-email"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            testID="signup-password"
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <View style={styles.row}>
            <TextInput
              testID="signup-dob"
              placeholder="Date of birth (YYYY-MM-DD)"
              placeholderTextColor="#9CA3AF"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              style={[styles.input, styles.inputHalf]}
              autoCorrect={false}
            />
            <TextInput
              testID="signup-location"
              placeholder="City, Country"
              placeholderTextColor="#9CA3AF"
              value={cityLocation}
              onChangeText={setCityLocation}
              style={[styles.input, styles.inputHalf]}
              autoCorrect={false}
            />
          </View>
          <View style={[styles.row, { alignItems: "center" }]}>
            <Text style={styles.helperText}>enable post notifications</Text>
            <Switch
              testID="signup-notif"
              value={notifOptIn}
              onValueChange={async (v) => {
                setNotifOptIn(v);
                if (!v) {
                  setNotifMethod(undefined);
                  setPhoneNumber("");
                  setInstagramLink("");
                }
                if (v) {
                  console.log("Notifications preference enabled; select a channel");
                }
              }}
            />
          </View>
        </View>

        {notifOptIn && (
          <View style={[styles.card, { marginTop: -4 }]}> 
            <Text style={styles.sectionTitle}>Choose how you want to be notified</Text>
            <View style={styles.rowWrap}>
              {(["sms", "instagram"] as const).map((m) => {
                const selected = notifMethod === m;
                return (
                  <TouchableOpacity
                    key={m}
                    testID={`signup-notif-${m}`}
                    style={[styles.pill, selected && styles.pillActive]}
                    onPress={() => setNotifMethod(m)}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                      {m === "sms" ? "SMS" : "Instagram DMs"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {notifMethod === "sms" && (
              <TextInput
                testID="signup-phone"
                placeholder="Phone number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                style={[styles.input, { marginTop: 10 }]}
              />
            )}
            {notifMethod === "instagram" && (
              <TextInput
                testID="signup-ig"
                placeholder="Instagram profile link (https://instagram.com/username)"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                value={instagramLink}
                onChangeText={setInstagramLink}
                style={[styles.input, { marginTop: 10 }]}
              />
            )}
            {!notifMethod && (
              <Text style={{ color: "#9CA3AF", marginTop: 6 }}>Select a notification channel</Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>You are joining as</Text>
          <View style={styles.row}>
            {(["creative", "business"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                testID={`signup-type-${t}`}
                style={[styles.pill, userType === t && styles.pillActive]}
                onPress={() => {
                  setUserType(t);
                  setRole(undefined);
                }}
              >
                <Text style={[styles.pillText, userType === t && styles.pillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!!userType && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select your role</Text>
            <View style={styles.grid}>
              {(userType === "creative" ? creativeRoles : businessRoles).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleItem, role === r && styles.roleItemActive]}
                  onPress={() => {
                    setRole(r);
                    setCurrentQuestionIndex(0);
                  }}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r.replace(/_/g, " ")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!!role && currentQuestionIndex >= 0 && currentQuestionIndex < availableQuestions.length && (() => {
          const q = availableQuestions[currentQuestionIndex];
          return (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tell us more</Text>
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.prompt}>{q.prompt}</Text>
                <View style={styles.rowWrap}>
                  {q.options.map((opt) => {
                    const selected = (answers[q.id] ?? []).includes(opt);
                    return (
                      <TouchableOpacity
                        key={opt}
                        testID={`signup-q-${q.id}-${opt}`}
                        style={[styles.pill, selected && styles.pillActive]}
                        onPress={() => toggleAnswer(q.id, opt, q.multiple)}
                      >
                        <Text style={[styles.pillText, selected && styles.pillTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {isCurrentQuestionAnswered && currentQuestionIndex < availableQuestions.length - 1 && (
                <TouchableOpacity
                  testID="signup-continue"
                  style={styles.secondaryBtn}
                  onPress={handleContinueQuestion}
                >
                  <Text style={styles.secondaryBtnText}>Continue</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {role === "model" && currentQuestionIndex >= availableQuestions.length - 1 && availableQuestions.every((q) => (answers[q.id] ?? []).length > 0) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Physical & Appearance Details</Text>
            <View style={styles.row}>
              <TextInput value={height} onChangeText={setHeight} placeholder="Height" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-height" />
              <TextInput value={waist} onChangeText={setWaist} placeholder="Waist" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-waist" />
            </View>
            <View style={styles.row}>
              <TextInput value={hips} onChangeText={setHips} placeholder="Hips" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-hips" />
              <TextInput value={bust} onChangeText={setBust} placeholder="Bust" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-bust" />
            </View>
            <View style={styles.row}>
              <TextInput value={chest} onChangeText={setChest} placeholder="Chest" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-chest" />
              <TextInput value={shoeSize} onChangeText={setShoeSize} placeholder="Shoe size" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-shoe" />
            </View>
            <View style={styles.row}>
              <TextInput value={hairColor} onChangeText={setHairColor} placeholder="Hair color" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-hair" />
              <TextInput value={eyeColor} onChangeText={setEyeColor} placeholder="Eye color" placeholderTextColor="#9CA3AF" style={[styles.input, styles.inputHalf]} testID="signup-eye" />
            </View>
          </View>
        )}

        {canSubmit && (
          <TouchableOpacity
            testID="signup-submit"
            style={[styles.primaryBtn, { opacity: loading ? 0.6 : 1 }]}
            onPress={onSubmit}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Create account"}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { padding: 20, gap: 16 },
  title: { color: "#F9FAFB", fontSize: 28, fontWeight: "700" as const },
  sectionTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" as const, marginBottom: 10 },
  card: { backgroundColor: "#0F172A", borderColor: "#1F2937", borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  grid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8 },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "#374151", backgroundColor: "#0B1220" },
  pillActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  pillText: { color: "#D1D5DB", fontWeight: "600" as const },
  pillTextActive: { color: "#111827", fontWeight: "700" as const },
  roleItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#0B1220", borderWidth: 1, borderColor: "#1F2937" },
  roleItemActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  roleText: { color: "#D1D5DB" },
  roleTextActive: { color: "#111827", fontWeight: "700" as const },
  input: { backgroundColor: "#111827", borderColor: "#1F2937", borderWidth: 1, color: "#F9FAFB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  inputHalf: { flex: 1 },
  prompt: { color: "#E5E7EB", marginBottom: 6, fontWeight: "600" as const },
  primaryBtn: { backgroundColor: "#FFFFFF", paddingVertical: 16, alignItems: "center", borderRadius: 14, marginTop: 8 },
  primaryBtnText: { color: "#111827", fontSize: 17, fontWeight: "700" as const },
  helperText: { color: "#9CA3AF", flex: 1, fontWeight: "600" as const },
  progressBarContainer: { height: 4, backgroundColor: "#1F2937", width: "100%" },
  progressBar: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 2 },
  secondaryBtn: { backgroundColor: "#FFFFFF", paddingVertical: 12, alignItems: "center", borderRadius: 12, marginTop: 6 },
  secondaryBtnText: { color: "#111827", fontSize: 15, fontWeight: "700" as const },
});
