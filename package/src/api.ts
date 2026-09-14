import { Data, Effect } from "effect";
export class RequestError extends Data.TaggedError("RequestError")<{
  message: string;
  status: number;
}> {}
export function request<T>(
  endpoint: string,
  path: string,
  token?: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  return Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${endpoint.replace(/\/$/, "")}${path}`, {
          method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(body !== undefined && method !== "GET" ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(15000),
        });
        const result = (await response.json()) as T & { error?: string };
        if (!response.ok)
          throw new RequestError({
            message: result.error ?? "Request failed.",
            status: response.status,
          });
        return result;
      },
      catch: (error) =>
        error instanceof RequestError
          ? error
          : new RequestError({
              message: "Could not reach Annoteer. Check your connection and try again.",
              status: 0,
            }),
    }).pipe(
      Effect.catchAll((error) => Effect.promise(() => Promise.reject(new Error(error.message)))),
    ),
  );
}
