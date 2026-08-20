"use client";

import { useState } from "react";
import Link from "next/link";

import { CopyButton } from "@/app/_components/copy-button";

type Actor = { actorKey: string; displayName: string; url: string };
type RunResult = { runId: string; actors: Actor[]; proofUrl: string };

export function RunLauncher() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioKey: "last-seat-v1",
          invariantKey: "capacity-at-most-one-v1",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data) {
        setError(
          body?.error?.message ??
            "The run could not be created. Please try again.",
        );
        return;
      }
      setResult(body.data as RunResult);
    } catch {
      setError(
        "The run could not be created. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_26px_rgba(30,40,60,0.08)]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#DEF6EC] px-3 py-1 font-mono text-xs font-bold text-verified">
            Two actors ready
          </span>
          <span className="font-mono text-xs text-muted">
            run_{result.runId.slice(0, 4).toUpperCase()}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">
          Open each actor in its own browser, or point Kane at both. They wait
          at a shared barrier, then claim at the same moment.
        </p>
        <div className="mt-4 grid gap-3">
          {result.actors.map((actor) => (
            <div
              key={actor.actorKey}
              className="rounded-xl border border-border bg-canvas p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-ink">{actor.displayName}</span>
                <a
                  href={actor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-semibold text-primary hover:underline"
                >
                  Open actor
                </a>
              </div>
              <div className="mb-3 break-all rounded-lg bg-card p-2 font-mono text-[0.68rem] text-muted">
                {actor.url}
              </div>
              <CopyButton text={actor.url} label="Copy actor link" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href={`/runs/${result.runId}`}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press"
          >
            Go to the live proof
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-secondary px-5 text-sm font-semibold text-ink transition-[filter] hover:brightness-95"
          >
            Start another run
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_26px_rgba(30,40,60,0.08)]">
      <div className="mb-4">
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
          Scenario
        </span>
        <div className="mt-1 rounded-xl border border-border bg-canvas px-4 py-3 font-semibold text-ink">
          Last-seat booking
        </div>
      </div>
      <div className="mb-4">
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
          The promise we test
        </span>
        <div className="mt-1 rounded-xl bg-[#EAF3FF] px-4 py-3 text-sm text-[#20487a]">
          At most one person can claim the final seat.
        </div>
      </div>
      <dl className="grid max-w-[320px] grid-cols-2 gap-y-1.5 font-mono text-sm">
        <dt className="text-muted">Players</dt>
        <dd className="text-right text-ink">Alice, Bob</dd>
        <dt className="text-muted">Seats</dt>
        <dd className="text-right text-ink">1</dd>
        <dt className="text-muted">Isolation</dt>
        <dd className="text-right text-ink">Fresh seat per run</dd>
      </dl>
      <div className="mt-5">
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(46,139,255,0.28)] transition-colors hover:bg-primary-press disabled:opacity-60"
        >
          {loading ? "Starting..." : "Start paired run"}
        </button>
      </div>
      {error ? (
        <p className="mt-4 rounded-xl bg-[#FDE7E2] px-4 py-3 text-sm text-collision">
          {error}
        </p>
      ) : null}
    </div>
  );
}
