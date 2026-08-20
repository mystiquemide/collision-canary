import { randomUUID } from "node:crypto";

import { createVerificationRun, SCENARIOS, type ScenarioKey } from "@/modules/runs/create-run";

type CreateRunBody = {
  scenarioKey?: unknown;
  invariantKey?: unknown;
};

function jsonResponse(
  requestId: string,
  data: unknown,
  status = 200,
): Response {
  return Response.json(
    {
      data,
      error: null,
      requestId,
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function errorResponse(
  requestId: string,
  code: string,
  message: string,
  status: number,
): Response {
  return Response.json(
    {
      data: null,
      error: { code, message },
      requestId,
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function isCreateRunBody(value: unknown): value is CreateRunBody {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${randomUUID()}`;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      requestId,
      "invalid_json",
      "Request body must be valid JSON.",
      400,
    );
  }

  if (
    !isCreateRunBody(body) ||
    typeof body.scenarioKey !== "string" ||
    typeof body.invariantKey !== "string"
  ) {
    return errorResponse(
      requestId,
      "invalid_request",
      "scenarioKey and invariantKey are required.",
      400,
    );
  }

  if (
    !(body.scenarioKey in SCENARIOS) ||
    SCENARIOS[body.scenarioKey as ScenarioKey].invariantKey !== body.invariantKey
  ) {
    return errorResponse(
      requestId,
      "unsupported_scenario",
      "The requested scenario is not available.",
      400,
    );
  }

  try {
    const data = await createVerificationRun({
      scenarioKey: body.scenarioKey as ScenarioKey,
      baseUrl: new URL(request.url).origin,
    });

    return jsonResponse(requestId, data, 201);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "run_creation_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "run_creation_failed",
      "The verification run could not be created.",
      500,
    );
  }
}
