import type { ReactNode } from "react";
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string | undefined; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {subtitle && <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
export function Panel({ children, className = "", card = false }: { children: ReactNode; className?: string; card?: boolean }) {
  return <section className={`${card ? "rounded-lg border bg-card p-5" : "border-t py-6"} ${className}`}>{children}</section>;
}
