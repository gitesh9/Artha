import { afterEach, describe, expect, it, vi } from "vitest";
import { conflictSchema, conflictMessages } from "@/features/sync-assistant/service";
import { explainWithOpenRouter } from "@/core/integrations/openrouter.server";

const input = { localVersion: "INR 850 groceries, receipt includes delivery", otherVersion: "INR 800 same groceries, delivery omitted", context: "Receipt is INR 850", consent: true as const };
afterEach(() => vi.unstubAllGlobals());
describe("OpenRouter conflict guidance", () => {
  it("requires explicit consent before sending financial descriptions", () => {
    expect(conflictSchema.safeParse({ ...input, consent: false }).success).toBe(false);
    expect(conflictSchema.safeParse(input).success).toBe(true);
  });
  it("keeps both descriptions as untrusted data rather than model instructions", () => {
    const messages = conflictMessages(input);
    expect(JSON.parse(messages[1]?.content ?? "{}")).toEqual({ localVersion: input.localVersion, otherVersion: input.otherVersion, context: input.context });
  });
  it("calls OpenRouter directly and returns a recommendation without financial writes", async () => {
    const advice = { differences: ["Local includes INR 50 delivery"], recommendation: "local", reasoning: "Matches the stated receipt", checks: ["Verify the receipt"] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(advice) } }] })));
    vi.stubGlobal("fetch", fetcher);
    expect(await explainWithOpenRouter(input, "test-key", "openai/gpt-4o-mini")).toEqual(advice);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body)).model).toBe("openai/gpt-4o-mini");
  });
  it("rejects invented resolution commands rather than applying them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ differences: ["50 INR"], recommendation: "delete-all", reasoning: "bad", checks: ["none"] }) } }] }))));
    await expect(explainWithOpenRouter(input, "test-key", "openai/gpt-4o-mini")).rejects.toThrow();
  });
  it("does not substitute another service when OpenRouter is unavailable", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(explainWithOpenRouter(input, "test-key", "openai/gpt-4o-mini")).rejects.toThrow("Provider unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});