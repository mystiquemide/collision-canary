import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/app/_components/app-header";
import { CopyButton } from "@/app/_components/copy-button";
import { isUuid } from "@/modules/actors/barrier";
import {
  evaluateRun,
  getRunProof,
  type RunProof,
} from "@/modules/invariants/evaluate-run";
import {
  createRepairPacket,
  repairPacketMarkdown,
} from "@/modules/repair/repair-packet";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proof · Collision Canary",
};

type Actor = RunProof["actors"][number];
const TERMINAL = new Set(["succeeded", "rejected", "errored"]);

function ActorTrack({ actor, violated }: { actor: Actor; violated: boolean }) {
  const claimed = actor.outcomeCode === "seat_claimed";
  const rejected = actor.outcomeCode === "seat_unavailable";
  const bar = claimed ? (violated ? "bg-collision" : "bg-verified") : "bg-border";
  const pill = claimed ? "won" : rejected ? "seat taken" : actor.status;
  const pillClass = claimed
    ? "bg-[#DEF6EC] text-verified"
    : "bg-secondary text-muted";

  return (
    <div className="my-2 flex items-center gap-3">
      <span className="w-14 font-mono text-sm text-ink">
        {actor.displayName}
      </span>
      <span className={`h-2 flex-1 rounded-full ${bar}`} />
      <span
        className={`rounded-full px-2.5 py-0.5 font-mono text-[0.66rem] ${pillClass}`}
      >
        {pill}
      </span>
    </div>
  );
}

export default async function ProofPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!isUuid(runId)) notFound();

  let proof = await getRunProof(runId).catch(() => null);
  if (!proof) notFound();

  const allTerminal =
    proof.actors.length > 0 &&
    proof.actors.every((actor) => TERMINAL.has(actor.status));

  if (
    !proof.evaluation &&
    allTerminal &&
    proof.attempts.length === proof.actors.length
  ) {
    const evaluated = await evaluateRun(runId).catch(() => null);
    if (evaluated) proof = evaluated;
  }

  const verdict = proof.evaluation?.verdict ?? null;
  const violated = verdict === "violated";
  const shortId = `run_${proof.run.id.slice(0, 4).toUpperCase()}`;

  let headerPill = { label: "In progress", cls: "bg-[#FBEECB] text-ink" };
  if (violated) headerPill = { label: "Collision found", cls: "bg-[#FDE7E2] text-collision" };
  else if (verdict === "satisfied") headerPill = { label: "Verified", cls: "bg-[#DEF6EC] text-verified" };
  else if (verdict === "infra_error") headerPill = { label: "Infrastructure error", cls: "bg-[#FBEECB] text-ink" };

  let packetMd: string | null = null;
  let packetSha: string | null = null;
  if (violated) {
    try {
      const packet = createRepairPacket(proof);
      packetMd = repairPacketMarkdown(packet);
      packetSha = packet.packetSha256;
    } catch {
      packetMd = null;
    }
  }

  const cycle = proof.repairCycle;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16">
      <AppHeader active="runs" />
      <section id="main" tabIndex={-1} className="mx-auto mt-10 max-w-[620px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgba(30,40,60,0.08)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
            <span className="font-mono text-sm text-muted">{shortId}</span>
            <span
              className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${headerPill.cls}`}
            >
              {headerPill.label}
            </span>
          </div>

          <div className="px-5 py-5">
            <p className="text-sm text-ink">{proof.invariant.statement}</p>

            <div className="mt-4">
              {proof.actors.map((actor) => (
                <ActorTrack
                  key={actor.actorKey}
                  actor={actor}
                  violated={violated}
                />
              ))}
            </div>

            {proof.evaluation ? (
              <dl className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-4 font-mono text-sm">
                <dt className="text-muted">Winners</dt>
                <dd
                  className={`text-right ${violated ? "text-collision" : "text-verified"}`}
                >
                  {proof.evaluation.successfulClaims}
                </dd>
                <dt className="text-muted">Recorded claims</dt>
                <dd
                  className={`text-right ${violated ? "text-collision" : "text-ink"}`}
                >
                  {proof.evaluation.persistedClaims}
                </dd>
                <dt className="text-muted">Seats left</dt>
                <dd className="text-right text-ink">
                  {proof.evaluation.finalRemaining}
                </dd>
                <dt className="text-muted">Reason</dt>
                <dd className="text-right text-ink">
                  {proof.evaluation.reasonCode}
                </dd>
              </dl>
            ) : (
              <div className="mt-4 border-t border-border pt-4">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.05em] text-amber-strong">
                  Run in progress
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  Barrier arrivals {proof.barrier?.arrivedCount ?? 0} of{" "}
                  {proof.barrier?.expectedCount ?? 2}. Reload once both actors
                  have claimed.
                </p>
              </div>
            )}
          </div>
        </div>

        {packetMd && packetSha ? (
          <div className="mt-4 rounded-2xl border border-border border-l-4 border-l-primary bg-card p-5 shadow-[0_10px_26px_rgba(30,40,60,0.06)]">
            <p className="font-mono text-sm text-ink">
              Fix packet ready · redaction passed
            </p>
            <p className="mt-1 break-all font-mono text-[0.66rem] text-muted">
              sha256 {packetSha}
            </p>
            <div className="mt-3">
              <CopyButton text={packetMd} label="Copy repair packet" />
            </div>
            <p className="mt-2 font-mono text-[0.62rem] text-muted">
              The packet is for your own coding agent. The site never runs a
              repair for you.
            </p>
          </div>
        ) : null}

        {cycle ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            {cycle.verifiedRunId && cycle.verifiedRunId !== proof.run.id ? (
              <Link
                href={`/runs/${cycle.verifiedRunId}`}
                className="font-mono text-sm font-semibold text-primary hover:underline"
              >
                View the verified rerun
              </Link>
            ) : cycle.failedRunId !== proof.run.id ? (
              <Link
                href={`/runs/${cycle.failedRunId}`}
                className="font-mono text-sm font-semibold text-primary hover:underline"
              >
                View the original collision
              </Link>
            ) : (
              <p className="font-mono text-sm text-muted">
                This run is linked in a repair cycle.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-6">
          <Link href="/runs" className="font-mono text-sm text-muted hover:text-ink">
            &larr; All runs
          </Link>
        </div>
      </section>
    </main>
  );
}
