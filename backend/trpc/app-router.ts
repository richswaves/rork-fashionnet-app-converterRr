import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import assignAdminRoleProcedure from "./routes/admin/assign-admin-role/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  admin: createTRPCRouter({
    assignAdminRole: assignAdminRoleProcedure,
  }),
});

export type AppRouter = typeof appRouter;