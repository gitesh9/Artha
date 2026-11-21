import { adviceSchema, conflictMessages, type ConflictInput } from "@/features/sync-assistant/service";

export class OpenRouterUnavailable extends Error {
  constructor(public readonly status: number) { super("Provider unavailable"); }
}

/** Credentials are supplied by the authenticated server boundary, never read at import time. */
export async function explainWithOpenRouter(input: ConflictInput, key: string, model: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: conflictMessages(input), temperature: 0.2, max_tokens: 1000, response_format: { type: "json_object" } }),
  });
  if (!response.ok) throw new OpenRouterUnavailable(response.status);
  const envelope = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  const content = envelope.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Invalid provider response");
  return adviceSchema.parse(JSON.parse(content));
}