import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import {
  verifyRepairPacket,
  type RepairPacket,
} from "@/modules/repair/repair-packet";

const execFile = promisify(execFileCallback);

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

async function repositoryState(): Promise<{ head: string; files: Set<string> }> {
  const { stdout: head } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
  });
  const { stdout: status } = await execFile(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: process.cwd() },
  );
  const files = new Set(
    status
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const path = line.slice(3).trim();
        return path.includes(" -> ") ? path.split(" -> ").at(-1)! : path;
      }),
  );
  return { head: head.trim(), files };
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

  const before = await repositoryState();
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

  const after = await repositoryState();
  if (after.head !== before.head) {
    throw new Error("Codex changed Git history. Repair adapter refuses to continue.");
  }

  const allowedFiles = new Set([
    ...packet.repairTarget.routes,
    ...packet.repairTarget.modules,
  ]);
  const unexpectedFiles = [...after.files].filter(
    (file) => !before.files.has(file) && !allowedFiles.has(file),
  );

  if (unexpectedFiles.length > 0) {
    throw new Error(
      `Codex changed files outside the repair packet: ${unexpectedFiles.join(", ")}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
