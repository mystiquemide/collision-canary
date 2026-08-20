import { createRequestId, errorResponse, jsonResponse } from "@/lib/http/json";
import {
  ActorAuthenticationError,
  authenticateActorRequest,
} from "@/modules/actors/actor-guards";
import {
  type BarrierSnapshot,
  isActorKey,
  isUuid,
  readActorBarrier,
} from "@/modules/actors/barrier";

type RouteContext = {
  params: Promise<{ runId: string; actorKey: string }>;
};

function authStatus(error: ActorAuthenticationError): number {
  return error.code === "actor_scope_mismatch" ? 403 : 401;
}

export async function GET(
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

  let snapshot: BarrierSnapshot | null;

  try {
    snapshot = await readActorBarrier({ runId, actorKey });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "barrier_read_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "barrier_read_failed",
      "The actor barrier could not be read.",
      500,
    );
  }

  if (!snapshot) {
    return errorResponse(
      requestId,
      "barrier_not_found",
      "The actor or run barrier does not exist.",
      404,
    );
  }

  return jsonResponse(requestId, snapshot);
}
