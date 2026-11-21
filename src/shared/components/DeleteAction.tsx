import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useOffline } from "@/core/offline/OfflineProvider";

export function DeleteAction({ label, description, onConfirm }: { label: string; description: string; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { online, entries } = useOffline();
  async function remove() {
    setBusy(true);
    try { await onConfirm(); setOpen(false); toast.success("Deleted"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete"); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
    <DialogTrigger asChild><Button disabled={!online || entries.length > 0} variant="ghost" size="icon" aria-label={`Delete ${label}`} title={entries.length ? "Sync saved entries before deleting" : !online ? "Reconnect before deleting" : `Delete ${label}`} className="text-muted-foreground hover:text-destructive"><Trash2 aria-hidden="true" /></Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Delete {label}?</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}