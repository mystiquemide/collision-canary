import type { ReactNode } from "react";
import Link from "next/link";

type Section = "run" | "runs" | "system" | null;

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-ink"
          : "rounded-[10px] px-3 py-1.5 text-sm text-muted hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}

export function AppHeader({
  active = null,
  right,
}: {
  active?: Section;
  right?: ReactNode;
}) {
  return (
    <header className="mx-auto mt-5 flex max-w-[1200px] flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[0_8px_22px_rgba(30,40,60,0.07)]">
      <Link
        href="/"
        className="flex items-center gap-2 font-extrabold tracking-tight text-ink"
      >
        <span
          aria-hidden
          className="relative inline-block h-[18px] w-[18px] rounded-[5px] bg-waiting"
        >
          <span className="absolute left-1 top-1 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-ink" />
        </span>
        Collision Canary
      </Link>
      <nav className="ml-1 flex flex-wrap gap-1">
        <NavItem href="/run" label="New Run" active={active === "run"} />
        <NavItem href="/runs" label="Runs" active={active === "runs"} />
        <NavItem href="/system" label="System" active={active === "system"} />
      </nav>
      {right ? <div className="ml-auto">{right}</div> : null}
    </header>
  );
}
