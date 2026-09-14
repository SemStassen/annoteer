import { resolve, join } from "node:path";
import { Effect } from "effect";
import { operation } from "./errors";
import { readJson, type Config } from "./project";
import { help, parseArguments } from "./arguments";
import { initialize } from "./commands/init";
import { deploy } from "./commands/deploy";
import { manageInvitations } from "./commands/invitations";

/** Routes parsed commands; importing this module never starts the CLI. */
export const program = Effect.gen(function* () {
  const { values, positionals } = yield* Effect.try(parseArguments);
  const action = positionals[0];
  if (!action || values.help) {
    console.log(help);
    return;
  }
  if (!["init", "deploy", "invite", "invites", "revoke"].includes(action))
    throw new Error(`Unknown command: ${action}. Run annoteer --help.`);
  const cwd = resolve(values.cwd ?? process.cwd());
  const dir = join(cwd, ".annoteer");
  if (action === "init" && !(yield* initialize(cwd, values))) return;
  const config = yield* operation(() => readJson<Config>(join(dir, "config.json")));
  const secrets = yield* operation(() =>
    readJson<{ adminToken: string }>(join(dir, "secrets.json")),
  );
  if (action === "init" || action === "deploy")
    return yield* deploy(cwd, values, action, config, secrets);
  yield* manageInvitations(dir, action, values, positionals, config, secrets);
});
