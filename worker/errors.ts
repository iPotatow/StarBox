export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function apiError(code: string, message: string, status = 400, details?: unknown) {
  return new Response(JSON.stringify({ error: { code, message, ...(details === undefined ? {} : { details }) } }), {
    status,
    headers,
  });
}

export function toErrorResponse(reason: unknown, fallbackCode = "internal_error", fallbackMessage = "请求失败") {
  if (reason instanceof AppError) return apiError(reason.code, reason.message, reason.status, reason.details);
  console.error("Unhandled StarBox Worker error", reason);
  return apiError(fallbackCode, fallbackMessage, 500);
}
