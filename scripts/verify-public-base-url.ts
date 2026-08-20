import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main(): Promise<void> {
  const {
    createRunFingerprint,
    PublicBaseUrlError,
    resolvePublicBaseUrl,
  } = await import("@/modules/runs/create-run");
  const env = process.env as Record<string, string | undefined>;
  const original = {
    nodeEnv: env.NODE_ENV,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    vercelUrl: env.VERCEL_URL,
    signingSecret: env.LAB_SIGNING_SECRET,
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

    env.LAB_SIGNING_SECRET = "test-signing-secret-with-at-least-32-bytes";
    const first = createRunFingerprint(
      new Request("https://app.example/api/v1/runs", {
        headers: { "x-forwarded-for": "198.51.100.8, 203.0.113.4" },
      }),
    );
    const sameClient = createRunFingerprint(
      new Request("https://app.example/api/v1/runs", {
        headers: { "x-forwarded-for": "192.0.2.9, 203.0.113.4" },
      }),
    );
    const otherClient = createRunFingerprint(
      new Request("https://app.example/api/v1/runs", {
        headers: { "x-forwarded-for": "203.0.113.5" },
      }),
    );
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(first, sameClient);
    assert.notEqual(first, otherClient);

    console.log(JSON.stringify({ status: "passed" }));
  } finally {
    if (original.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = original.nodeEnv;
    if (original.appUrl === undefined) delete env.NEXT_PUBLIC_APP_URL;
    else env.NEXT_PUBLIC_APP_URL = original.appUrl;
    if (original.vercelUrl === undefined) delete env.VERCEL_URL;
    else env.VERCEL_URL = original.vercelUrl;
    if (original.signingSecret === undefined) delete env.LAB_SIGNING_SECRET;
    else env.LAB_SIGNING_SECRET = original.signingSecret;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
