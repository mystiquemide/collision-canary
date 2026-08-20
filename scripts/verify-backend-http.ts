import assert from "node:assert/strict";

const baseUrl = process.env.COLLISION_CANARY_BASE_URL ?? "http://127.0.0.1:3001";
const failureFixture = process.env.COLLISION_CANARY_FAILURE_FIXTURE === "true";

type Envelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
  requestId: string;
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Envelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as Envelope<T>;
  return { status: response.status, body };
}

function bearer(url: string): string {
  const token = new URL(url).hash.match(/^#token=(.+)$/)?.[1];
  assert.ok(token, "actor URL must carry a fragment token");
  return decodeURIComponent(token);
}

async function main(): Promise<void> {
  const health = await request<{
    status: string;
    database: string;
    version: string;
  }>("/api/v1/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.data?.database, "ready");

  const created = await request<{
    runId: string;
    actors: Array<{ actorKey: string; url: string }>;
  }>("/api/v1/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioKey: "last-seat-v1",
      invariantKey: "capacity-at-most-one-v1",
    }),
  });
  assert.equal(created.status, 201);
  assert.ok(created.body.data);
  const runId = created.body.data.runId;
  const alice = created.body.data.actors.find((actor) => actor.actorKey === "alice");
  const bob = created.body.data.actors.find((actor) => actor.actorKey === "bob");
  assert.ok(alice);
  assert.ok(bob);
  assert.equal(alice.url.includes("?token="), false);
  assert.equal(bob.url.includes("?token="), false);

  const aliceToken = bearer(alice.url);
  const bobToken = bearer(bob.url);
  const actorHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

  const armAlice = await request<{ snapshot: { arrivedCount: number } }>(
    `/api/v1/runs/${runId}/actors/alice/arm`,
    { method: "POST", headers: actorHeaders(aliceToken) },
  );
  const armBob = await request<{ snapshot: { released: boolean } }>(
    `/api/v1/runs/${runId}/actors/bob/arm`,
    { method: "POST", headers: actorHeaders(bobToken) },
  );
  assert.equal(armAlice.status, 200);
  assert.equal(armAlice.body.data?.snapshot.arrivedCount, 1);
  assert.equal(armBob.status, 200);
  assert.equal(armBob.body.data?.snapshot.released, true);

  const barrier = await request<{ released: boolean; arrivedCount: number }>(
    `/api/v1/runs/${runId}/actors/alice/barrier`,
    { headers: actorHeaders(aliceToken) },
  );
  assert.equal(barrier.status, 200);
  assert.equal(barrier.body.data?.released, true);
  assert.equal(barrier.body.data?.arrivedCount, 2);

  const [aliceClaim, bobClaim] = await Promise.all([
    request<{ outcome: string }>(
      `/api/v1/runs/${runId}/actors/alice/claim`,
      { method: "POST", headers: actorHeaders(aliceToken) },
    ),
    request<{ outcome: string }>(
      `/api/v1/runs/${runId}/actors/bob/claim`,
      { method: "POST", headers: actorHeaders(bobToken) },
    ),
  ]);
  if (failureFixture) {
    assert.deepEqual(
      [aliceClaim.body.data?.outcome, bobClaim.body.data?.outcome].sort(),
      ["succeeded", "succeeded"],
    );
    assert.deepEqual([aliceClaim.status, bobClaim.status].sort(), [200, 200]);
  } else {
    assert.deepEqual(
      [aliceClaim.body.data?.outcome, bobClaim.body.data?.outcome].sort(),
      ["rejected", "succeeded"],
    );
    assert.deepEqual([aliceClaim.status, bobClaim.status].sort(), [200, 409]);
  }

  const evaluated = await request<{ evaluation: { verdict: string } }>(
    `/api/v1/runs/${runId}/evaluate`,
    { method: "POST" },
  );
  assert.equal(evaluated.status, 200);
  assert.equal(
    evaluated.body.data?.evaluation.verdict,
    failureFixture ? "violated" : "satisfied",
  );

  const proof = await request<{
    run: { status: string };
    evaluation: { verdict: string };
    actors: Array<Record<string, unknown>>;
  }>(`/api/v1/runs/${runId}/proof`);
  assert.equal(proof.status, 200);
  assert.equal(
    proof.body.data?.run.status,
    failureFixture ? "failed" : "verified",
  );
  assert.equal(
    proof.body.data?.evaluation.verdict,
    failureFixture ? "violated" : "satisfied",
  );
  assert.equal(proof.body.data?.actors.some((actor) => "token" in actor), false);

  const repairPacket = await request(`/api/v1/runs/${runId}/repair-packet`);
  if (failureFixture) {
    assert.equal(repairPacket.status, 200);
    const serializedPacket = JSON.stringify(repairPacket.body.data);
    assert.match(serializedPacket, /packetSha256/);
    assert.doesNotMatch(serializedPacket, /token|password|DATABASE_URL|postgresql:\/\//i);
  } else {
    assert.equal(repairPacket.status, 409);
    assert.equal(repairPacket.body.error?.code, "repair_packet_unavailable");
  }

  const invalid = await request("/api/v1/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioKey: "last-seat-v1" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error?.code, "invalid_request");

  console.log(
    JSON.stringify({
      status: "passed",
      mode: failureFixture ? "failure_fixture" : "atomic",
      runId,
      proofStatus: failureFixture ? "failed" : "verified",
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
