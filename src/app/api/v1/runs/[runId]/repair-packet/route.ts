import { createRequestId, errorResponse, jsonResponse } from "@/lib/http/json";
import { isUuid } from "@/modules/actors/barrier";
import { getRunProof } from "@/modules/invariants/evaluate-run";
import {
  createRepairPacket,
  RepairPacketError,
  repairPacketMarkdown,
} from "@/modules/repair/repair-packet";

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
    return errorResponse(requestId, "invalid_run_id", "The run ID is invalid.", 400);
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

    const packet = createRepairPacket(proof);
    return jsonResponse(requestId, {
      packet,
      markdown: repairPacketMarkdown(packet),
    });
  } catch (error) {
    if (error instanceof RepairPacketError) {
      return errorResponse(requestId, error.code, error.message, 409);
    }

    console.error(
      JSON.stringify({
        event: "repair_packet_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "repair_packet_failed",
      "The repair packet could not be created.",
      500,
    );
  }
}
