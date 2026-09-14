import { test, expect } from "@playwright/test";

test("client annotates text and elements; agency replies and resolves; positions survive layout changes", async ({
  browser,
  page,
}) => {
  const headline = `Give the headline more breathing room. ${Date.now()}`;
  const copy = `Could we make this copy more specific? ${Date.now()}`;
  await page.goto("/");
  const links = (await (await page.request.get("/__annoteer_demo")).json()) as {
    client: string;
    agency: string;
  };
  await page.goto(links.client);
  await page.getByLabel("Your name").fill("Alex Client");
  await page.getByRole("button", { name: "Start reviewing" }).click();
  await expect(page.getByRole("button", { name: "+ Add feedback" }).first()).toBeVisible();
  expect(page.url()).not.toContain("annoteer=");
  await page.getByRole("button", { name: "+ Add feedback" }).first().click();
  await page.locator('[data-annoteer-id="hero-title"]').click();
  await page.getByLabel("What would you change?").fill(headline);
  await page.getByRole("button", { name: "Add feedback ↗", exact: true }).click();
  await expect(page.getByText(headline, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Add feedback" }).first().click();
  await page.locator('[data-annoteer-id="hero-description"]').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByLabel("What would you change?").fill(copy);
  await page.getByRole("button", { name: "Add feedback ↗", exact: true }).click();
  await expect(page.getByText(copy, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /\d+ open/ }).click();
  await page.getByText(headline, { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Mark as resolved" })).toHaveCount(0);
  const agencyContext = await browser.newContext();
  const agency = await agencyContext.newPage();
  await agency.goto(links.agency);
  await agency.getByLabel("Your name").fill("Sam Agency");
  await agency.getByRole("button", { name: "Start reviewing" }).click();
  await agency.getByText(headline, { exact: true }).first().click();
  await agency.getByLabel("Keep the conversation going").fill("Updated. Thanks for catching this!");
  await agency.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByText("Updated. Thanks for catching this!", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await agency.getByRole("button", { name: "Mark as resolved" }).click();
  await expect(agency.getByRole("button", { name: "Reopen feedback" })).toBeVisible();
  await agency.getByRole("button", { name: "Reopen feedback" }).click();
  await agency.getByRole("button", { name: "Close feedback" }).click();
  const pin = agency.getByRole("button", { name: "Open feedback 1", exact: true });
  const before = await pin.boundingBox();
  await agency.evaluate(() => {
    document.querySelector<HTMLElement>(".hero")!.style.paddingTop = "110px";
  });
  await expect.poll(async () => (await pin.boundingBox())?.y).not.toBe(before?.y);
  await agency.locator('[data-annoteer-id="hero-title"]').evaluate((element) => element.remove());
  await agency.getByRole("button", { name: /\d+ open/ }).click();
  await agency.getByText(headline, { exact: true }).first().click();
  await expect(agency.getByText("Target changed or is currently hidden.")).toBeVisible();
  await agencyContext.close();
});

test("widget stays hidden for ordinary visitors and never selects private fields", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "+ Add feedback" })).toHaveCount(0);
  const links = (await (await page.request.get("/__annoteer_demo")).json()) as { client: string };
  await page.goto(links.client);
  await page.getByLabel("Your name").fill("Private Area Tester");
  await page.getByRole("button", { name: "Start reviewing" }).click();
  await page.getByRole("button", { name: "+ Add feedback" }).first().click();
  await page.locator(".demo-strip > span").first().click();
  await expect(page.getByLabel("What would you change?")).toHaveCount(0);
  await page.keyboard.press("Escape");
});
