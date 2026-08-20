import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  const [{ getRunProof }, packetModule] = await Promise.all([
    import("@/modules/invariants/evaluate-run"),
    import("@/modules/repair/repair-packet"),
  ]);
  const runId = argument("--run");
  const outputDir = resolve(argument("--out"));
  const proof = await getRunProof(runId);

  if (!proof) throw new Error("The requested run does not exist.");

  const packet = packetModule.createRepairPacket(proof);
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    resolve(outputDir, "repair-packet.json"),
    `${JSON.stringify(packet, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(outputDir, "repair-packet.md"),
    packetModule.repairPacketMarkdown(packet),
    "utf8",
  );

  console.log(
    JSON.stringify({
      status: "written",
      runId,
      outputDir,
      packetSha256: packet.packetSha256,
      files: ["repair-packet.json", "repair-packet.md"],
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
