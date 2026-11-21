import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, LayoutDashboard, ListOrdered, LogOut, Menu, PiggyBank, Settings, Wallet, History, LockKeyhole } from "lucide-react";
import { authClient } from "@/core/auth/client";
import { QuickAddDialog } from "@/features/transactions/components/QuickAddDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "./ThemeProvider";
import { OfflineProvider } from "@/core/offline/OfflineProvider";
import { clearOfflineUser } from "@/core/offline/storage";
import { broadcastVaultLock, listenForVaultLock, vaultIsUnlocked } from "@/core/offline/vault";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SyncBanner } from "@/core/offline/SyncBanner";

/** Navigation lives here. Add a page: create the route file, then add one entry below. */
const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListOrdered },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/sync-history", label: "Sync history", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [locked, setLocked] = useState(!vaultIsUnlocked(user.id));
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => n.to === pathname)?.label ?? "Artha";

  useEffect(() => listenForVaultLock(() => {
    setLocked(true); setMenuOpen(false); setConfirmSignOut(false);
    void qc.cancelQueries(); qc.clear();
  }), [qc]);

  function lockLocally() {
    setLockMessage("Local copies are locked. Your online sign-in session is still active; sign out online before handing over this device.");
    broadcastVaultLock();
  }
  async function signOut() {
    if (signingOut) return;
    if (!navigator.onLine) { toast.error("Sign-out needs internet to revoke your online session. You can lock local data now."); return; }
    setSigningOut(true); setLockMessage("Locking local data and signing out…");
    broadcastVaultLock();
    try {
      await qc.cancelQueries(); qc.clear();
      // Local protection is immediate, even if remote sign-out or deletion fails.
      let cleared = true;
      try { await clearOfflineUser(user.id, true); } catch { cleared = false; }
      const result = await authClient.signOut();
      if (result.error) throw new Error("Remote sign-out failed");
      if (!cleared) toast.warning("Signed out and local copies are locked, but some browser cache files could not be deleted.");
      await navigate({ to: "/auth", replace: true });
    } catch { setLockMessage("Local financial data is locked, but your online session may still be active. Reconnect and retry sign-out before handing over this device."); }
    finally { setSigningOut(false); }
  }

  if (locked || !vaultIsUnlocked(user.id)) return <main className="flex min-h-dvh items-center justify-center px-5 py-16"><div className="max-w-lg space-y-5"><h1 className="flex items-center gap-3 text-2xl font-semibold"><LockKeyhole aria-hidden="true" />Local data locked</h1><p role="status" className="text-sm text-muted-foreground">{lockMessage || "This tab was locked. The encryption key has been removed from memory and financial copies are no longer displayed."}</p><p className="text-sm text-muted-foreground">Encrypted saved entries and sync history remain on this device. Your passphrase is needed to open them again; clearing browser data can destroy unsynced entries.</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline" disabled={signingOut}><Link to="/local-vault">Unlock local data</Link></Button><Button onClick={() => void signOut()} disabled={signingOut}>{signingOut ? "Signing out…" : "Retry sign-out"}</Button></div></div></main>;

  const navigation = <nav aria-label="Primary" className="mt-10 flex flex-1 flex-col gap-2">
    {NAV.map((n) => <Button key={n.to} asChild variant="ghost" className="justify-start px-4 text-muted-foreground">
      <Link to={n.to} onClick={() => setMenuOpen(false)} activeProps={{ className: "bg-sidebar-accent text-sidebar-primary", "aria-current": "page" }}>
        <n.icon aria-hidden="true" />{n.label}
      </Link>
    </Button>)}
  </nav>;
  const profile = <div className="mt-8 border-t border-sidebar-border pt-5">
    <p className="truncate px-3 text-sm font-medium">{user.name}</p>
    <p className="mt-1 truncate px-3 text-xs text-muted-foreground">{user.email}</p>
    <Button variant="ghost" onClick={lockLocally} className="mt-3 justify-start text-muted-foreground"><LockKeyhole aria-hidden="true" />Lock local data</Button>
    <Button variant="ghost" onClick={() => setConfirmSignOut(true)} className="justify-start text-muted-foreground"><LogOut aria-hidden="true" />Sign out</Button>
  </div>;
  return <OfflineProvider user={user}><AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Sign out and protect this device?</AlertDialogTitle><AlertDialogDescription>Financial snapshots are cleared. Saved entries and sync history stay encrypted, including unsynced expenses; they are not discarded. Keys are removed from all open Artha tabs. To sync later, sign in to the same account and unlock with this device’s passphrase. Signing out needs internet to revoke your online session.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void signOut()}>Sign out securely</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><div className="min-h-dvh lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
    <a href="#main-content" className="sr-only z-50 rounded-md bg-primary p-4 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r bg-sidebar p-5 lg:flex">
      <Link to="/dashboard" className="flex min-h-11 items-center gap-3 px-3 text-2xl font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><ArrowUpRight aria-hidden="true" /></span>Artha<span className="text-primary">.</span></Link>
      {navigation}{profile}
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur"><div className="flex items-center gap-3 px-4 py-4 md:px-8">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu aria-hidden="true" /></Button></SheetTrigger>
          <SheetContent side="left" aria-describedby={undefined} className="flex flex-col overflow-y-auto bg-sidebar pb-24">
            <SheetTitle className="text-2xl">Artha<span className="text-primary">.</span></SheetTitle>
            {navigation}{profile}
          </SheetContent>
        </Sheet>
        <p className="hidden text-sm text-muted-foreground sm:block">Artha <span className="mx-3 text-border">/</span><span className="text-foreground">{current}</span></p>
        <div className="ml-auto flex items-center gap-3"><ThemeToggle /><QuickAddDialog /></div>
        </div><SyncBanner />
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 pb-24 outline-none md:px-8 md:py-10 md:pb-24">{children}</main>
    </div>
  </div></OfflineProvider>;
}
