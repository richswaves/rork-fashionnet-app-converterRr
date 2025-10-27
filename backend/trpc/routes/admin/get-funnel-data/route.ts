import { publicProcedure } from "../../../create-context";
import { getSupabase } from "@/integrations/supabase/client";

export const getFunnelDataProcedure = publicProcedure.query(async () => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.error("[Funnel] Supabase client not configured");
      throw new Error("Supabase not configured");
    }

    console.log("[Funnel] Fetching onboarding responses...");
    
    const { data: responses, error } = await supabase
      .from("onboarding_responses")
      .select("role, question, answer");

    if (error) {
      console.error("[Funnel] Database error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("[Funnel] Fetched ${responses?.length || 0} responses");

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
            if (ans && typeof ans === "string") {
              answersMap.set(ans, (answersMap.get(ans) || 0) + 1);
            }
          }
        } else if (typeof answer === "string") {
          answersMap.set(answer, (answersMap.get(answer) || 0) + 1);
        }
      } catch (err) {
        console.error("[Funnel] Error processing response:", err, resp);
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

    console.log(`[Funnel] Returning ${result.length} questions across roles`);
    return result;
  } catch (error) {
    console.error("[Funnel] Fatal error:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
});
