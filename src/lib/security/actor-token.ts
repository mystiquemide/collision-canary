import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 60 * 60 * 1000;

type ActorTokenClaims = {
  runId: string;
  actorKey: string;
  expiresAt: number;
};

function getSigningSecret(): string {
  const secret = process.env.LAB_SIGNING_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("LAB_SIGNING_SECRET must contain at least 32 characters.");
  }

  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
}

export function createActorToken({
  runId,
  actorKey,
  expiresAt = Date.now() + TOKEN_TTL_MS,
}: Omit<ActorTokenClaims, "expiresAt"> & { expiresAt?: number }): string {
  const payload = [TOKEN_VERSION, runId, actorKey, String(expiresAt)].join(".");
  return `${payload}.${signPayload(payload)}`;
}

export function verifyActorToken(token: string): ActorTokenClaims {
  const [version, runId, actorKey, expiresAtText, signature] = token.split(".");

  if (!version || !runId || !actorKey || !expiresAtText || !signature) {
    throw new Error("Malformed actor token.");
  }

  if (version !== TOKEN_VERSION) {
    throw new Error("Unsupported actor token version.");
  }

  const payload = [version, runId, actorKey, expiresAtText].join(".");
  const expected = signPayload(payload);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    throw new Error("Invalid actor token signature.");
  }

  const expiresAt = Number(expiresAtText);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Actor token has expired.");
  }

  return { runId, actorKey, expiresAt };
}
