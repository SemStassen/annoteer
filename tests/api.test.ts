import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { Miniflare } from "miniflare";
import { readFile } from "node:fs/promises";

const admin = "a".repeat(64);
let mf: Miniflare;
const call = (
  path: string,
  token?: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  origin = "http://127.0.0.1:5173",
) =>
  mf.dispatchFetch(`http://localhost${path}`, {
    method,
    headers: {
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
async function invite(role = "client") {
  const response = await call("/admin/invitations", admin, {
    role,
    label: "Test review",
    days: 30,
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; token: string };
}
async function session(token: string, name = "Client") {
  const response = await call("/sessions", undefined, { token, name });
  expect(response.status).toBe(201);
  return (await response.json()) as { token: string; role: string };
}
const annotation = {
  path: "/",
  deployment: "test",
  body: "Give this headline more space.",
  anchor: { kind: "element", selector: "#hero", tag: "h1", label: "Hello" },
};
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    scriptPath: "package/template/worker/index.js",
    compatibilityDate: "2026-07-01",
    d1Databases: ["DB"],
    bindings: { ADMIN_TOKEN: admin, ALLOWED_ORIGINS: "http://127.0.0.1:5173" },
  });
  const db = await mf.getD1Database("DB");
  for (const sql of (await readFile("worker/migrations/0001_initial.sql", "utf8"))
    .split(";")
    .filter((part) => part.trim()))
    await db.prepare(sql).run();
});
afterAll(async () => {
  await mf?.dispose();
});
describe("review API against real local D1", () => {
  it("checks health and denies anonymous or disallowed access", async () => {
    expect((await call("/health")).status).toBe(200);
    expect((await call("/annotations")).status).toBe(401);
    expect(
      (await call("/annotations", undefined, undefined, "GET", "https://attacker.example")).status,
    ).toBe(403);
    const options = await call("/annotations", undefined, undefined, "OPTIONS");
    expect(options.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect((await call("/admin/invitations")).status).toBe(401);
  });
  it("shares annotations and replies, limits resolving to the agency, and scopes deployments", async () => {
    const client = await session((await invite()).token);
    const agency = await session((await invite("agency")).token, "Agency");
    const created = await call("/annotations", client.token, annotation);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(
      (await call(`/annotations/${id}`, client.token, { status: "resolved" }, "PATCH")).status,
    ).toBe(403);
    expect(
      (await call(`/annotations/${id}/replies`, agency.token, { body: "On it!" })).status,
    ).toBe(201);
    const list = (await (
      await call("/annotations?deployment=test&path=%2F", client.token)
    ).json()) as { id: string; replies: { body: string }[] }[];
    expect(list.find((item) => item.id === id)?.replies[0].body).toBe("On it!");
    expect(await (await call("/annotations?deployment=other", client.token)).json()).toEqual([]);
    expect(
      await (await call("/annotations?deployment=test&path=%2Fother", client.token)).json(),
    ).toEqual([]);
    expect(
      (await call(`/annotations/${id}`, agency.token, { status: "resolved" }, "PATCH")).status,
    ).toBe(200);
    expect(
      (await call(`/annotations/${id}`, agency.token, { status: "open" }, "PATCH")).status,
    ).toBe(200);
  });
  it("revokes existing sessions and stores only token hashes", async () => {
    const invitation = await invite();
    const client = await session(invitation.token);
    const db = await mf.getD1Database("DB");
    const stored = await db
      .prepare("SELECT token_hash FROM invitations WHERE id = ?")
      .bind(invitation.id)
      .first<{ token_hash: string }>();
    expect(stored?.token_hash).not.toBe(invitation.token);
    expect(
      (await call(`/admin/invitations/${invitation.id}`, admin, undefined, "DELETE")).status,
    ).toBe(200);
    expect((await call("/annotations", client.token)).status).toBe(401);
    expect(
      (await call("/sessions", undefined, { token: invitation.token, name: "Client" })).status,
    ).toBe(401);
  });
  it("rejects expired invitations, invalid payloads, oversized input and forged roles", async () => {
    const invitation = await invite();
    const client = await session(invitation.token);
    expect((await call("/annotations", client.token, { ...annotation, body: "  " })).status).toBe(
      400,
    );
    expect(
      (await call("/annotations", client.token, { ...annotation, path: "//evil.example" })).status,
    ).toBe(400);
    expect(
      (await call("/annotations", client.token, { ...annotation, body: "x".repeat(40000) })).status,
    ).toBe(413);
    const forged = await call("/sessions", undefined, {
      token: invitation.token,
      name: "Sneaky",
      role: "agency",
    });
    expect(((await forged.json()) as { role: string }).role).toBe("client");
    const db = await mf.getD1Database("DB");
    await db
      .prepare("UPDATE invitations SET expires_at = 0 WHERE id = ?")
      .bind(invitation.id)
      .run();
    expect(
      (await call("/sessions", undefined, { token: invitation.token, name: "Client" })).status,
    ).toBe(401);
    expect((await call("/session", client.token)).status).toBe(401);
  });
});
