import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import {
  verifyRepairPacket,
  type RepairPacket,
} from "@/modules/repair/repair-packet";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function ensureInsideRepository(path: string): string {
  const repoRoot = resolve(process.cwd());
  const resolved = resolve(path);
  if (!resolved.startsWith(`${repoRoot}/`)) {
    throw new Error("Repair packet must be inside the repository.");
  }
  return resolved;
}

function repairPrompt(packet: RepairPacket): string {
  return [
    "You are repairing one verified Collision Canary backend failure.",
    "Work only in the repository backend paths listed below.",
    "Do not modify frontend files, documentation, environment files, or Git history.",
    "Run focused tests before reporting completion. Do not commit or push.",
    "",
    `Failed run: ${packet.failedRunId}`,
    `Invariant: ${packet.invariant.statement}`,
    `Reason: ${packet.observations.reasonCode}`,
    `Successful claims observed: ${packet.observations.successfulClaims}`,
    `Persisted successful claims: ${packet.observations.persistedClaims}`,
    "",
    "Allowed routes:",
    ...packet.repairTarget.routes.map((route) => `- ${route}`),
    "Allowed modules:",
    ...packet.repairTarget.modules.map((module) => `- ${module}`),
    "Acceptance criteria:",
    ...packet.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join("\n");
}

async function main(): Promise<void> {
  const packetPath = argument("--packet");
  if (!packetPath) throw new Error("--packet is required.");

  const packetFile = ensureInsideRepository(packetPath);
  const packet = JSON.parse(await readFile(packetFile, "utf8")) as RepairPacket;

  if (!verifyRepairPacket(packet)) {
    throw new Error("Repair packet hash validation failed.");
  }

  const prompt = repairPrompt(packet);
  const apply = process.argv.includes("--apply");

  if (!apply) {
    console.log(
      JSON.stringify({
        status: "dry_run",
        packetSha256: packet.packetSha256,
        allowedFiles: [...packet.repairTarget.routes, ...packet.repairTarget.modules],
        prompt,
      }),
    );
    return;
  }

  const child = spawn(
    "codex",
    ["exec", "--cd", process.cwd(), "--sandbox", "workspace-write", "--json", prompt],
    { stdio: "inherit" },
  );

  await new Promise<void>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Codex exited with code ${code ?? "unknown"}.`));
    });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
