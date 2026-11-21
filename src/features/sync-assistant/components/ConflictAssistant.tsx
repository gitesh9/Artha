import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useOffline } from "@/core/offline/OfflineProvider";
import { explainConflict } from "../functions";
import type { ConflictAdvice } from "../service";

export function ConflictAssistant({ localVersion, onLocalChange }: { localVersion: string; onLocalChange: (value: string) => void }) {
  const { online } = useOffline();
  const explain = useServerFn(explainConflict);
  const [otherVersion, setOtherVersion] = useState("");
  const [context, setContext] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advice, setAdvice] = useState<ConflictAdvice | null>(null);
  const [compared, setCompared] = useState("");
  const signature = JSON.stringify([localVersion, otherVersion, context]);
  const currentAdvice = signature === compared ? advice : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || !consent || busy) return;
    setBusy(true); setError(""); setAdvice(null);
    try {
      const result = await explain({ data: { localVersion, otherVersion, context, consent: true } });
      if (result.ok) { setAdvice(result.advice); setCompared(signature); }
      else setError(result.error);
    } catch { setError("Could not connect or verify your sign-in. Your descriptions remain here; reconnect and retry."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="conflict-heading" className="mt-10 border-t pt-8">
    <h2 id="conflict-heading" className="flex items-center gap-2 text-xl font-semibold"><Sparkles aria-hidden="true" className="h-5 w-5 text-primary" />Conflict assistant</h2>
    <p className="mt-2 text-sm text-muted-foreground">Advice only · no automatic changes to your expenses</p>
    <form className="mt-6 space-y-5" onSubmit={submit} aria-busy={busy}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="conflict-local">Local version</Label><Textarea id="conflict-local" required maxLength={2000} value={localVersion} disabled={busy} onChange={(e) => onLocalChange(e.target.value)} className="min-h-36" placeholder="₹850 for groceries on 21 November; receipt total includes delivery." /></div>
        <div className="space-y-2"><Label htmlFor="conflict-other">Other version</Label><Textarea id="conflict-other" required maxLength={2000} value={otherVersion} disabled={busy} onChange={(e) => setOtherVersion(e.target.value)} className="min-h-36" placeholder="₹800 for the same purchase on another device; delivery was omitted." /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="conflict-context">Supporting details (optional)</Label><Textarea id="conflict-context" maxLength={1000} value={context} disabled={busy} onChange={(e) => setContext(e.target.value)} placeholder="Receipt amount, payment confirmation, or what changed" /></div>
      <div className="flex items-start gap-3"><Checkbox id="conflict-consent" checked={consent} disabled={busy} onCheckedChange={(value) => setConsent(value === true)} /><Label htmlFor="conflict-consent" className="min-w-0 text-sm leading-relaxed">Send these descriptions to OpenRouter and its model provider. Avoid passwords, account numbers, and identifying details.</Label></div>
      {!online && <p role="status" className="text-sm text-warning">Offline: descriptions can be edited here, but AI guidance needs an internet connection. Drafts are not saved after leaving this page.</p>}
      <Button disabled={busy || !online || !consent || !localVersion.trim() || !otherVersion.trim()} type="submit"><Sparkles aria-hidden="true" />{busy ? "Comparing…" : error ? "Retry comparison" : "Compare versions"}</Button>
      {busy && <p role="status" className="text-sm text-muted-foreground">Waiting for OpenRouter…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
    {currentAdvice && <div role="status" className="mt-6 space-y-4 border-l-2 border-primary pl-5 text-sm break-words">
      <h3 className="text-lg font-semibold">{currentAdvice.recommendation === "local" ? "Recommendation: keep the local version" : currentAdvice.recommendation === "other" ? "Recommendation: keep the other version" : "Recommendation: verify before choosing"}</h3>
      <p>{currentAdvice.reasoning}</p>
      <h4 className="font-semibold">Differences</h4><ul className="list-disc space-y-2 pl-5">{currentAdvice.differences.map((difference, i) => <li key={i}>{difference}</li>)}</ul>
      <h4 className="font-semibold">Before you decide</h4><ul className="list-disc space-y-2 pl-5">{currentAdvice.checks.map((check, i) => <li key={i}>{check}</li>)}</ul>
      <p className="text-muted-foreground">Based only on your descriptions, not verified online records. No version has been applied; your sync history is unchanged.</p>
    </div>}
  </section>;
}