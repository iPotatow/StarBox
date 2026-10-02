import { AppError } from "./errors.js";

/** Keep untrusted upstream responses bounded, including chunked bodies. */
export async function fetchBounded(input: string | URL, init: RequestInit = {}, options: { timeoutMs?: number; maxBytes?: number } = {}) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const limit = options.maxBytes ?? 8 * 1024 * 1024;
  const failure = () => new AppError("upstream_timeout", "上游服务响应超时，请稍后重试", 504);
  let response: Response;
  try { response = await fetch(input, { ...init, signal }); }
  catch (reason) { if (timeout.aborted) throw failure(); throw reason; }
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new AppError("upstream_response_too_large", "上游响应超过大小限制", 502);
  }
  if (!response.body) return response;
  const reader = response.body.getReader(); let bytes = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (timeout.aborted) throw failure();
        const chunk = await reader.read();
        if (chunk.done) { controller.close(); reader.releaseLock(); return; }
        bytes += chunk.value.byteLength;
        if (bytes > limit) {
          await reader.cancel();
          throw new AppError("upstream_response_too_large", "上游响应超过大小限制", 502);
        }
        controller.enqueue(chunk.value);
      } catch (reason) { controller.error(timeout.aborted ? failure() : reason); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
}
