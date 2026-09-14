import { Data, Effect } from "effect";

export class ApiError extends Data.TaggedError("ApiError")<{ status: number; message: string }> {}
export const fail = (status: number, message: string) => new ApiError({ status, message });
export const attempt = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({
    try: run,
    catch: () => fail(500, "Unable to complete the request. Please try again."),
  });
