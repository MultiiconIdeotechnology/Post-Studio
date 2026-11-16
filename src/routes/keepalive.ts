import type { FastifyReply } from "fastify";

// Long jobs (image models, Claude designs) can take longer than Cloudflare's 100-second limit
// for a response to start. So they answer 200 at once, send a space every 10 seconds (leading
// whitespace is valid JSON), then the result. Failures arrive as {"error": ...} in the 200 body.
export async function keepAlive(reply: FastifyReply, work: () => Promise<unknown>, errorCode = "generation_failed") {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" });
  res.write(" ");
  const timer = setInterval(() => res.write(" "), 10_000);
  let out: unknown;
  try {
    out = await work();
  } catch (e) {
    out = { error: errorCode, message: (e as Error).message };
  } finally {
    clearInterval(timer);
  }
  res.end(JSON.stringify(out));
}
