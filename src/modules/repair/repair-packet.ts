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
      routes: [
        "src/app/api/v1/runs/[runId]/actors/[actorKey]/claim/route.ts",
      ],
      modules: ["src/modules/claims/claim-service.ts"],
    },
    acceptanceCriteria: [
      "At most one actor receives a successful claim outcome for capacity one.",
      "The persisted successful claim count matches the visible successful outcome count.",
      "A losing actor receives the stable seat_unavailable outcome.",
      "The same paired browser proof can rerun and produce a satisfied invariant.",
    ],
    proofScope:
      "Application and database observations for one run. Kane browser evidence is attached by the local verification runner.",
  };

  return { ...body, packetSha256: packetHash(body) };
}

export function verifyRepairPacket(packet: RepairPacket): boolean {
  const { packetSha256, ...body } = packet;
  return packetSha256 === packetHash(body);
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
