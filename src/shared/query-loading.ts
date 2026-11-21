import type { QueryClient } from "@tanstack/react-query";
/** Fail explicitly instead of hanging on a paused, never-cached offline query. */
export function requireSavedData(qc: QueryClient, key: readonly unknown[]) {
  if (typeof window !== "undefined" && !navigator.onLine && qc.getQueryData(key) === undefined) {
    throw new Error("This page has not been saved on this device. Reconnect to load it.");
  }
}