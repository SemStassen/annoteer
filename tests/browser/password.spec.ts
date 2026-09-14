import { test, expect } from "@playwright/test";
import { Miniflare } from "miniflare";
import { hash } from "bcryptjs";
import { readFile, readdir } from "node:fs/promises";

test("client enters a password before reviewing; agency entry needs no password", async ({
  page,
}) => {
  const password = "client-browser-password";
  const admin = "c".repeat(64);
  const mf = new Miniflare({
    modules: true,
    scriptPath: "packages/annoteer/template/worker/index.js",
    compatibilityDate: "2026-07-01",
    d1Databases: ["DB"],
    bindings: {
      ADMIN_TOKEN: admin,
      ALLOWED_ORIGINS: "http://127.0.0.1:5173",
      REVIEW_PASSWORD_HASH: await hash(password, 10),
      REVIEW_PASSWORD_VERSION: "browser-password-policy",
    },
  });
  try {
    const db = await mf.getD1Database("DB");
    for (const file of (await readdir("packages/annoteer/infrastructure/migrations")).sort()) {
      for (const sql of (
        await readFile(`packages/annoteer/infrastructure/migrations/${file}`, "utf8")
      )
        .split(";")
        .filter((part) => part.trim()))
        await db.prepare(sql).run();
    }
    const origin = (await mf.ready).origin;
    await page.route("http://127.0.0.1:8787/**", async (route) => {
      const response = await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:8787", origin),
      });
      await route.fulfill({ response });
    });
    const invitation = async (role: string) => {
      const response = await mf.dispatchFetch("http://localhost/admin/invitations", {
        method: "POST",
        headers: { authorization: `Bearer ${admin}`, "content-type": "application/json" },
        body: JSON.stringify({ role, label: "Browser test", days: 1 }),
      });
      expect(response.status).toBe(201);
      return ((await response.json()) as { token: string }).token;
    };
    await page.goto(`/#annoteer=${await invitation("client")}`);
    await page.getByLabel("Your name").fill("Client");
    await expect(page.getByLabel("Review password")).toHaveAttribute("type", "password");
    await page.getByLabel("Review password").fill("incorrect-password");
    await page.getByRole("button", { name: "Start reviewing" }).click();
    await expect(page.getByText("Incorrect review password. Please try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add feedback" })).toHaveCount(0);
    await page.getByLabel("Review password").fill(password);
    await page.getByRole("button", { name: "Start reviewing" }).click();
    await expect(page.getByRole("button", { name: "+ Add feedback" }).first()).toBeVisible();
    expect(
      await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage })),
    ).not.toContain(password);
    await page.goto(`/#annoteer=${await invitation("agency")}`);
    await page.getByLabel("Your name").fill("Agency");
    await expect(page.getByRole("button", { name: "Start reviewing" })).toBeEnabled();
    await expect(page.getByLabel("Review password")).toHaveCount(0);
    await page.getByRole("button", { name: "Start reviewing" }).click();
    await expect(page.getByRole("button", { name: "+ Add feedback" }).first()).toBeVisible();
  } finally {
    await mf.dispose();
  }
});
