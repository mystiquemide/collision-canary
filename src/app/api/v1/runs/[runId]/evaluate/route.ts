import { createRequestId, errorResponse, jsonResponse } from "@/lib/http/json";
import { evaluateRun } from "@/modules/invariants/evaluate-run";
import { isUuid } from "@/modules/actors/barrier";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  void request;
  const requestId = createRequestId();
  const { runId } = await context.params;

  if (!isUuid(runId)) {
    return errorResponse(
      requestId,
      "invalid_run_id",
      "The run ID is invalid.",
      400,
    );
  }

  try {
    const proof = await evaluateRun(runId);

    if (!proof) {
      return errorResponse(
        requestId,
        "run_not_found",
        "The verification run does not exist.",
        404,
      );
    }

    return jsonResponse(requestId, proof);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "run_evaluation_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "run_evaluation_failed",
      "The verification run could not be evaluated.",
      500,
    );
  }
}
