import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/core/auth/session.functions";
import { ThemeToggle } from "@/shared/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { offlineUser } from "@/core/offline/storage";
import { publicSession } from "@/core/auth/public-session";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, LockKeyhole, PiggyBank, Wallet, WifiOff, FileUp, TrendingUp, Target } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await publicSession(() => typeof window !== "undefined" && !navigator.onLine ? offlineUser() : getCurrentUser());
    if (user) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Artha — know where every rupee goes" },
      { name: "description", content: "Track daily expenses, budgets, accounts and currencies in one calm place." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Artha — know where every rupee goes" },
      { property: "og:description", content: "Track daily expenses, budgets, accounts and currencies in one calm place." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <div className="mx-auto flex min-h-[min(65dvh,680px)] max-w-6xl flex-col justify-center px-6 py-20">
        <p className="text-sm font-medium text-muted-foreground">Personal money management</p>
        <h1 className="mt-6 max-w-3xl text-6xl font-bold leading-tight md:text-8xl">
          Artha<span className="text-primary">.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Log spending in seconds, see your money flow over any timeline, set budgets that warn you before you overspend.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg" >
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6 text-sm text-muted-foreground"><span>INR-first · multi-currency</span><span>Private device vault</span><span>Install on your phone</span></div>
      </div>
      <section className="border-y bg-muted/30 px-6 py-12"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-6"><h2 className="text-3xl font-semibold">Your money. A clearer picture.</h2><img src="/icon-512.png" alt="International banknotes" width="100" height="100" className="h-24 w-24 rounded-md object-cover" /></div><div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{[
        { icon: Wallet, title: "Everyday money", text: "Bank, cash, cards and wallets. Income and expenses, together." },
        { icon: ChartNoAxesCombined, title: "See the direction", text: "Money flow, spending by category and comparisons with earlier periods." },
        { icon: PiggyBank, title: "Stay within budget", text: "Monthly category limits with clear warnings as spending rises." },
        { icon: CalendarDays, title: "A day-by-day view", text: "Find your spending patterns and review the entries behind each day." },
        { icon: WifiOff, title: "Keep going offline", text: "Save entries on your device and follow their sync status when you reconnect." },
        { icon: LockKeyhole, title: "Private while locked", text: "A separate device passphrase protects saved financial copies." },
        { icon: FileUp, title: "Bring your statements", text: "Review PDF, spreadsheet and receipt entries before adding them to an account." },
        { icon: TrendingUp, title: "Track your wealth", text: "Dated assets, liabilities and manual portfolio values with gains and cashflows." },
        { icon: Target, title: "Plan what comes next", text: "Goals, bills, shared expense balances and saved what-if scenarios." },
      ].map(f => <div key={f.title} className="border-t pt-5"><f.icon aria-hidden="true" className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-semibold">{f.title}</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{f.text}</p></div>)}</div></div></section>
      <section className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-12"><div><h2 className="text-2xl font-semibold">Start with one entry.</h2><p className="mt-2 text-muted-foreground">Build a picture of what comes in, what goes out, and what stays.</p></div><Button asChild size="lg"><Link to="/auth">Open Artha<ArrowUpRight aria-hidden="true" /></Link></Button></section>
    </main>
  );
}
