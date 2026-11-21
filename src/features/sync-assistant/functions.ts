
import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/core/auth/middleware";
import { conflictSchema, type ConflictAdvice } from "./service";

type AdviceResult =
  | { ok: true; advice: ConflictAdvice }
  | { ok: false; error: string };

export const explainConflict = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(conflictSchema)
  .handler(async ({ data }): Promise<AdviceResult> => {
    // Read credentials and model configuration exclusively on the server.
    const key = process.env["OPENROUTER_API_KEY"];
    const model = process.env["OPENROUTER_MODEL"];

    if (!key) {
      return {
        ok: false,
        error: "OpenRouter is not configured. Please try again later.",
      };
    }

    if (!model) {
      return {
        ok: false,
        error: "The OpenRouter model is not configured. Please try again later.",
      };
    }

    try {
      const {
        explainWithOpenRouter,
        OpenRouterUnavailable,
      } = await import("@/core/integrations/openrouter.server");

      const advice = await explainWithOpenRouter(data, key, model);

      return { ok: true, advice };
    } catch (error) {
      const { OpenRouterUnavailable } = await import(
        "@/core/integrations/openrouter.server"
      );

      if (error instanceof OpenRouterUnavailable) {
        if (error.status === 401 || error.status === 403) {
          return {
            ok: false,
            error: "OpenRouter rejected the API key or model permissions. Check your configuration.",
          };
        }

        if (error.status === 402) {
          return {
            ok: false,
            error: "OpenRouter requires additional credits for this model.",
          };
        }

        if (error.status === 429) {
          return {
            ok: false,
            error: "OpenRouter is temporarily rate-limiting requests. Please retry shortly.",
          };
        }
      }

      return {
        ok: false,
        error: "OpenRouter could not provide guidance. Please try again later.",
      };
    }
  });
