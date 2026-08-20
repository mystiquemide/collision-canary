import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

const runId = randomUUID();
const actorId = randomUUID();
const actorKey = "alice";
const validExpiresAt = Date.now() + 60_000;

function expectThrows(action: () => unknown, message: string): void {
  let threw = false;

  try {
    action();
  } catch {
    threw = true;
  }

  assert.equal(threw, true, message);
}

async function main(): Promise<void> {
  const [{ db }, schema, tokenModule, guards] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
    import("@/lib/security/actor-token"),
    import("@/modules/actors/actor-guards"),
  ]);

  const validToken = tokenModule.createActorToken({
    runId,
    actorKey,
    expiresAt: validExpiresAt,
  });

  const claims = tokenModule.verifyActorToken(validToken);
  assert.deepEqual(claims, { runId, actorKey, expiresAt: validExpiresAt });

  const expiredToken = tokenModule.createActorToken({
    runId,
    actorKey,
    expiresAt: Date.now() - 1,
  });
  expectThrows(
    () => tokenModule.verifyActorToken(expiredToken),
    "expired token must be rejected",
  );

  const lastCharacter = validToken.at(-1);
  const replacement = lastCharacter === "a" ? "b" : "a";
  const modifiedToken = `${validToken.slice(0, -1)}${replacement}`;
  expectThrows(
    () => tokenModule.verifyActorToken(modifiedToken),
    "modified token must be rejected",
  );

  const request = new Request("http://localhost/api", {
    headers: { authorization: `Bearer ${validToken}` },
  });
  const authenticated = guards.authenticateActorRequest(request, {
    runId,
    actorKey,
  });
  assert.equal(authenticated.actorKey, actorKey);

  expectThrows(
    () =>
      guards.authenticateActorRequest(request, {
        runId: randomUUID(),
        actorKey,
      }),
    "cross-run token must be rejected",
  );

  guards.assertActorTransition("created", "armed");
  expectThrows(
    () => guards.assertActorTransition("created", "succeeded"),
    "invalid actor transition must be rejected",
  );

  await db.batch([
    db.insert(schema.verificationRuns).values({
      id: runId,
      scenarioKey: "b3-guard-check",
      invariantKey: "capacity-at-most-one-v1",
    }),
    db.insert(schema.runActors).values({
      id: actorId,
      runId,
      actorKey,
      displayName: "Alice",
    }),
  ] as const);

  try {
    const armed = await guards.transitionActor({
      actorId,
      from: "created",
      to: "armed",
    });
    assert.equal(armed.status, "armed");

    expectThrows(
      () => guards.assertActorTransition("armed", "succeeded"),
      "armed actor cannot skip release and claiming",
    );
  } finally {
    await db
      .delete(schema.verificationRuns)
      .where(eq(schema.verificationRuns.id, runId));
  }

  console.log(
    JSON.stringify({
      status: "passed",
      checks: [
        "valid token",
        "expired token",
        "modified token",
        "cross-run scope",
        "transition matrix",
        "database state guard",
      ],
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
