import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { actorStatus, runActors, type RunActor } from "@/db/schema";
import { verifyActorToken, type ActorTokenClaims } from "@/lib/security/actor-token";

export type ActorStatus = (typeof actorStatus.enumValues)[number];

const allowedTransitions: Record<ActorStatus, readonly ActorStatus[]> = {
  created: ["armed"],
  armed: ["released"],
  released: ["claiming"],
  claiming: ["succeeded", "rejected", "errored"],
  succeeded: [],
  rejected: [],
  errored: [],
};

export class ActorAuthenticationError extends Error {
  readonly code: "missing_bearer_token" | "invalid_actor_token" | "actor_scope_mismatch";

  constructor(
    code:
      | "missing_bearer_token"
      | "invalid_actor_token"
      | "actor_scope_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "ActorAuthenticationError";
    this.code = code;
  }
}

export class ActorStateTransitionError extends Error {
  readonly code = "invalid_actor_transition" as const;

  constructor(message: string) {
    super(message);
    this.name = "ActorStateTransitionError";
  }
}

export function assertActorTransition(
  from: ActorStatus,
  to: ActorStatus,
): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new ActorStateTransitionError(
      `Actor cannot transition from ${from} to ${to}.`,
    );
  }
}

export function authenticateActorRequest(
  request: Request,
  expected: Pick<ActorTokenClaims, "runId" | "actorKey">,
): ActorTokenClaims {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new ActorAuthenticationError(
      "missing_bearer_token",
      "A bearer actor token is required.",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new ActorAuthenticationError(
      "missing_bearer_token",
      "A bearer actor token is required.",
    );
  }

  let claims: ActorTokenClaims;

  try {
    claims = verifyActorToken(token);
  } catch {
    throw new ActorAuthenticationError(
      "invalid_actor_token",
      "The actor token is invalid or expired.",
    );
  }

  if (claims.runId !== expected.runId || claims.actorKey !== expected.actorKey) {
    throw new ActorAuthenticationError(
      "actor_scope_mismatch",
      "The actor token is not scoped to this run and actor.",
    );
  }

  return claims;
}

export async function transitionActor({
  actorId,
  from,
  to,
  at = new Date(),
}: {
  actorId: string;
  from: ActorStatus;
  to: ActorStatus;
  at?: Date;
}): Promise<RunActor> {
  assertActorTransition(from, to);

  const updates: Partial<typeof runActors.$inferInsert> = {
    status: to,
  };

  if (to === "armed") updates.armedAt = at;
  if (to === "claiming") updates.requestAt = at;
  if (to === "succeeded" || to === "rejected" || to === "errored") {
    updates.completedAt = at;
  }

  const [updated] = await db
    .update(runActors)
    .set(updates)
    .where(and(eq(runActors.id, actorId), eq(runActors.status, from)))
    .returning();

  if (!updated) {
    throw new ActorStateTransitionError(
      `Actor ${actorId} was not in expected state ${from}.`,
    );
  }

  return updated;
}
