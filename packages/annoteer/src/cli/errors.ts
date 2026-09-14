import { Data, Effect } from "effect";

export class SetupError extends Data.TaggedError("SetupError")<{ message: string }> {}
export const operation = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new SetupError({ message: cause instanceof Error ? cause.message : String(cause) }),
  });
