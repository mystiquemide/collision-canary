import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { invariantEvaluations, verificationRuns } from "@/db/schema";

export type RunListItem = {
  id: string;
  scenarioKey: string;
  invariantKey: string;
  status: string;
  verdict: string | null;
  successfulClaims: number | null;
  persistedClaims: number | null;
  finalRemaining: number | null;
  createdAt: string;
  completedAt: string | null;
};

export async function listRuns(limit = 50): Promise<RunListItem[]> {
  const rows = await db
    .select({
      id: verificationRuns.id,
      scenarioKey: verificationRuns.scenarioKey,
      invariantKey: verificationRuns.invariantKey,
      status: verificationRuns.status,
      createdAt: verificationRuns.createdAt,
      completedAt: verificationRuns.completedAt,
      verdict: invariantEvaluations.verdict,
      successfulClaims: invariantEvaluations.successfulClaims,
      persistedClaims: invariantEvaluations.persistedClaims,
      finalRemaining: invariantEvaluations.finalRemaining,
    })
    .from(verificationRuns)
    .leftJoin(
      invariantEvaluations,
      eq(invariantEvaluations.runId, verificationRuns.id),
    )
    .where(inArray(verificationRuns.status, ["failed", "verified"]))
    .orderBy(desc(verificationRuns.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    scenarioKey: row.scenarioKey,
    invariantKey: row.invariantKey,
    status: row.status,
    verdict: row.verdict ?? null,
    successfulClaims: row.successfulClaims ?? null,
    persistedClaims: row.persistedClaims ?? null,
    finalRemaining: row.finalRemaining ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }));
}
