import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/core/auth/session.functions";
import { ThemeToggle } from "@/shared/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { offlineUser } from "@/core/offline/storage";
import { publicSession } from "@/core/auth/public-session";

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
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-16">
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
      </div>
    </main>
  );
}
