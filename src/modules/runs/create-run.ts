import { randomUUID } from "node:crypto";

import { db } from "@/db/client";
import {
  runActors,
  runBarriers,
  scenarioResources,
  verificationRuns,
} from "@/db/schema";
import { createActorToken } from "@/lib/security/actor-token";

export const SCENARIOS = {
  "last-seat-v1": {
    invariantKey: "capacity-at-most-one-v1",
    capacity: 1,
    actors: [
      { actorKey: "alice", displayName: "Alice" },
      { actorKey: "bob", displayName: "Bob" },
    ],
  },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

type CreateRunInput = {
  scenarioKey: ScenarioKey;
  baseUrl: string;
};

export async function createVerificationRun({
  scenarioKey,
  baseUrl,
}: CreateRunInput) {
  const scenario = SCENARIOS[scenarioKey];
  const runId = randomUUID();
  const resourceId = randomUUID();
  const actorIds = scenario.actors.map(() => randomUUID());
  const createdAt = new Date();
  const expiresAt = createdAt.getTime() + 60 * 60 * 1000;

  const actorRows = scenario.actors.map((actor, index) => ({
    id: actorIds[index]!,
    runId,
    actorKey: actor.actorKey,
    displayName: actor.displayName,
  }));

  await db.batch([
    db.insert(verificationRuns).values({
      id: runId,
      scenarioKey,
      invariantKey: scenario.invariantKey,
      createdAt,
    }),
    db.insert(scenarioResources).values({
      id: resourceId,
      runId,
      capacity: scenario.capacity,
      remaining: scenario.capacity,
    }),
    db.insert(runActors).values(actorRows),
    db.insert(runBarriers).values({
      runId,
      expectedCount: scenario.actors.length,
    }),
  ] as const);

  const actors = scenario.actors.map((actor) => {
    const actorUrl = new URL("/lab/last-seat", baseUrl);
    actorUrl.searchParams.set("runId", runId);
    actorUrl.searchParams.set("actor", actor.actorKey);
    actorUrl.searchParams.set(
      "token",
      createActorToken({ runId, actorKey: actor.actorKey, expiresAt }),
    );

    return {
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      url: actorUrl.toString(),
    };
  });

  const proofUrl = new URL(`/runs/${runId}`, baseUrl).toString();

  return {
    runId,
    scenarioKey,
    invariantKey: scenario.invariantKey,
    status: "created" as const,
    createdAt: createdAt.toISOString(),
    actors,
    proofUrl,
  };
}
