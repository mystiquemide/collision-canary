import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function createFixture(
  db: typeof import("@/db/client").db,
  schema: typeof import("@/db/schema"),
  violated: boolean,
) {
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
  const [{ db }, schema, evaluator, repair] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("@/modules/invariants/evaluate-run"),
    import("@/modules/repair/repair-packet"),
  ]);

  const violatedRunId = await createFixture(db, schema, true);
  const satisfiedRunId = await createFixture(db, schema, false);

  try {
    const violated = await evaluator.evaluateRun(violatedRunId);
    const satisfied = await evaluator.evaluateRun(satisfiedRunId);

    assert.equal(violated?.evaluation?.verdict, "violated");
    assert.equal(violated?.evaluation?.reasonCode, "non_linearizable_outcome");
    assert.equal(violated?.evaluation?.successfulClaims, 2);
    assert.ok(violated);
    const packet = repair.createRepairPacket(violated);
    assert.equal(repair.verifyRepairPacket(packet), true);
    assert.equal(
      repair.verifyRepairPacket({
        ...packet,
        repairTarget: {
          routes: ["src/app/page.tsx"],
          modules: packet.repairTarget.modules,
        },
      }),
      false,
    );
    assert.equal(repair.verifyRepairPacket({}), false);
    assert.equal(satisfied?.evaluation?.verdict, "satisfied");
    assert.equal(satisfied?.evaluation?.reasonCode, "capacity_invariant_satisfied");
    assert.equal(satisfied?.evaluation?.successfulClaims, 1);

    const reread = await evaluator.getRunProof(satisfiedRunId);
    assert.equal(reread?.evaluation?.verdict, "satisfied");
    assert.equal(reread?.actors.some((actor) => "token" in actor), false);

    console.log(
      JSON.stringify({
        status: "passed",
        violated: violated?.evaluation,
        satisfied: satisfied?.evaluation,
        proofRedacted: true,
      }),
    );
  } finally {
    await db
      .delete(schema.verificationRuns)
      .where(eq(schema.verificationRuns.id, violatedRunId));
    await db
      .delete(schema.verificationRuns)
      .where(eq(schema.verificationRuns.id, satisfiedRunId));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
