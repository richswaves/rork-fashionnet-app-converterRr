import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { getSupabase } from "@/integrations/supabase/client";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return "";
  }
  return "http://127.0.0.1:8081";
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers: async () => {
        const supabase = getSupabase();
        if (!supabase) return {};
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return {};
        
        return {
          Authorization: `Bearer ${session.access_token}`,
        };
      },
    }),
  ],
});

export const trpcVanillaClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers: async () => {
        const supabase = getSupabase();
        if (!supabase) return {};
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return {};
        
        return {
          Authorization: `Bearer ${session.access_token}`,
        };
      },
    }),
  ],
});