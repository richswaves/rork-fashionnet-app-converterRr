import { publicProcedure } from "../../create-context";
import { getSupabase } from "@/integrations/supabase/client";

export const getFunnelDataProcedure = publicProcedure.query(async () => {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: responses, error } = await supabase
    .from("onboarding_responses")
    .select("role, question, answer");

  if (error) {
    console.error("Funnel data fetch error:", error);
    throw new Error(error.message);
  }

  const roleQuestionMap = new Map<string, Map<string, Map<string, number>>>();

  for (const resp of responses || []) {
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
        answersMap.set(ans, (answersMap.get(ans) || 0) + 1);
      }
    } else if (typeof answer === "string") {
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

  return result;
});
