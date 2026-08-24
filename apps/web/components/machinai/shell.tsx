"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  ArrowLeft,
  Gauge,
  ListTodo,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
/** Set at build time; the repo machinai is pointed at. */
const PROJECT_REPO =
  process.env.NEXT_PUBLIC_MACHINAI_PROJECT_REPO ?? "Inergent/machinai-testbed";

const NAV = [
  { href: "/", label: "Idea", icon: Sparkles },
  { href: "/backlog", label: "Backlog", icon: ListTodo },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/usage", label: "Settings", icon: Gauge },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <span className="font-mono text-[13px] font-semibold leading-none">m</span>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">machinai</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Both icons render; CSS picks one off the `.dark` class next-themes sets on
  // <html>. That avoids a mount effect and the hydration flash that comes with
  // reading the theme during render.
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border px-4 py-5 md:flex">
        <Wordmark />

        <nav className="mt-8 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
                  active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Project
            </p>
            <p className="mt-1 truncate font-mono text-xs text-foreground">
              {PROJECT_REPO}
            </p>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <Wordmark />
        <div className="flex items-center gap-1">
          <span className="max-w-[9rem] truncate font-mono text-xs text-muted-foreground">
            {PROJECT_REPO}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/90 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Consistent page frame: one max width, one gutter, one rhythm. */
export function Page({
  title,
  lead,
  actions,
  back,
  children,
}: {
  title: string;
  lead?: string;
  actions?: React.ReactNode;
  /** Renders above the title, where a back affordance belongs. */
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
            {title}
          </h1>
          {lead && (
            <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{lead}</p>
          )}
        </div>
        {actions}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
