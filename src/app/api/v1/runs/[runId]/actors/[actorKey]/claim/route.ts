import { createRequestId, errorResponse, jsonResponse } from "@/lib/http/json";
import {
  ActorAuthenticationError,
  authenticateActorRequest,
} from "@/modules/actors/actor-guards";
import { isActorKey, isUuid } from "@/modules/actors/barrier";
import { claimSeat, ClaimStateError } from "@/modules/claims/claim-service";

type RouteContext = {
  params: Promise<{ runId: string; actorKey: string }>;
};

function authStatus(error: ActorAuthenticationError): number {
  return error.code === "actor_scope_mismatch" ? 403 : 401;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = createRequestId();
  const { runId, actorKey } = await context.params;

  if (!isUuid(runId) || !isActorKey(actorKey)) {
    return errorResponse(
      requestId,
      "invalid_actor_route",
      "The run or actor route is invalid.",
      400,
    );
  }

  try {
    authenticateActorRequest(request, { runId, actorKey });
  } catch (error) {
    if (error instanceof ActorAuthenticationError) {
      return errorResponse(requestId, error.code, error.message, authStatus(error));
    }
    throw error;
  }

  try {
    const result = await claimSeat({ runId, actorKey });

    if (!result) {
      return errorResponse(
        requestId,
        "actor_not_found",
        "The actor does not belong to this run.",
        404,
      );
    }

    if (result.outcome === "rejected") {
      return jsonResponse(requestId, result, 409);
    }

    return jsonResponse(requestId, result, 200);
  } catch (error) {
    if (error instanceof ClaimStateError) {
      return errorResponse(requestId, error.code, error.message, 409);
    }

    console.error(
      JSON.stringify({
        event: "claim_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "claim_failed",
      "The seat claim could not be completed.",
      500,
    );
  }
}
