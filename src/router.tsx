import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageLoading, PageError } from "@/shared/components/NavigationStatus";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 1 } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 100,
    defaultPendingMinMs: 200,
    defaultPendingComponent: PageLoading,
    defaultErrorComponent: PageError,
  });

  return router;
};
