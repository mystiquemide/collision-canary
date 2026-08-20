import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

import {
  linkRepairCycle,
  RepairCycleLinkError,
} from "@/modules/repair/link-repair-cycle";
import { verifyRepairPacket } from "@/modules/repair/repair-packet";

config({ path: ".env.local" });

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function packetPathInsideRepository(path: string): Promise<string> {
  const repository = await realpath(process.cwd());
  const packetPath = await realpath(resolve(path));
  if (!packetPath.startsWith(`${repository}/`)) {
    throw new Error("The repair packet must be inside the repository.");
  }
  return packetPath;
}

async function main(): Promise<void> {
  const failedRunId = argument("--failed-run");
  const verifiedRunId = argument("--verified-run");
  const packetFile = await packetPathInsideRepository(argument("--packet"));
  const packet = JSON.parse(await readFile(packetFile, "utf8")) as unknown;

  if (!verifyRepairPacket(packet)) {
    throw new Error("The repair packet is invalid or its hash does not match.");
  }

  if (packet.failedRunId !== failedRunId) {
    throw new Error("The packet does not belong to the failed run.");
  }

  const cycle = await linkRepairCycle({
    failedRunId,
    verifiedRunId,
    packetSha256: packet.packetSha256,
  });

  console.log(JSON.stringify({ status: "linked", cycle }));
}

main().catch((error: unknown) => {
  if (error instanceof RepairCycleLinkError) {
    console.error(JSON.stringify({ code: error.code, message: error.message }));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
