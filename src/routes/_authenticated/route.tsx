import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/core/auth/session.functions";
import { AppShell } from "@/shared/components/AppShell";
import { offlineUser, prepareOfflineUser, rememberOfflineUser } from "@/core/offline/storage";
import { vaultIsUnlocked } from "@/core/offline/vault";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const offline = typeof window !== "undefined" && !navigator.onLine;
    const user = offline ? await offlineUser().catch(() => null) : await getCurrentUser();
    if (!user) throw redirect({ to: "/auth" });
    if (typeof window !== "undefined") {
      if (!offline) await rememberOfflineUser(user);
      if (!vaultIsUnlocked(user.id)) { context.queryClient.clear(); throw redirect({ to: "/local-vault", search: { redirect: location.href } }); }
      await prepareOfflineUser(user, context.queryClient, !offline);
    }
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
