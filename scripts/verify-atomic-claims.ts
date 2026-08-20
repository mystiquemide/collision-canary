import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });
process.env.COLLISION_CANARY_FAILURE_FIXTURE = "false";

async function main(): Promise<void> {
  const [{ db }, schema, claimService] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("@/modules/claims/claim-service"),
  ]);

  const testEnv = process.env as Record<string, string | undefined>;
  testEnv.NODE_ENV = "production";
  process.env.COLLISION_CANARY_FAILURE_FIXTURE = "true";
  await assert.rejects(
    () => claimService.claimSeat({ runId: randomUUID(), actorKey: "alice" }),
    (error: unknown) =>
      error instanceof claimService.ClaimConfigurationError &&
      error.code === "failure_fixture_forbidden",
  );
  testEnv.NODE_ENV = "test";
  process.env.COLLISION_CANARY_FAILURE_FIXTURE = "false";

  const runId = randomUUID();
  const resourceId = randomUUID();
  const aliceId = randomUUID();
  const bobId = randomUUID();

  await db.batch([
    db.insert(schema.verificationRuns).values({
      id: runId,
      scenarioKey: "atomic-claim-check",
      invariantKey: "capacity-at-most-one-v1",
      status: "released",
    }),
    db.insert(schema.scenarioResources).values({
      id: resourceId,
      runId,
      capacity: 1,
      remaining: 1,
    }),
    db.insert(schema.runActors).values([
      {
        id: aliceId,
        runId,
        actorKey: "alice",
        displayName: "Alice",
        status: "released",
      },
      {
        id: bobId,
        runId,
        actorKey: "bob",
        displayName: "Bob",
        status: "released",
      },
    ]),
    db.insert(schema.runBarriers).values({
      runId,
      expectedCount: 2,
      arrivedCount: 2,
      releaseVersion: 1,
      releasedAt: new Date(),
    }),
  ] as const);

  try {
    const [alice, bob] = await Promise.all([
      claimService.claimSeat({ runId, actorKey: "alice" }),
      claimService.claimSeat({ runId, actorKey: "bob" }),
    ]);

    assert.ok(alice);
    assert.ok(bob);
    assert.deepEqual(
      [alice.outcome, bob.outcome].sort(),
      ["rejected", "succeeded"],
    );

    const attempts = await db
      .select({ result: schema.claimAttempts.result })
      .from(schema.claimAttempts)
      .where(eq(schema.claimAttempts.runId, runId));
    const actors = await db
      .select({ status: schema.runActors.status })
      .from(schema.runActors)
      .where(eq(schema.runActors.runId, runId));
    const [resource] = await db
      .select({ remaining: schema.scenarioResources.remaining })
      .from(schema.scenarioResources)
      .where(and(eq(schema.scenarioResources.runId, runId), eq(schema.scenarioResources.id, resourceId)))
      .limit(1);

    assert.equal(attempts.length, 2);
    assert.equal(attempts.filter((attempt) => attempt.result === "succeeded").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.result === "rejected").length, 1);
    assert.equal(actors.filter((actor) => actor.status === "succeeded").length, 1);
    assert.equal(actors.filter((actor) => actor.status === "rejected").length, 1);
    assert.equal(resource?.remaining, 0);

    console.log(
      JSON.stringify({
        status: "passed",
        outcomes: [alice.outcome, bob.outcome].sort(),
        attempts: attempts.length,
        remaining: resource?.remaining,
      }),
    );
  } finally {
    await db
      .delete(schema.verificationRuns)
      .where(eq(schema.verificationRuns.id, runId));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
