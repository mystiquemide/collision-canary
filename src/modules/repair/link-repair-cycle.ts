import { neon } from "@neondatabase/serverless";

import { getRunProof, type RunProof } from "@/modules/invariants/evaluate-run";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to link repair cycles.");
}

const sqlClient = neon(databaseUrl);

export type RepairCycleRecord = {
  id: string;
  failedRunId: string;
  verifiedRunId: string;
  packetSha256: string;
  createdAt: string;
};

export class RepairCycleLinkError extends Error {
  readonly code = "repair_cycle_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "RepairCycleLinkError";
  }
}

function assertRunPair(failed: RunProof, verified: RunProof): void {
  if (
    failed.run.status !== "failed" ||
    failed.evaluation?.verdict !== "violated"
  ) {
    throw new RepairCycleLinkError(
      "The failed run must have a violated terminal proof.",
    );
  }

  if (
    verified.run.status !== "verified" ||
    verified.evaluation?.verdict !== "satisfied"
  ) {
    throw new RepairCycleLinkError(
      "The verified run must have a satisfied terminal proof.",
    );
  }

  if (
    failed.run.scenarioKey !== verified.run.scenarioKey ||
    failed.run.invariantKey !== verified.run.invariantKey
  ) {
    throw new RepairCycleLinkError(
      "Failed and verified runs must use the same scenario and invariant.",
    );
  }
}

export async function linkRepairCycle({
  failedRunId,
  verifiedRunId,
  packetSha256,
}: {
  failedRunId: string;
  verifiedRunId: string;
  packetSha256: string;
}): Promise<RepairCycleRecord> {
  if (
    failedRunId === verifiedRunId ||
    !/^[a-f0-9]{64}$/.test(packetSha256)
  ) {
    throw new RepairCycleLinkError("The repair cycle identifiers are invalid.");
  }

  const [failed, verified] = await Promise.all([
    getRunProof(failedRunId),
    getRunProof(verifiedRunId),
  ]);

  if (!failed || !verified) {
    throw new RepairCycleLinkError("Both repair-cycle runs must exist.");
  }

  assertRunPair(failed, verified);

  const [cycleRows] = await sqlClient.transaction([
    sqlClient`
      WITH candidate AS (
        SELECT
          failed.id AS "failedRunId",
          verified.id AS "verifiedRunId"
        FROM verification_runs AS failed
        INNER JOIN verification_runs AS verified
          ON verified.id = ${verifiedRunId}::uuid
        WHERE failed.id = ${failedRunId}::uuid
          AND failed.status = 'failed'::verification_run_status
          AND verified.status = 'verified'::verification_run_status
          AND failed.scenario_key = verified.scenario_key
          AND failed.invariant_key = verified.invariant_key
      ), inserted AS (
        INSERT INTO repair_cycles (
          failed_run_id,
          verified_run_id,
          packet_sha256
        )
        SELECT
          "failedRunId",
          "verifiedRunId",
          ${packetSha256}
        FROM candidate
        ON CONFLICT (failed_run_id) DO NOTHING
        RETURNING
          id,
          failed_run_id AS "failedRunId",
          verified_run_id AS "verifiedRunId",
          packet_sha256 AS "packetSha256",
          created_at AS "createdAt"
      )
      SELECT
        id,
        "failedRunId",
        "verifiedRunId",
        "packetSha256",
        "createdAt"
      FROM inserted
      UNION ALL
      SELECT
        id,
        failed_run_id AS "failedRunId",
        verified_run_id AS "verifiedRunId",
        packet_sha256 AS "packetSha256",
        created_at AS "createdAt"
      FROM repair_cycles
      WHERE failed_run_id = ${failedRunId}::uuid
      LIMIT 1
    `,
    sqlClient`
      UPDATE verification_runs
      SET repair_cycle_id = (
        SELECT id
        FROM repair_cycles
        WHERE failed_run_id = ${failedRunId}::uuid
      )
      WHERE id IN (${failedRunId}::uuid, ${verifiedRunId}::uuid)
        AND repair_cycle_id IS NULL
    `,
  ]);

  const row = (cycleRows as unknown[])[0] as
    | {
        id: string;
        failedRunId: string;
        verifiedRunId: string | null;
        packetSha256: string;
        createdAt: string | Date;
      }
    | undefined;

  if (
    !row ||
    row.failedRunId !== failedRunId ||
    row.verifiedRunId !== verifiedRunId ||
    row.packetSha256 !== packetSha256
  ) {
    throw new RepairCycleLinkError(
      "The repair cycle already exists with different run or packet data.",
    );
  }

  return {
    id: row.id,
    failedRunId: row.failedRunId,
    verifiedRunId: row.verifiedRunId,
    packetSha256: row.packetSha256,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
