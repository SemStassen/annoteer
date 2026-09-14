#!/usr/bin/env node
import { Effect } from "effect";
import { program } from "./program";

Effect.runPromise(program).catch((error: unknown) => {
  console.error(`\n  Annoteer: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
