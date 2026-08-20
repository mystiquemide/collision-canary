import {
  createRequestId,
  errorResponse,
  jsonResponse,
} from "@/lib/http/json";
import {
  createRunFingerprint,
  createVerificationRun,
  PublicBaseUrlError,
  RunCreationCapacityError,
  SCENARIOS,
  type ScenarioKey,
  resolvePublicBaseUrl,
} from "@/modules/runs/create-run";
import { listRuns } from "@/modules/runs/list-runs";

type CreateRunBody = {
  scenarioKey?: unknown;
  invariantKey?: unknown;
};

function isCreateRunBody(value: unknown): value is CreateRunBody {
  return typeof value === "object" && value !== null;
}

export async function GET(): Promise<Response> {
  const requestId = createRequestId();

  try {
    const runs = await listRuns(50);
    return jsonResponse(requestId, { runs });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "run_list_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "run_list_failed",
      "The verification runs could not be listed.",
      500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
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
      baseUrl: resolvePublicBaseUrl(request.url),
      creatorFingerprint: createRunFingerprint(request),
    });

    return jsonResponse(requestId, data, 201);
  } catch (error) {
    if (error instanceof RunCreationCapacityError) {
      return errorResponse(requestId, error.code, error.message, 429);
    }

    if (error instanceof PublicBaseUrlError) {
      return errorResponse(requestId, error.code, error.message, 500);
    }

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
