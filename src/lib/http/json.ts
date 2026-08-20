import { randomUUID } from "node:crypto";

export function createRequestId(): string {
  return `req_${randomUUID()}`;
}

export function jsonResponse(
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

export function errorResponse(
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
