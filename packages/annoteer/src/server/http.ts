import { Effect, Schema } from "effect";
import { ApiError, fail } from "./errors";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const decode = <A, I>(schema: Schema.Schema<A, I>, input: unknown) =>
  Schema.decodeUnknown(schema)(input).pipe(
    Effect.mapError(() => fail(400, "Invalid request fields.")),
  );
export const readBody = (request: Request) =>
  Effect.tryPromise({
    try: async () => {
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw fail(415, "Expected application/json.");
      const reader = request.body?.getReader();
      if (!reader) throw fail(400, "Expected a JSON body.");
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) {
          await reader.cancel();
          throw fail(413, "Request is too large.");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    },
    catch: (error) => (error instanceof ApiError ? error : fail(400, "Invalid JSON body.")),
  });
