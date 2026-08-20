import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
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

async function ensureInsideRepository(path: string): Promise<string> {
  const repoRoot = await realpath(process.cwd());
  const resolved = await realpath(resolve(path));
  if (!resolved.startsWith(`${repoRoot}/`)) {
    throw new Error("Repair packet must be inside the repository.");
  }
  return resolved;
}

type RepositoryState = {
  head: string;
  files: Map<string, string>;
};

function statusPaths(status: string): string[] {
  return status
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).trim();
      const renameSeparator = path.lastIndexOf(" -> ");
      return renameSeparator >= 0
        ? path.slice(renameSeparator + " -> ".length)
        : path;
    });
}

function fileDigest(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function repositoryState(): Promise<RepositoryState> {
  const { stdout: head } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
  });
  const { stdout: tracked } = await execFile("git", ["ls-files", "-z"], {
    cwd: process.cwd(),
  });
  const { stdout: status } = await execFile(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: process.cwd() },
  );

  const paths = new Set([
    ...tracked.split("\0").filter(Boolean),
    ...statusPaths(status),
  ]);
  const files = new Map<string, string>();

  await Promise.all(
    [...paths].map(async (path) => {
      try {
        files.set(path, fileDigest(await readFile(resolve(process.cwd(), path))));
      } catch {
        files.set(path, "<missing>");
      }
    }),
  );

  return { head: head.trim(), files };
}

function changedFiles(before: RepositoryState, after: RepositoryState): string[] {
  const paths = new Set([...before.files.keys(), ...after.files.keys()]);
  return [...paths].filter(
    (path) => before.files.get(path) !== after.files.get(path),
  );
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

  const packetFile = await ensureInsideRepository(packetPath);
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
  const unexpectedFiles = changedFiles(before, after).filter(
    (file) => !allowedFiles.has(file),
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
