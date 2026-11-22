import { assistantRules, tools, navigationSchema, proposalSchema, type AssistantResult } from "./service";
import { LEGAL_GUIDANCE, TAX_SOURCE } from "../tax/service";
type Message = { role: string; content: string; tool_call_id?: string; tool_calls?: ToolCall[] };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export async function converse(messages: Message[], report: unknown, key: string, model: string): Promise<AssistantResult> {
  const context: Message[] = [{ role: "system", content: `${assistantRules}\nToday UTC: ${new Date().toISOString().slice(0, 10)}.\nHistorical legal context: ${LEGAL_GUIDANCE.join("\n")}\nTax source: ${TAX_SOURCE}\nReport consent: ${report ? "allowed for the selected period only" : "not given; no financial report is available"}` }, ...messages];
  async function request() { const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", redirect: "manual", signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: context, tools, max_tokens: 1800, temperature: .2 }) }); if (!response.ok) throw new Error("OpenRouter could not respond. Check the configured key/model, then retry. Your entries are unchanged."); const data = await response.json() as { choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[] }; const message = data.choices?.[0]?.message; if (!message) throw new Error("The provider returned no answer. Retry without changing records."); return message; }
  let message = await request(); let navigation: AssistantResult["navigation"] = null, proposal: AssistantResult["proposal"] = null;
  if (message.tool_calls?.length) {
    if (message.tool_calls.length > 5) throw new Error("Too many actions proposed. Ask for one task at a time; nothing has changed.");
    context.push({ role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls });
    for (const call of message.tool_calls.slice(0, 5)) { let result: unknown;
      if (call.function.name === "read_report") result = report ?? { error: "No report consent" };
      else if (call.function.name === "navigate_or_prefill") { navigation = navigationSchema.parse(JSON.parse(call.function.arguments)); result = { proposed: navigation, applied: false, requiresUserConfirmation: true }; }
      else if (call.function.name === "propose_expense") { proposal = proposalSchema.parse(JSON.parse(call.function.arguments)); result = { proposed: proposal, saved: false, requiresUserConfirmation: true }; }
      else result = { error: "Unknown tool; no action taken" };
      context.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", redirect: "manual", signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: context, max_tokens: 1800, temperature: .2 }) });
    if (!response.ok) throw new Error("OpenRouter could not finish the explanation. Nothing was applied; retry.");
    const envelope = await response.json() as { choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[] };
    const final = envelope.choices?.[0]?.message; if (!final) throw new Error("No final explanation returned. Nothing was applied."); message = final;
  }
  return { answer: (message.content ?? "Review the proposed action below. Nothing has been changed.").slice(0, 12000), navigation, proposal };
}