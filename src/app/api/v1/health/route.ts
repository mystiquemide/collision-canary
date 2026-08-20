import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { createRequestId, errorResponse, jsonResponse } from "@/lib/http/json";

export async function GET(): Promise<Response> {
  const requestId = createRequestId();

  try {
    await db.execute(sql`SELECT 1`);

    return jsonResponse(requestId, {
      status: "ready",
      database: "ready",
      version: "0.1.0",
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "health_check_failed",
        requestId,
        reason: error instanceof Error ? error.name : "unknown_error",
      }),
    );

    return errorResponse(
      requestId,
      "database_unavailable",
      "The database is not ready.",
      503,
    );
  }
}
