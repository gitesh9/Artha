import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  const [preview, setPreview] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    update();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setPreview(window.self !== window.top || window.location.hostname.startsWith("id-preview--"));
    const capture = (event: Event) => {
      if (!("prompt" in event) || !("userChoice" in event)) return;
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => { setPrompt(null); setInstalled(true); setOpen(false); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    standalone.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      standalone.removeEventListener("change", update);
    };
  }, []);

  async function install() {
    if (!prompt || busy) { setOpen(true); return; }
    setBusy(true); setFailed(false);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      // A browser prompt is single-use, including when dismissed.
      setPrompt(null);
      if (choice.outcome === "accepted") setOpen(false);
    } catch { setPrompt(null); setFailed(true); setOpen(true); }
    finally { setBusy(false); }
  }

  if (installed) return null;
  return <>
    <div className="fixed bottom-20 right-4 z-30 md:bottom-6">
      <Button variant="outline" className="bg-background shadow-card" onClick={() => void install()} disabled={busy}>
        <Download aria-hidden="true" />{busy ? "Installing…" : "Install Artha"}
      </Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Artha</DialogTitle>
          <DialogDescription>{preview ? "Open your deployed Artha address in a browser to install it. Installation is not available inside this preview." : "Add Artha to this device’s home screen or desktop."}</DialogDescription>
        </DialogHeader>
        {failed && <p role="alert" className="text-sm text-destructive">The browser could not open installation. Try its menu instead.</p>}
        {!preview && (prompt ? <Button onClick={() => void install()} disabled={busy}><Download aria-hidden="true" />Install now</Button> :
          <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
            {ios ? <><li>Open Artha in Safari.</li><li>Open Share, then select Add to Home Screen.</li><li>Confirm Add.</li></> : <><li>Open Artha in Chrome or Edge.</li><li>Open the browser menu and choose Install Artha, Install app, or Add to Home screen.</li><li>If installation is unavailable, revisit the HTTPS address after the first page finishes loading.</li></>}
          </ol>)}
        <p className="flex items-start gap-2 text-sm text-muted-foreground"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Offline expenses use this browser’s encrypted storage. Installation does not bypass your device passphrase.</p>
      </DialogContent>
    </Dialog>
  </>;
}