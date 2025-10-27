import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../create-context";

function env(key: string): string {
  const v = (typeof process !== "undefined" ? process.env?.[key] : undefined) ?? "";
  return (v || "").trim();
}

function supabaseUrl(): string {
  const raw = env("EXPO_PUBLIC_SUPABASE_URL");
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    return u.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Supabase URL not configured");
  }
}

function authHeaders(req: Request) {
  const apikey = env("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const incomingAuth = req.headers.get("authorization") || req.headers.get("Authorization");
  const headers: Record<string, string> = {
    apikey,
    Authorization: incomingAuth || `Bearer ${apikey}`,
    "Content-Type": "application/json",
  };
  return headers;
}

export default createTRPCRouter({
  isBlocked: publicProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const url = `${supabaseUrl()}/rest/v1/rpc/is_blocked`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(ctx.req),
        body: JSON.stringify({ target_user_id: input.targetUserId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `RPC is_blocked failed: ${res.status}`);
      }
      const data = (await res.json()) as boolean;
      return data;
    }),

  block: publicProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const url = `${supabaseUrl()}/rest/v1/rpc/block_user`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(ctx.req),
        body: JSON.stringify({ target_user_id: input.targetUserId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `RPC block_user failed: ${res.status}`);
      }
      return { ok: true } as const;
    }),

  unblock: publicProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const url = `${supabaseUrl()}/rest/v1/rpc/unblock_user`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(ctx.req),
        body: JSON.stringify({ target_user_id: input.targetUserId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `RPC unblock_user failed: ${res.status}`);
      }
      return { ok: true } as const;
    }),

  listBlocked: publicProcedure
    .query(async ({ ctx }) => {
      const url = new URL(`${supabaseUrl()}/rest/v1/blocked_users`);
      url.searchParams.set("select", "id,blocked_user_id,created_at");
      url.searchParams.set("order", "created_at.desc");
      // RLS ensures we only see own rows
      const res = await fetch(url.toString(), { headers: authHeaders(ctx.req) });
      if (!res.ok) {
        const text = await res.text();
        console.error("[Block] listBlocked error:", res.status, text);
        throw new Error(text || `Fetch blocked_users failed: ${res.status}`);
      }
      const rows = (await res.json()) as { id: string; blocked_user_id: string; created_at: string }[];
      return rows;
    }),
});
