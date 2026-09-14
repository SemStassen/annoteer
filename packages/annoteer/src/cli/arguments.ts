import { parseArgs } from "node:util";

export const help = `
  ↗ annoteer — client feedback, right where it belongs.

  annoteer init [--site URL] [--name NAME]
      Sign in to Cloudflare, deploy your feedback API, and create review links.
  annoteer deploy
      Update the Worker and apply migrations using existing credentials/state.
  annoteer invite [--role client|agency] [--days 30] [--label NAME]
      Create a private review link (client role by default).
  annoteer invites
      List invitation IDs and expiry dates.
  annoteer revoke INVITATION_ID
      Revoke a link and all sessions created from it.

  Options: --cwd DIR, --skip-login, --skip-install, --skip-deploy, --help
  init --skip-install --skip-deploy scaffolds without making network requests.
  Node.js 22.12+ required. Cloudflare login is for the agency only.
`;
/** Parses the CLI syntax without performing setup or deployment. */
export const parseArguments = () =>
  parseArgs({
    allowPositionals: true,
    options: {
      site: { type: "string" },
      name: { type: "string" },
      cwd: { type: "string" },
      role: { type: "string" },
      days: { type: "string" },
      label: { type: "string" },
      "skip-login": { type: "boolean" },
      "skip-install": { type: "boolean" },
      "skip-deploy": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
export type Arguments = ReturnType<typeof parseArguments>["values"];
