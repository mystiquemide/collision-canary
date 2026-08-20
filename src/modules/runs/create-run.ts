import { createHmac, randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { createActorToken } from "@/lib/security/actor-token";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for run creation.");
}

const sqlClient = neon(databaseUrl);

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

export class RunCreationCapacityError extends Error {
  readonly code = "run_capacity_reached" as const;

  constructor() {
    super("The run creation limit has been reached. Try again later.");
    this.name = "RunCreationCapacityError";
  }
}

export class PublicBaseUrlError extends Error {
  readonly code = "public_base_url_unavailable" as const;

  constructor() {
    super("A trusted public application URL is required in production.");
    this.name = "PublicBaseUrlError";
  }
}

function configuredPublicBaseUrl(): string | undefined {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim();

  if (!configured) return undefined;
  return /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;
}

export function resolvePublicBaseUrl(requestUrl: string): string {
  const configured = configuredPublicBaseUrl();

  if (!configured && process.env.NODE_ENV === "production") {
    throw new PublicBaseUrlError();
  }

  let parsed: URL;

  try {
    parsed = new URL(configured ?? requestUrl);
  } catch {
    throw new PublicBaseUrlError();
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new PublicBaseUrlError();
  }

  return parsed.origin;
}

type CreateRunInput = {
  scenarioKey: ScenarioKey;
  baseUrl: string;
  creatorFingerprint: string;
};

export function createRunFingerprint(request: Request): string {
  const secret = process.env.LAB_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("LAB_SIGNING_SECRET must contain at least 32 characters.");
  }

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const address =
    forwarded?.at(-1) || request.headers.get("x-real-ip")?.trim() || "local";

  return createHmac("sha256", secret)
    .update(`run-admission:${address}`)
    .digest("hex");
}

export async function createVerificationRun({
  scenarioKey,
  baseUrl,
  creatorFingerprint,
}: CreateRunInput) {
  const scenario = SCENARIOS[scenarioKey];
  const runId = randomUUID();
  const resourceId = randomUUID();
  const actorIds = scenario.actors.map(() => randomUUID());
  const createdAt = new Date();
  const expiresAt = createdAt.getTime() + 60 * 60 * 1000;

  const [, insertedRuns] = await sqlClient.transaction([
    sqlClient`
      SELECT pg_advisory_xact_lock(
        hashtextextended('collision-canary:run-creation', 0)
      )
    `,
    sqlClient`
      INSERT INTO verification_runs (
        id,
        scenario_key,
        invariant_key,
        creator_fingerprint,
        created_at
      )
      SELECT
        ${runId}::uuid,
        ${scenarioKey},
        ${scenario.invariantKey},
        ${creatorFingerprint},
        ${createdAt}
      WHERE (
        SELECT count(*)
        FROM verification_runs
        WHERE created_at > now() - interval '1 hour'
      ) < 100
        AND (
          SELECT count(*)
          FROM verification_runs
          WHERE created_at > now() - interval '1 hour'
            AND creator_fingerprint = ${creatorFingerprint}
        ) < 20
      RETURNING id
    `,
    sqlClient`
      INSERT INTO scenario_resources (id, run_id, capacity, remaining)
      SELECT
        ${resourceId}::uuid,
        ${runId}::uuid,
        ${scenario.capacity},
        ${scenario.capacity}
      WHERE EXISTS (
        SELECT 1 FROM verification_runs WHERE id = ${runId}::uuid
      )
    `,
    sqlClient`
      INSERT INTO run_actors (id, run_id, actor_key, display_name)
      SELECT
        ${actorIds[0]}::uuid,
        ${runId}::uuid,
        ${scenario.actors[0]!.actorKey},
        ${scenario.actors[0]!.displayName}
      WHERE EXISTS (
        SELECT 1 FROM verification_runs WHERE id = ${runId}::uuid
      )
    `,
    sqlClient`
      INSERT INTO run_actors (id, run_id, actor_key, display_name)
      SELECT
        ${actorIds[1]}::uuid,
        ${runId}::uuid,
        ${scenario.actors[1]!.actorKey},
        ${scenario.actors[1]!.displayName}
      WHERE EXISTS (
        SELECT 1 FROM verification_runs WHERE id = ${runId}::uuid
      )
    `,
    sqlClient`
      INSERT INTO run_barriers (run_id, expected_count)
      SELECT ${runId}::uuid, ${scenario.actors.length}
      WHERE EXISTS (
        SELECT 1 FROM verification_runs WHERE id = ${runId}::uuid
      )
    `,
  ]);

  if ((insertedRuns as unknown[]).length === 0) {
    throw new RunCreationCapacityError();
  }

  const actors = scenario.actors.map((actor) => {
    const actorUrl = new URL("/lab/last-seat", baseUrl);
    actorUrl.searchParams.set("runId", runId);
    actorUrl.searchParams.set("actor", actor.actorKey);
    const token = createActorToken({
      runId,
      actorKey: actor.actorKey,
      expiresAt,
    });
    actorUrl.hash = `token=${encodeURIComponent(token)}`;

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
