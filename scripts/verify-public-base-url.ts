import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main(): Promise<void> {
  const { PublicBaseUrlError, resolvePublicBaseUrl } = await import(
    "@/modules/runs/create-run"
  );
  const env = process.env as Record<string, string | undefined>;
  const original = {
    nodeEnv: env.NODE_ENV,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    vercelUrl: env.VERCEL_URL,
  };

  try {
    env.NODE_ENV = "production";
    delete env.NEXT_PUBLIC_APP_URL;
    delete env.VERCEL_URL;
    assert.throws(
      () => resolvePublicBaseUrl("https://attacker.example"),
      (error: unknown) =>
        error instanceof PublicBaseUrlError &&
        error.code === "public_base_url_unavailable",
    );

    env.NEXT_PUBLIC_APP_URL = "https://collision.example/app";
    assert.equal(
      resolvePublicBaseUrl("https://attacker.example"),
      "https://collision.example",
    );

    delete env.NEXT_PUBLIC_APP_URL;
    env.VERCEL_URL = "collision-canary.vercel.app";
    assert.equal(
      resolvePublicBaseUrl("https://attacker.example"),
      "https://collision-canary.vercel.app",
    );

    env.NODE_ENV = "development";
    delete env.VERCEL_URL;
    assert.equal(
      resolvePublicBaseUrl("http://localhost:3001/api/v1/runs"),
      "http://localhost:3001",
    );

    console.log(JSON.stringify({ status: "passed" }));
  } finally {
    if (original.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = original.nodeEnv;
    if (original.appUrl === undefined) delete env.NEXT_PUBLIC_APP_URL;
    else env.NEXT_PUBLIC_APP_URL = original.appUrl;
    if (original.vercelUrl === undefined) delete env.VERCEL_URL;
    else env.VERCEL_URL = original.vercelUrl;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
