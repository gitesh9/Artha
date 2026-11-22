import type { QueryClient } from "@tanstack/react-query";
import { planningQuery } from "@/features/planning/queries";
import { requireSavedData } from "./query-loading";
export function financialHead(title: string, description: string) { return { meta: [{ title: `${title} — Artha` }, { name: "description", content: description }, { property: "og:title", content: `${title} — Artha` }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }; }
export async function loadPlanning(queryClient: QueryClient) { requireSavedData(queryClient, planningQuery.queryKey); return queryClient.ensureQueryData(planningQuery); }