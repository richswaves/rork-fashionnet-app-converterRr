import { publicProcedure } from "../../../create-context";
import { z } from "zod";

function resolveEnv(key: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>)[key] : undefined;
  const fromGlobal = (globalThis as any)?.__ENV__?.[key] ?? (globalThis as any)?.ENV?.[key];
  const val = fromProcess ?? fromGlobal;
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return val;
}

export const assignAdminRoleProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
    })
  )
  .mutation(async ({ input }) => {
    const supabaseUrl = resolveEnv("EXPO_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = resolveEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration missing");
    }

    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: input.userId,
        role: "admin",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to assign admin role:", error);
      throw new Error(`Failed to assign admin role: ${error}`);
    }

    const result = await response.json();
    console.log("Admin role assigned successfully:", result);

    return {
      success: true,
      message: "Admin role assigned successfully",
      data: result,
    };
  });

export default assignAdminRoleProcedure;
