import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";

import { db } from "@/db/client";
import { claimAttempts, runActors, scenarioResources } from "@/db/schema";
import type { ActorStatus } from "@/modules/actors/actor-guards";
import type { ActorKey } from "@/modules/actors/barrier";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for claim transactions.");
}

const sqlClient = neon(databaseUrl);

export type ClaimOutcome = "succeeded" | "rejected";

export type ClaimResult = {
  outcome: ClaimOutcome;
  message: string;
  remaining: number;
  idempotent: boolean;
};

export class ClaimStateError extends Error {
  readonly code = "actor_not_released" as const;

  constructor() {
    super("The actor must be released by the barrier before claiming.");
    this.name = "ClaimStateError";
  }
}

export class ClaimConfigurationError extends Error {
  readonly code = "failure_fixture_forbidden" as const;

  constructor() {
    super("The failure fixture is disabled in production.");
    this.name = "ClaimConfigurationError";
  }
}

type ActorClaimContext = {
  actorId: string;
  actorStatus: ActorStatus;
  outcomeCode: string | null;
  resourceId: string;
  remaining: number;
};

async function loadClaimContext({
  runId,
  actorKey,
}: {
  runId: string;
  actorKey: ActorKey;
}): Promise<ActorClaimContext | null> {
  const [row] = await db
    .select({
      actorId: runActors.id,
      actorStatus: runActors.status,
      outcomeCode: runActors.outcomeCode,
      resourceId: scenarioResources.id,
      remaining: scenarioResources.remaining,
    })
    .from(runActors)
    .innerJoin(
      scenarioResources,
      eq(scenarioResources.runId, runActors.runId),
    )
    .where(and(eq(runActors.runId, runId), eq(runActors.actorKey, actorKey)))
    .limit(1);

  return row ?? null;
}

async function readExistingAttempt(actorId: string): Promise<ClaimResult | null> {
  const [attempt] = await db
    .select({
      result: claimAttempts.result,
      observedRemaining: claimAttempts.observedRemaining,
    })
    .from(claimAttempts)
    .where(eq(claimAttempts.actorId, actorId))
    .limit(1);

  if (!attempt || attempt.result === "errored") return null;

  const outcome = attempt.result;
  return {
    outcome,
    message:
      outcome === "succeeded"
        ? "The actor claimed the final seat."
        : "The final seat was already claimed.",
    remaining: attempt.observedRemaining,
    idempotent: true,
  };
}

function claimMode(): "failure_fixture" | "atomic" {
  const fixtureRequested =
    process.env.COLLISION_CANARY_FAILURE_FIXTURE === "true";

  if (fixtureRequested && process.env.NODE_ENV === "production") {
    throw new ClaimConfigurationError();
  }

  return fixtureRequested ? "failure_fixture" : "atomic";
}

async function claimWithFailureFixture({
  runId,
  actorId,
  resourceId,
}: {
  runId: string;
  actorId: string;
  resourceId: string;
}): Promise<ClaimResult> {
  const result = await db.execute(sql`
    WITH observed AS MATERIALIZED (
      SELECT id, remaining
      FROM scenario_resources
      WHERE id = ${resourceId}::uuid
        AND run_id = ${runId}::uuid
    ), delay AS (
      SELECT pg_sleep(0.35) AS pause
      FROM observed
    ), attempt AS (
      INSERT INTO claim_attempts (
        run_id,
        actor_id,
        resource_id,
        result,
        observed_remaining
      )
      SELECT
        ${runId}::uuid,
        ${actorId}::uuid,
        observed.id,
        'succeeded'::claim_result,
        0
      FROM observed, delay
      ON CONFLICT (actor_id) DO NOTHING
      RETURNING result, observed_remaining
    ), resource_update AS (
      UPDATE scenario_resources
      SET remaining = 0,
          version = version + 1,
          updated_at = now()
      FROM observed, delay
      WHERE scenario_resources.id = observed.id
      RETURNING scenario_resources.remaining
    ), actor_update AS (
      UPDATE run_actors
      SET status = 'succeeded'::actor_status,
          outcome_code = 'seat_claimed'::text,
          completed_at = now()
      WHERE id = ${actorId}::uuid
        AND run_id = ${runId}::uuid
        AND status = 'released'::actor_status
        AND EXISTS (SELECT 1 FROM attempt)
      RETURNING status, outcome_code
    )
    SELECT
      (SELECT result FROM attempt) AS "outcome",
      (SELECT observed_remaining FROM attempt) AS "remaining",
      (SELECT outcome_code FROM actor_update) AS "outcomeCode"
  `);

  const row = result.rows[0] as {
    outcome: ClaimOutcome | null;
    remaining: number | null;
    outcomeCode: string | null;
  };

  if (!row?.outcome || row.remaining === null) {
    throw new Error("Failure fixture did not record a claim attempt.");
  }

  return {
    outcome: row.outcome,
    message: "The actor claimed the final seat.",
    remaining: Number(row.remaining),
    idempotent: false,
  };
}

async function claimAtomically({
  runId,
  actorId,
  resourceId,
}: {
  runId: string;
  actorId: string;
  resourceId: string;
}): Promise<ClaimResult> {
  const [, claimResult] = await sqlClient.transaction([
    sqlClient`
      UPDATE run_actors
      SET status = 'claiming'::actor_status,
          request_at = now()
      WHERE id = ${actorId}::uuid
        AND run_id = ${runId}::uuid
        AND status = 'released'::actor_status
      RETURNING id
    `,
    sqlClient`
    WITH target AS MATERIALIZED (
      SELECT id, remaining
      FROM scenario_resources
      WHERE id = ${resourceId}::uuid
        AND run_id = ${runId}::uuid
        AND EXISTS (
          SELECT 1
          FROM run_actors
          WHERE id = ${actorId}::uuid
            AND run_id = ${runId}::uuid
            AND status = 'claiming'::actor_status
        )
    ), claimed AS (
      UPDATE scenario_resources
      SET remaining = scenario_resources.remaining - 1,
          version = scenario_resources.version + 1,
          updated_at = now()
      FROM target
      WHERE scenario_resources.id = target.id
        AND scenario_resources.run_id = ${runId}::uuid
        AND scenario_resources.remaining > 0
      RETURNING scenario_resources.remaining
    ), attempt AS (
      INSERT INTO claim_attempts (
        run_id,
        actor_id,
        resource_id,
        result,
        observed_remaining
      )
      SELECT
        ${runId}::uuid,
        ${actorId}::uuid,
        target.id,
        CASE
          WHEN EXISTS (SELECT 1 FROM claimed)
            THEN 'succeeded'::claim_result
          ELSE 'rejected'::claim_result
        END,
        COALESCE((SELECT remaining FROM claimed), 0)
      FROM target
      ON CONFLICT (actor_id) DO NOTHING
      RETURNING result, observed_remaining
    ), actor_update AS (
      UPDATE run_actors
      SET status = CASE
            WHEN (SELECT result FROM attempt) = 'succeeded'::claim_result
              THEN 'succeeded'::actor_status
            ELSE 'rejected'::actor_status
          END,
          outcome_code = CASE
            WHEN (SELECT result FROM attempt) = 'succeeded'::claim_result
              THEN 'seat_claimed'::text
            ELSE 'seat_unavailable'::text
          END,
          completed_at = now()
      WHERE id = ${actorId}::uuid
        AND run_id = ${runId}::uuid
        AND status = 'claiming'::actor_status
        AND EXISTS (SELECT 1 FROM attempt)
      RETURNING outcome_code
    )
    SELECT
      (SELECT result FROM attempt) AS "outcome",
      (SELECT observed_remaining FROM attempt) AS "remaining",
      (SELECT outcome_code FROM actor_update) AS "outcomeCode"
  `,
  ]);

  const row = (claimResult as unknown[])[0] as {
    outcome: ClaimOutcome | null;
    remaining: number | null;
    outcomeCode: string | null;
  };

  if (!row?.outcome || row.remaining === null) {
    const existing = await readExistingAttempt(actorId);

    if (existing) return existing;

    throw new Error("Atomic claim did not record a claim attempt.");
  }

  return {
    outcome: row.outcome,
    message:
      row.outcome === "succeeded"
        ? "The actor claimed the final seat."
        : "The final seat was already claimed.",
    remaining: Number(row.remaining),
    idempotent: false,
  };
}

export async function claimSeat({
  runId,
  actorKey,
}: {
  runId: string;
  actorKey: ActorKey;
}): Promise<ClaimResult | null> {
  const mode = claimMode();
  const context = await loadClaimContext({ runId, actorKey });

  if (!context) return null;

  if (
    context.actorStatus === "succeeded" ||
    context.actorStatus === "rejected"
  ) {
    const existing = await readExistingAttempt(context.actorId);

    if (!existing) {
      throw new Error("Terminal actor is missing its claim attempt.");
    }

    return existing;
  }

  if (context.actorStatus !== "released") {
    throw new ClaimStateError();
  }

  if (mode === "failure_fixture") {
    return claimWithFailureFixture({
      runId,
      actorId: context.actorId,
      resourceId: context.resourceId,
    });
  }

  return claimAtomically({
    runId,
    actorId: context.actorId,
    resourceId: context.resourceId,
  });
}
