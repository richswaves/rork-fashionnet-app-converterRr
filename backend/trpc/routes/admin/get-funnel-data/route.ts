import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

function resolveEnv(key: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>)[key] : undefined;
  if (typeof fromProcess === "string") {
    const trimmed = fromProcess.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return fromProcess;
}

export const getFunnelDataProcedure = publicProcedure.query(async () => {
  console.log("[getFunnelData] Starting funnel data fetch");
  
  const supabaseUrl = resolveEnv("EXPO_PUBLIC_SUPABASE_URL");
  const supabaseKey = resolveEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  
  console.log("[getFunnelData] Supabase URL:", supabaseUrl ? "present" : "missing");
  console.log("[getFunnelData] Supabase Key:", supabaseKey ? "present" : "missing");
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("[getFunnelData] Supabase not configured");
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("[getFunnelData] Supabase client created");

  const { data: responses, error } = await supabase
    .from("onboarding_responses")
    .select("role, question, answer")
    .returns<{ role: string; question: string; answer: any }[]>();

  if (error) {
    console.error("[getFunnelData] Funnel data fetch error:", error);
    return [];
  }

  if (!responses || responses.length === 0) {
    console.log("[getFunnelData] No funnel data found");
    return [];
  }

  console.log(`[getFunnelData] Found ${responses.length} responses`);

  const roleQuestionMap = new Map<string, Map<string, Map<string, number>>>();

  for (const resp of responses) {
    const { role, question, answer } = resp;
    if (!role || !question || !answer) continue;

    if (!roleQuestionMap.has(role)) {
      roleQuestionMap.set(role, new Map());
    }

    const questionsMap = roleQuestionMap.get(role)!;
    if (!questionsMap.has(question)) {
      questionsMap.set(question, new Map());
    }

    const answersMap = questionsMap.get(question)!;

    if (Array.isArray(answer)) {
      for (const ans of answer) {
        if (typeof ans === "string" && ans.trim().length > 0) {
          answersMap.set(ans, (answersMap.get(ans) || 0) + 1);
        }
      }
    } else if (typeof answer === "string" && answer.trim().length > 0) {
      answersMap.set(answer, (answersMap.get(answer) || 0) + 1);
    }
  }

  const result: {
    role: string;
    question: string;
    answers: { option: string; count: number }[];
  }[] = [];

  for (const [role, questionsMap] of roleQuestionMap.entries()) {
    for (const [question, answersMap] of questionsMap.entries()) {
      const answers = Array.from(answersMap.entries()).map(([option, count]) => ({
        option,
        count,
      })).sort((a, b) => b.count - a.count);

      result.push({ role, question, answers });
    }
  }

  console.log(`[getFunnelData] Returning ${result.length} items`);
  return result;
});
