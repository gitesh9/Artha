// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { converse } from "@/features/assistant/adapter.server";
afterEach(() => vi.unstubAllGlobals());
const envelope = (message: unknown) => Response.json({ choices: [{ message }] });
it("validated model proposals remain unapplied and report tools disclose no report without consent", async () => {
 const fetcher = vi.fn().mockResolvedValueOnce(envelope({ tool_calls: [{ id: "r", type: "function", function: { name: "read_report", arguments: "{}" } }, { id: "p", type: "function", function: { name: "propose_expense", arguments: JSON.stringify({ amount: 250, kind: "expense", category: "Food", note: "Lunch", date: "2026-11-21" }) } }] })).mockResolvedValueOnce(envelope({ content: "Review the entry first." })); vi.stubGlobal("fetch", fetcher);
 const result = await converse([{ role: "user", content: "Lunch 250" }], null, "test-only-placeholder", "test-model");
 expect(result.proposal?.amount).toBe(250); const second = JSON.parse(fetcher.mock.calls[1]?.[1]?.body ?? "{}"); expect(second.messages.find((m: { tool_call_id?: string }) => m.tool_call_id === "r")?.content).toBe('{"error":"No report consent"}'); expect(second.messages.find((m: { tool_call_id?: string }) => m.tool_call_id === "p")?.content).toContain('"saved":false'); expect(second.tools).toBeUndefined();
});
it("malicious destinations are rejected before a second provider call or any action", async () => { const fetcher = vi.fn().mockResolvedValue(envelope({ tool_calls: [{ id: "bad", type: "function", function: { name: "navigate_or_prefill", arguments: '{"target":"https://attacker.example"}' } }] })); vi.stubGlobal("fetch", fetcher); await expect(converse([{ role: "user", content: "Navigate" }], null, "test-only-placeholder", "test-model")).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1); });
it("provider authentication failure is recoverable without invented advice", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 }))); await expect(converse([{ role: "user", content: "Help" }], null, "test-only-placeholder", "test-model")).rejects.toThrow("Your entries are unchanged"); });