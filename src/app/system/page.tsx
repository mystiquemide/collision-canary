import type { Metadata } from "next";
import { sql } from "drizzle-orm";

import { AppHeader } from "@/app/_components/app-header";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System · Collision Canary",
};

async function probeDatabase(): Promise<{ ok: boolean; ms: number | null }> {
  try {
    const started = Date.now();
    await db.execute(sql`select 1`);
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: null };
  }
}

export default async function SystemPage() {
  const database = await probeDatabase();
  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16">
      <AppHeader active="system" />
      <section id="main" tabIndex={-1} className="mx-auto mt-10 max-w-[620px]">
        <h1 className="mb-6 text-[clamp(1.6rem,4.5vw,2.2rem)] font-extrabold tracking-[-0.02em] text-ink">
          System
        </h1>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_26px_rgba(30,40,60,0.06)]">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-ink">Database (Neon)</span>
            {database.ok ? (
              <span className="rounded-full bg-[#DEF6EC] px-3 py-1 font-mono text-xs font-bold text-verified">
                Ready · {database.ms}ms
              </span>
            ) : (
              <span className="rounded-full bg-[#FDE7E2] px-3 py-1 font-mono text-xs font-bold text-collision">
                Unavailable
              </span>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <span className="text-sm text-ink">App environment</span>
            <span className="font-mono text-sm text-muted">{environment}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
