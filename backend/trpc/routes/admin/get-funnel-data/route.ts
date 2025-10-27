import { publicProcedure } from "../../create-context";
import { getSupabase } from "@/integrations/supabase/client";

export const getFunnelDataProcedure = publicProcedure.query(async () => {
  console.log("[getFunnelData] Starting funnel data fetch");
  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase not configured");
      return [];
    }

    const { data: responses, error } = await supabase
      .from("onboarding_responses")
      .select("role, question, answer")
      .returns<{ role: string; question: string; answer: any }[]>();

    if (error) {
      console.error("Funnel data fetch error:", error);
      return [];
    }

    if (!responses || responses.length === 0) {
      console.log("No funnel data found");
      return [];
    }

    const roleQuestionMap = new Map<string, Map<string, Map<string, number>>>();

    for (const resp of responses || []) {
      try {
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
      } catch (e) {
        console.error("Error processing response:", resp, e);
        continue;
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
  } catch (error) {
    console.error("[getFunnelData] Unexpected error:", error);
    return [];
  }
});
