import { randomUUID } from "node:crypto";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  claimAttempts,
  invariantEvaluations,
  repairCycles,
  runActors,
  runBarriers,
  scenarioResources,
  verificationRuns,
} from "@/db/schema";

const terminalActorStatuses = new Set([
  "succeeded",
  "rejected",
  "errored",
]);

type EvaluationVerdict = "violated" | "satisfied" | "infra_error";
type RunStatus =
  | "created"
  | "armed"
  | "released"
  | "evaluating"
  | "failed"
  | "verified"
  | "infra_error";

type RunState = {
  run: typeof verificationRuns.$inferSelect;
  resource: typeof scenarioResources.$inferSelect | null;
  actors: (typeof runActors.$inferSelect)[];
  barriers: typeof runBarriers.$inferSelect | null;
  attempts: (typeof claimAttempts.$inferSelect)[];
  evaluation: typeof invariantEvaluations.$inferSelect | null;
  repairCycle: typeof repairCycles.$inferSelect | null;
};

type QueryClient = Pick<typeof db, "select">;

export type RunProof = {
  run: {
    id: string;
    scenarioKey: string;
    invariantKey: string;
    status: RunStatus;
    createdAt: string;
    releasedAt: string | null;
    completedAt: string | null;
  };
  invariant: {
    key: string;
    statement: string;
  };
  resource: {
    capacity: number;
    remaining: number;
    version: number;
  } | null;
  barrier: {
    expectedCount: number;
    arrivedCount: number;
    releaseVersion: number;
    releasedAt: string | null;
  } | null;
  actors: Array<{
    actorKey: string;
    displayName: string;
    status: string;
    outcomeCode: string | null;
    armedAt: string | null;
    requestAt: string | null;
    completedAt: string | null;
  }>;
  attempts: Array<{
    actorKey: string;
    result: string;
    observedRemaining: number;
    createdAt: string;
  }>;
  evaluation: {
    verdict: EvaluationVerdict;
    successfulClaims: number;
    persistedClaims: number;
    finalRemaining: number;
    reasonCode: string;
    evaluatedAt: string;
  } | null;
  repairCycle: {
    id: string;
    failedRunId: string;
    verifiedRunId: string | null;
    packetSha256: string;
  } | null;
};

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function invariantStatement(invariantKey: string): string {
  if (invariantKey === "capacity-at-most-one-v1") {
    return "At most one actor can claim the final seat.";
  }

  return "The declared invariant must hold for the observed run.";
}

async function loadRunState(
  runId: string,
  database: QueryClient = db,
): Promise<RunState | null> {
  const [run] = await database
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.id, runId))
    .limit(1);

  if (!run) return null;

  const [resource, barriers, evaluation, repairCycle] = await Promise.all([
    database
      .select()
      .from(scenarioResources)
      .where(eq(scenarioResources.runId, runId))
      .limit(1)
      .then(([row]) => row ?? null),
    database
      .select()
      .from(runBarriers)
      .where(eq(runBarriers.runId, runId))
      .limit(1)
      .then(([row]) => row ?? null),
    database
      .select()
      .from(invariantEvaluations)
      .where(eq(invariantEvaluations.runId, runId))
      .limit(1)
      .then(([row]) => row ?? null),
    database
      .select()
      .from(repairCycles)
      .where(
        and(
          eq(repairCycles.failedRunId, runId),
        ),
      )
      .limit(1)
      .then(([row]) => row ?? null),
  ]);

  const actors = await database
    .select()
    .from(runActors)
    .where(eq(runActors.runId, runId))
    .orderBy(asc(runActors.actorKey));
  const attempts = await database
    .select({
      id: claimAttempts.id,
      runId: claimAttempts.runId,
      actorId: claimAttempts.actorId,
      resourceId: claimAttempts.resourceId,
      result: claimAttempts.result,
      observedRemaining: claimAttempts.observedRemaining,
      createdAt: claimAttempts.createdAt,
    })
    .from(claimAttempts)
    .innerJoin(runActors, eq(runActors.id, claimAttempts.actorId))
    .where(eq(claimAttempts.runId, runId))
    .orderBy(
      asc(runActors.actorKey),
      asc(claimAttempts.createdAt),
      asc(claimAttempts.id),
    );

  return { run, resource, actors, barriers, attempts, evaluation, repairCycle };
}

function toProof(state: RunState): RunProof {
  const actorKeyById = new Map(state.actors.map((actor) => [actor.id, actor.actorKey]));

  return {
    run: {
      id: state.run.id,
      scenarioKey: state.run.scenarioKey,
      invariantKey: state.run.invariantKey,
      status: state.run.status,
      createdAt: state.run.createdAt.toISOString(),
      releasedAt: iso(state.run.releasedAt),
      completedAt: iso(state.run.completedAt),
    },
    invariant: {
      key: state.run.invariantKey,
      statement: invariantStatement(state.run.invariantKey),
    },
    resource: state.resource
      ? {
          capacity: state.resource.capacity,
          remaining: state.resource.remaining,
          version: state.resource.version,
        }
      : null,
    barrier: state.barriers
      ? {
          expectedCount: state.barriers.expectedCount,
          arrivedCount: state.barriers.arrivedCount,
          releaseVersion: state.barriers.releaseVersion,
          releasedAt: iso(state.barriers.releasedAt),
        }
      : null,
    actors: state.actors.map((actor) => ({
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      status: actor.status,
      outcomeCode: actor.outcomeCode,
      armedAt: iso(actor.armedAt),
      requestAt: iso(actor.requestAt),
      completedAt: iso(actor.completedAt),
    })),
    attempts: state.attempts.map((attempt) => ({
      actorKey: actorKeyById.get(attempt.actorId) ?? "unknown",
      result: attempt.result,
      observedRemaining: attempt.observedRemaining,
      createdAt: attempt.createdAt.toISOString(),
    })),
    evaluation: state.evaluation
      ? {
          verdict: state.evaluation.verdict,
          successfulClaims: state.evaluation.successfulClaims,
          persistedClaims: state.evaluation.persistedClaims,
          finalRemaining: state.evaluation.finalRemaining,
          reasonCode: state.evaluation.reasonCode,
          evaluatedAt: state.evaluation.evaluatedAt.toISOString(),
        }
      : null,
    repairCycle: state.repairCycle
      ? {
          id: state.repairCycle.id,
          failedRunId: state.repairCycle.failedRunId,
          verifiedRunId: state.repairCycle.verifiedRunId,
          packetSha256: state.repairCycle.packetSha256,
        }
      : null,
  };
}

function calculateEvaluation(state: RunState): {
  verdict: EvaluationVerdict;
  successfulClaims: number;
  persistedClaims: number;
  finalRemaining: number;
  reasonCode: string;
} {
  const successfulClaims = state.actors.filter(
    (actor) => actor.status === "succeeded",
  ).length;
  const persistedClaims = state.attempts.filter(
    (attempt) => attempt.result === "succeeded",
  ).length;
  const finalRemaining = state.resource?.remaining ?? 0;

  if (state.run.invariantKey !== "capacity-at-most-one-v1") {
    return {
      verdict: "infra_error",
      successfulClaims,
      persistedClaims,
      finalRemaining,
      reasonCode: "unsupported_invariant",
    };
  }

  if (!state.resource || !state.barriers || state.actors.length !== 2) {
    return {
      verdict: "infra_error",
      successfulClaims,
      persistedClaims,
      finalRemaining,
      reasonCode: "missing_run_state",
    };
  }

  if (
    state.actors.some((actor) => !terminalActorStatuses.has(actor.status)) ||
    state.attempts.length !== state.actors.length
  ) {
    return {
      verdict: "infra_error",
      successfulClaims,
      persistedClaims,
      finalRemaining,
      reasonCode: "incomplete_actor_outcomes",
    };
  }

  if (successfulClaims !== persistedClaims) {
    return {
      verdict: "violated",
      successfulClaims,
      persistedClaims,
      finalRemaining,
      reasonCode: "observation_conflict",
    };
  }

  if (
    successfulClaims > state.resource.capacity
  ) {
    return {
      verdict: "violated",
      successfulClaims,
      persistedClaims,
      finalRemaining,
      reasonCode: "non_linearizable_outcome",
    };
  }

  if (
    finalRemaining !== state.resource.capacity - successfulClaims
  ) {
    return {
      verdict: "violated",
      successfulClaims,
      persistedClaims,
      finalRemaining,
      reasonCode: "capacity_invariant_violated",
    };
  }

  return {
    verdict: "satisfied",
    successfulClaims,
    persistedClaims,
    finalRemaining,
    reasonCode: "capacity_invariant_satisfied",
  };
}

function synchronizeRunStatus(runId: string) {
  return db
    .update(verificationRuns)
    .set({
      status: sql`
        CASE (
          SELECT verdict
          FROM invariant_evaluations
          WHERE run_id = ${runId}::uuid
        )
          WHEN 'violated'::invariant_verdict THEN 'failed'::verification_run_status
          WHEN 'satisfied'::invariant_verdict THEN 'verified'::verification_run_status
          ELSE 'infra_error'::verification_run_status
        END
      `,
      completedAt: sql`
        (
          SELECT evaluated_at
          FROM invariant_evaluations
          WHERE run_id = ${runId}::uuid
        )
      `,
    })
    .where(
      and(
        eq(verificationRuns.id, runId),
        isNull(verificationRuns.completedAt),
      ),
    );
}

export async function getRunProof(runId: string): Promise<RunProof | null> {
  const state = await loadRunState(runId);
  return state ? toProof(state) : null;
}

export async function evaluateRun(runId: string): Promise<RunProof | null> {
  const state = await loadRunState(runId);
  if (!state) return null;
  if (state.evaluation) {
    await synchronizeRunStatus(runId);
    return getRunProof(runId);
  }

  const calculated = calculateEvaluation(state);
  const evaluatedAt = new Date();
  const evaluationId = randomUUID();

  await db.batch([
    db
      .insert(invariantEvaluations)
      .values({
        id: evaluationId,
        runId,
        verdict: calculated.verdict,
        successfulClaims: calculated.successfulClaims,
        persistedClaims: calculated.persistedClaims,
        finalRemaining: calculated.finalRemaining,
        reasonCode: calculated.reasonCode,
        evaluatedAt,
      })
      .onConflictDoNothing({ target: invariantEvaluations.runId }),
    synchronizeRunStatus(runId),
  ] as const);

  return getRunProof(runId);
}
