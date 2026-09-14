import { join } from "node:path";
import { Effect } from "effect";
import { operation } from "../errors";
import { readJson, reviewLink, type Config } from "../project";
import { adminRequest } from "../admin-api";
import type { Arguments } from "../arguments";

/** Creates, lists, or revokes invitations against an existing deployment. */
export const manageInvitations = (
  dir: string,
  action: string,
  values: Arguments,
  positionals: string[],
  config: Config,
  secrets: { adminToken: string },
) =>
  Effect.gen(function* () {
    const { endpoint } = yield* operation(() =>
      readJson<{ endpoint: string }>(join(dir, "output.json")),
    );
    if (action === "invite") {
      const role = values.role ?? "client";
      const days = Number(values.days ?? 30);
      if (!["client", "agency"].includes(role) || !Number.isInteger(days) || days < 1 || days > 90)
        throw new Error("Use --role client|agency and --days between 1 and 90.");
      const invite = yield* adminRequest<{ id: string; token: string }>(
        endpoint,
        secrets.adminToken,
        "/admin/invitations",
        { role, days, label: values.label ?? `${role} review` },
      );
      console.log(`\n  Invitation: ${invite.id}\n  ${reviewLink(config.site, invite.token)}\n`);
    } else if (action === "invites")
      console.table(yield* adminRequest(endpoint, secrets.adminToken, "/admin/invitations"));
    else if (action === "revoke") {
      if (!positionals[1] || !/^[\w-]+$/.test(positionals[1]))
        throw new Error("Provide an invitation ID from annoteer invites.");
      yield* adminRequest(
        endpoint,
        secrets.adminToken,
        `/admin/invitations/${positionals[1]}`,
        undefined,
        "DELETE",
      );
      console.log("  ✓ Invitation and its sessions revoked.");
    }
  });
