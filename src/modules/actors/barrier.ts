import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";

import { db } from "@/db/client";
import { runActors, runBarriers } from "@/db/schema";
import type { ActorStatus } from "@/modules/actors/actor-guards";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for barrier transactions.");
}

const sqlClient = neon(databaseUrl);

export type ActorKey = "alice" | "bob";

export function isActorKey(value: string): value is ActorKey {
  return value === "alice" || value === "bob";
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export type BarrierSnapshot = {
  actorStatus: ActorStatus;
  arrivedCount: number;
  expectedCount: number;
  releaseVersion: number;
  releasedAt: string | null;
  released: boolean;
};

type BarrierRow = {
  actorStatus: ActorStatus;
  arrivedCount: number;
  expectedCount: number;
  releaseVersion: number;
  releasedAt: string | null;
};

function toSnapshot(row: BarrierRow): BarrierSnapshot {
  return {
    actorStatus: row.actorStatus,
    arrivedCount: Number(row.arrivedCount),
    expectedCount: Number(row.expectedCount),
    releaseVersion: Number(row.releaseVersion),
    releasedAt: row.releasedAt,
    released: Number(row.arrivedCount) >= Number(row.expectedCount),
  };
}

export async function readActorBarrier({
  runId,
  actorKey,
}: {
  runId: string;
  actorKey: ActorKey;
}): Promise<BarrierSnapshot | null> {
  const [actor] = await db
    .select({ status: runActors.status })
    .from(runActors)
    .where(and(eq(runActors.runId, runId), eq(runActors.actorKey, actorKey)))
    .limit(1);

  if (!actor) return null;

  const [barrier] = await db
    .select({
      arrivedCount: runBarriers.arrivedCount,
      expectedCount: runBarriers.expectedCount,
      releaseVersion: runBarriers.releaseVersion,
      releasedAt: runBarriers.releasedAt,
    })
    .from(runBarriers)
    .where(eq(runBarriers.runId, runId))
    .limit(1);

  if (!barrier) return null;

  return toSnapshot({
    actorStatus: actor.status,
    arrivedCount: barrier.arrivedCount,
    expectedCount: barrier.expectedCount,
    releaseVersion: barrier.releaseVersion,
    releasedAt: barrier.releasedAt?.toISOString() ?? null,
  });
}

export async function armActor({
  runId,
  actorKey,
  actorId,
}: {
  runId: string;
  actorKey: ActorKey;
  actorId: string;
}): Promise<{ transitioned: boolean; snapshot: BarrierSnapshot } | null> {
  const [barrierRows] = await sqlClient.transaction([
    sqlClient`
    WITH existing_barrier AS (
      SELECT run_id
      FROM run_barriers
      WHERE run_id = ${runId}::uuid
    ), armed AS (
      UPDATE run_actors
      SET status = 'armed'::actor_status,
          armed_at = now()
      WHERE id = ${actorId}::uuid
        AND run_id = ${runId}::uuid
        AND actor_key = ${actorKey}
        AND status = 'created'::actor_status
        AND EXISTS (SELECT 1 FROM existing_barrier)
      RETURNING id
    ), barrier AS (
      UPDATE run_barriers
      SET arrived_count = arrived_count + 1,
          release_version = CASE
            WHEN arrived_count + 1 >= expected_count
              THEN release_version + 1
            ELSE release_version
          END,
          released_at = CASE
            WHEN arrived_count + 1 >= expected_count
              THEN COALESCE(released_at, now())
            ELSE released_at
          END
      WHERE run_id = ${runId}::uuid
        AND arrived_count < expected_count
        AND EXISTS (SELECT 1 FROM armed)
      RETURNING run_id, arrived_count, expected_count, release_version, released_at
    ), run_state AS (
      UPDATE verification_runs
      SET status = CASE
            WHEN barrier.arrived_count >= barrier.expected_count
              THEN 'released'::verification_run_status
            ELSE 'armed'::verification_run_status
          END,
          released_at = barrier.released_at
      FROM barrier
      WHERE verification_runs.id = barrier.run_id
      RETURNING verification_runs.status
    )
    SELECT
      (SELECT id FROM armed) AS "armedActorId",
      CASE
        WHEN (SELECT arrived_count FROM barrier) >= (SELECT expected_count FROM barrier)
          THEN 'released'::actor_status
        ELSE 'armed'::actor_status
      END AS "actorStatus",
      (SELECT arrived_count FROM barrier) AS "arrivedCount",
      (SELECT expected_count FROM barrier) AS "expectedCount",
      (SELECT release_version FROM barrier) AS "releaseVersion",
      (SELECT released_at FROM barrier) AS "releasedAt"
  `,
    sqlClient`
      UPDATE run_actors
      SET status = 'released'::actor_status
      WHERE run_id = ${runId}::uuid
        AND status = 'armed'::actor_status
        AND EXISTS (
          SELECT 1
          FROM run_barriers
          WHERE run_id = ${runId}::uuid
            AND arrived_count >= expected_count
        )
    `,
  ]);

  const row = (barrierRows as unknown[])[0] as
    | (BarrierRow & { armedActorId: string | null })
    | undefined;

  if (!row?.armedActorId) {
    const snapshot = await readActorBarrier({ runId, actorKey });
    return snapshot ? { transitioned: false, snapshot } : null;
  }

  return {
    transitioned: true,
    snapshot: toSnapshot(row),
  };
}
