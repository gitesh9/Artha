import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/core/auth/middleware";
import { conflictSchema, type ConflictAdvice } from "./service";

type AdviceResult = { ok: true; advice: ConflictAdvice } | { ok: false; error: string };
export const explainConflict = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(conflictSchema)
  .handler(async ({ data }): Promise<AdviceResult> => {
    const key = process.env["OPENROUTER_API_KEY"];
    if (!key) return { ok: false, error: "The OpenRouter key is not configured yet. Your descriptions are still here; try again after it is added." };
    const { explainWithOpenRouter, OpenRouterUnavailable } = await import("@/core/integrations/openrouter.server");
    try {
      const advice = await explainWithOpenRouter(data, key, process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini");
      return { ok: true, advice };
    } catch (error) {
      if (error instanceof OpenRouterUnavailable) {
        if (error.status === 401 || error.status === 403) return { ok: false, error: "OpenRouter rejected the key or access to this model. Check your OpenRouter key and model permissions, then retry. No expenses have been changed." };
        if (error.status === 402) return { ok: false, error: "OpenRouter needs credits for this model. Add credits to your OpenRouter account or configure a model your account can use, then retry. No expenses have been changed." };
        if (error.status === 429) return { ok: false, error: "OpenRouter is rate-limiting requests. Wait a moment and retry. Your descriptions are still here and no expenses have been changed." };
      }
      return { ok: false, error: "OpenRouter could not provide guidance. Check your connection or OpenRouter credits and retry. No expenses have been changed." };
    }
  });