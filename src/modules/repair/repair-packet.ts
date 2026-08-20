import { createHash } from "node:crypto";

import type { RunProof } from "@/modules/invariants/evaluate-run";

export class RepairPacketError extends Error {
  readonly code = "repair_packet_unavailable" as const;

  constructor(message: string) {
    super(message);
    this.name = "RepairPacketError";
  }
}

type RepairPacketBody = {
  schemaVersion: "1.0";
  failedRunId: string;
  scenarioKey: string;
  invariant: {
    key: string;
    statement: string;
  };
  observations: {
    actorOutcomes: Array<{
      actorKey: string;
      status: string;
      outcomeCode: string | null;
    }>;
    capacity: number;
    remaining: number;
    successfulClaims: number;
    persistedClaims: number;
    reasonCode: string;
  };
  repairTarget: {
    routes: string[];
    modules: string[];
  };
  acceptanceCriteria: string[];
  proofScope: string;
};

export type RepairPacket = RepairPacketBody & {
  packetSha256: string;
};

const REPAIR_TARGET = {
  routes: [
    "src/app/api/v1/runs/[runId]/actors/[actorKey]/claim/route.ts",
  ],
  modules: ["src/modules/claims/claim-service.ts"],
} as const;

const ACCEPTANCE_CRITERIA = [
  "At most one actor receives a successful claim outcome for capacity one.",
  "The persisted successful claim count matches the visible successful outcome count.",
  "A losing actor receives the stable seat_unavailable outcome.",
  "The same paired browser proof can rerun and produce a satisfied invariant.",
] as const;

const PROOF_SCOPE =
  "Application and database observations for one run. Kane browser evidence is attached by the local verification runner.";

const ACTOR_STATUSES = [
  "created",
  "armed",
  "released",
  "claiming",
  "succeeded",
  "rejected",
  "errored",
] as const;

const OUTCOME_CODES = ["seat_claimed", "seat_unavailable", null] as const;

const REASON_CODES = [
  "observation_conflict",
  "non_linearizable_outcome",
  "capacity_invariant_violated",
] as const;

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

function packetHash(body: RepairPacketBody): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

export function createRepairPacket(proof: RunProof): RepairPacket {
  if (proof.evaluation?.verdict !== "violated") {
    throw new RepairPacketError(
      "A repair packet requires a proof with a violated invariant.",
    );
  }

  const body: RepairPacketBody = {
    schemaVersion: "1.0",
    failedRunId: proof.run.id,
    scenarioKey: proof.run.scenarioKey,
    invariant: proof.invariant,
    observations: {
      actorOutcomes: proof.actors.map((actor) => ({
        actorKey: actor.actorKey,
        status: actor.status,
        outcomeCode: actor.outcomeCode,
      })),
      capacity: proof.resource?.capacity ?? -1,
      remaining: proof.evaluation.finalRemaining,
      successfulClaims: proof.evaluation.successfulClaims,
      persistedClaims: proof.evaluation.persistedClaims,
      reasonCode: proof.evaluation.reasonCode,
    },
    repairTarget: {
      routes: [...REPAIR_TARGET.routes],
      modules: [...REPAIR_TARGET.modules],
    },
    acceptanceCriteria: [...ACCEPTANCE_CRITERIA],
    proofScope: PROOF_SCOPE,
  };

  return { ...body, packetSha256: packetHash(body) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isExactStringArray(
  value: unknown,
  expected: readonly string[],
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function verifyRepairPacket(packet: unknown): packet is RepairPacket {
  if (!isRecord(packet)) return false;

  const { packetSha256, ...body } = packet;
  if (
    typeof packetSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(packetSha256) ||
    body.schemaVersion !== "1.0" ||
    body.scenarioKey !== "last-seat-v1"
  ) {
    return false;
  }

  if (
    typeof body.failedRunId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.failedRunId,
    ) ||
    !isRecord(body.invariant) ||
    body.invariant.key !== "capacity-at-most-one-v1" ||
    body.invariant.statement !== "At most one actor can claim the final seat." ||
    !isRecord(body.observations) ||
    !isExactStringArray(body.repairTarget && isRecord(body.repairTarget) ? body.repairTarget.routes : undefined, REPAIR_TARGET.routes) ||
    !isExactStringArray(body.repairTarget && isRecord(body.repairTarget) ? body.repairTarget.modules : undefined, REPAIR_TARGET.modules) ||
    !isExactStringArray(body.acceptanceCriteria, ACCEPTANCE_CRITERIA)
  ) {
    return false;
  }

  const observations = body.observations;
  const actorOutcomes = observations.actorOutcomes;
  if (!Array.isArray(actorOutcomes) || actorOutcomes.length !== 2) {
    return false;
  }

  const actorKeys = new Set<string>();
  for (const actor of actorOutcomes) {
    if (!isRecord(actor)) return false;
    if (
      typeof actor.actorKey !== "string" ||
      actorKeys.has(actor.actorKey) ||
      !["alice", "bob"].includes(actor.actorKey) ||
      typeof actor.status !== "string" ||
      !ACTOR_STATUSES.includes(
        actor.status as (typeof ACTOR_STATUSES)[number],
      ) ||
      (actor.outcomeCode !== null &&
        !OUTCOME_CODES.includes(
          actor.outcomeCode as (typeof OUTCOME_CODES)[number],
        ))
    ) {
      return false;
    }
    actorKeys.add(actor.actorKey);
  }

  if (
    actorKeys.size !== 2 ||
    !actorKeys.has("alice") ||
    !actorKeys.has("bob") ||
    !isSafeInteger(observations.capacity) ||
    !isSafeInteger(observations.remaining) ||
    !isSafeInteger(observations.successfulClaims) ||
    !isSafeInteger(observations.persistedClaims) ||
    typeof observations.reasonCode !== "string" ||
    !REASON_CODES.includes(
      observations.reasonCode as (typeof REASON_CODES)[number],
    ) ||
    body.proofScope !== PROOF_SCOPE
  ) {
    return false;
  }

  return packetSha256 === packetHash(body as RepairPacketBody);
}

export function repairPacketMarkdown(packet: RepairPacket): string {
  const actorLines = packet.observations.actorOutcomes
    .map(
      (actor) =>
        `- ${actor.actorKey}: ${actor.status} (${actor.outcomeCode ?? "no outcome code"})`,
    )
    .join("\n");
  const criteria = packet.acceptanceCriteria
    .map((criterion) => `- [ ] ${criterion}`)
    .join("\n");

  return `# Collision Canary repair packet

Run: \`${packet.failedRunId}\`
Scenario: \`${packet.scenarioKey}\`
Invariant: ${packet.invariant.statement}
Reason: \`${packet.observations.reasonCode}\`

## Observed outcomes

${actorLines}

- Capacity: ${packet.observations.capacity}
- Remaining: ${packet.observations.remaining}
- Successful claims: ${packet.observations.successfulClaims}
- Persisted claims: ${packet.observations.persistedClaims}

## Repair target

Routes:

${packet.repairTarget.routes.map((route) => `- \`${route}\``).join("\n")}

Modules:

${packet.repairTarget.modules.map((module) => `- \`${module}\``).join("\n")}

## Acceptance criteria

${criteria}

## Scope

${packet.proofScope}

Packet SHA-256: \`${packet.packetSha256}\`
`;
}
