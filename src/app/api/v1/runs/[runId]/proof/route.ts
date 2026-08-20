import { createRequestId, errorResponse, jsonResponse } from "@/lib/http/json";
import { isUuid } from "@/modules/actors/barrier";
import { getRunProof } from "@/modules/invariants/evaluate-run";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(
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
    const proof = await getRunProof(runId);

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
        event: "proof_read_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "proof_read_failed",
      "The proof could not be read.",
      500,
    );
  }
}
