import { useSyncExternalStore } from "react";
import { useRouterState, useRouter, useHydrated } from "@tanstack/react-router";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageLoading() {
  return <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Loading page…</div>;
}
export function PageError() {
  const router = useRouter();
  return <div role="alert" className="space-y-4 px-4 py-10"><h1 className="text-xl font-semibold">This page is unavailable</h1><p className="text-muted-foreground">Your saved entries are safe. Reconnect or try again.</p><Button variant="outline" onClick={() => void router.invalidate()}><RefreshCw aria-hidden="true" />Try again</Button></div>;
}
export function NavigationStatus() {
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.isLoading });
  const fetching = useIsFetching();
  const qc = useQueryClient();
  const errors = useSyncExternalStore((notify) => qc.getQueryCache().subscribe(notify), () => qc.getQueryCache().getAll().filter((q) => q.getObserversCount() > 0 && q.state.status === "error").map((q) => q.queryHash).join(","), () => "");
  if (!hydrated || (!navigating && !fetching && !errors)) return null;
  return <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t bg-popover px-4 py-3 text-sm shadow-card lg:left-[230px]">
    {errors ? <><p role="alert">Some data couldn’t load. Last saved values may be shown.</p><Button size="sm" variant="outline" onClick={() => void qc.refetchQueries({ type: "active" })}><RefreshCw aria-hidden="true" />Retry</Button></> : <p role="status" className="flex items-center gap-2"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{navigating ? "Loading page…" : "Updating data…"}</p>}
  </div>;
}