import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";

config({ path: ".env.local" });

async function createTerminalRun(
  db: typeof import("@/db/client").db,
  schema: typeof import("@/db/schema"),
  violated: boolean,
): Promise<string> {
  const runId = randomUUID();
  const resourceId = randomUUID();
  const aliceId = randomUUID();
  const bobId = randomUUID();

  await db.batch([
    db.insert(schema.verificationRuns).values({
      id: runId,
      scenarioKey: "last-seat-v1",
      invariantKey: "capacity-at-most-one-v1",
      status: "released",
    }),
    db.insert(schema.scenarioResources).values({
      id: resourceId,
      runId,
      capacity: 1,
      remaining: 0,
    }),
    db.insert(schema.runActors).values([
      {
        id: aliceId,
        runId,
        actorKey: "alice",
        displayName: "Alice",
        status: "succeeded",
        outcomeCode: "seat_claimed",
        completedAt: new Date(),
      },
      {
        id: bobId,
        runId,
        actorKey: "bob",
        displayName: "Bob",
        status: violated ? "succeeded" : "rejected",
        outcomeCode: violated ? "seat_claimed" : "seat_unavailable",
        completedAt: new Date(),
      },
    ]),
    db.insert(schema.runBarriers).values({
      runId,
      expectedCount: 2,
      arrivedCount: 2,
      releaseVersion: 1,
      releasedAt: new Date(),
    }),
    db.insert(schema.claimAttempts).values([
      {
        runId,
        actorId: aliceId,
        resourceId,
        result: "succeeded",
        observedRemaining: 0,
      },
      {
        runId,
        actorId: bobId,
        resourceId,
        result: violated ? "succeeded" : "rejected",
        observedRemaining: 0,
      },
    ]),
  ] as const);

  return runId;
}

async function main(): Promise<void> {
  const [{ db }, schema, evaluator, repair, linker] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("@/modules/invariants/evaluate-run"),
    import("@/modules/repair/repair-packet"),
    import("@/modules/repair/link-repair-cycle"),
  ]);

  const failedRunId = await createTerminalRun(db, schema, true);
  const verifiedRunId = await createTerminalRun(db, schema, false);
  const otherVerifiedRunId = await createTerminalRun(db, schema, false);

  try {
    const failedProof = await evaluator.evaluateRun(failedRunId);
    const verifiedProof = await evaluator.evaluateRun(verifiedRunId);
    assert.equal(failedProof?.evaluation?.verdict, "violated");
    assert.equal(verifiedProof?.evaluation?.verdict, "satisfied");
    assert.ok(failedProof);

    const packet = repair.createRepairPacket(failedProof);
    const linked = await linker.linkRepairCycle({
      failedRunId,
      verifiedRunId,
      packetSha256: packet.packetSha256,
    });
    assert.equal(linked.failedRunId, failedRunId);
    assert.equal(linked.verifiedRunId, verifiedRunId);
    assert.equal(linked.packetSha256, packet.packetSha256);

    const repeated = await linker.linkRepairCycle({
      failedRunId,
      verifiedRunId,
      packetSha256: packet.packetSha256,
    });
    assert.equal(repeated.id, linked.id);

    const linkedFailed = await evaluator.getRunProof(failedRunId);
    const linkedVerified = await evaluator.getRunProof(verifiedRunId);
    assert.equal(linkedFailed?.repairCycle?.id, linked.id);
    assert.equal(linkedVerified?.repairCycle?.id, linked.id);

    await evaluator.evaluateRun(otherVerifiedRunId);
    await assert.rejects(
      () =>
        linker.linkRepairCycle({
          failedRunId,
          verifiedRunId: otherVerifiedRunId,
          packetSha256: packet.packetSha256,
        }),
      (error: unknown) =>
        error instanceof linker.RepairCycleLinkError &&
        error.code === "repair_cycle_invalid",
    );
    const unlinkedOtherRun = await evaluator.getRunProof(otherVerifiedRunId);
    assert.equal(unlinkedOtherRun?.repairCycle, null);

    await assert.rejects(
      () =>
        linker.linkRepairCycle({
          failedRunId,
          verifiedRunId,
          packetSha256: "0".repeat(64),
        }),
      (error: unknown) =>
        error instanceof linker.RepairCycleLinkError &&
        error.code === "repair_cycle_invalid",
    );

    console.log(
      JSON.stringify({
        status: "passed",
        cycleId: linked.id,
        failedRunId,
        verifiedRunId,
      }),
    );
  } finally {
    await db
      .delete(schema.repairCycles)
      .where(eq(schema.repairCycles.failedRunId, failedRunId));
    await db
      .delete(schema.verificationRuns)
      .where(
        inArray(schema.verificationRuns.id, [
          failedRunId,
          verifiedRunId,
          otherVerifiedRunId,
        ]),
      );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
