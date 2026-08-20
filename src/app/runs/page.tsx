import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/app/_components/app-header";
import { listRuns, type RunListItem } from "@/modules/runs/list-runs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Runs · Collision Canary",
};

function shortId(id: string): string {
  return `run_${id.slice(0, 4).toUpperCase()}`;
}

function when(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function VerdictPill({ run }: { run: RunListItem }) {
  if (run.verdict === "violated") {
    return (
      <span className="rounded-full bg-[#FDE7E2] px-2.5 py-1 font-mono text-[0.66rem] font-bold text-collision">
        Collision
      </span>
    );
  }
  if (run.verdict === "satisfied") {
    return (
      <span className="rounded-full bg-[#DEF6EC] px-2.5 py-1 font-mono text-[0.66rem] font-bold text-verified">
        Verified
      </span>
    );
  }
  if (run.verdict === "infra_error") {
    return (
      <span className="rounded-full bg-[#FBEECB] px-2.5 py-1 font-mono text-[0.66rem] font-bold text-ink">
        Infra error
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[0.66rem] text-muted">
      {run.status}
    </span>
  );
}

export default async function RunsPage() {
  let runs: RunListItem[] = [];
  let failed = false;
  try {
    runs = await listRuns(50);
  } catch {
    failed = true;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16">
      <AppHeader active="runs" />
      <section id="main" tabIndex={-1} className="mx-auto mt-10 max-w-[820px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[clamp(1.6rem,4.5vw,2.2rem)] font-extrabold tracking-[-0.02em] text-ink">
            Runs
          </h1>
          <Link
            href="/run"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
          >
            New run
          </Link>
        </div>

        {failed ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
            <p className="font-mono text-sm text-muted">
              The runs could not be loaded right now. Reload to try again.
            </p>
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="font-mono text-sm text-muted">
              No proof runs yet. Start with the last-seat test.
            </p>
            <Link
              href="/run"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
            >
              Run the last-seat test
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_26px_rgba(30,40,60,0.06)]">
            {runs.map((run, index) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-canvas ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="font-mono text-sm text-ink">
                  {shortId(run.id)}
                </span>
                <span className="font-mono text-xs text-muted">
                  {run.scenarioKey}
                </span>
                <span className="ml-auto">
                  <VerdictPill run={run} />
                </span>
                <span className="w-full font-mono text-[0.66rem] text-muted sm:w-auto">
                  {run.verdict
                    ? `${run.successfulClaims ?? 0} winner${
                        (run.successfulClaims ?? 0) === 1 ? "" : "s"
                      }`
                    : "in progress"}
                </span>
                <span className="font-mono text-[0.66rem] text-muted">
                  {when(run.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
