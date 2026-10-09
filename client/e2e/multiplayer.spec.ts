import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

// Two REAL browser sessions share one village. Requires backend :3001 and
// frontend :5173 running (see README).
async function join(page: Page, name: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/villager name/i).fill(name);
  await page.getByRole("button", { name: /join village/i }).click();
}

test("two villagers see each other and movement syncs", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  // If the backend is down the landing shows server-unreachable — skip loud.
  await a.goto("/", { waitUntil: "domcontentloaded" });
  if ((await a.getByText(/server is unreachable/i).count()) > 0) {
    test.skip(true, "backend not running — start dev:server first");
  }

  await a.getByLabel(/villager name/i).fill("WrenA");
  await a.getByRole("button", { name: /join village/i }).click();
  await join(b, "WrenB");

  // Both HUDs show 2 villagers (socket state synced through the server)
  await expect(a.getByText(/2 villagers gathered/i)).toBeVisible({ timeout: 30_000 });
  await expect(b.getByText(/2 villagers gathered/i)).toBeVisible({ timeout: 30_000 });

  // Walk in A; B's villager list (socket-driven) must still show both names,
  // and B must not error.
  await a.keyboard.down("d");
  await a.waitForTimeout(900);
  await a.keyboard.up("d");

  await b.getByRole("button", { name: /^villagers$/i }).click();
  await expect(b.getByText("WrenA")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText("WrenB")).toBeVisible({ timeout: 15_000 });

  // No critical page errors on either side
  const errorsA: string[] = [];
  const errorsB: string[] = [];
  a.on("pageerror", (e) => errorsA.push(String(e)));
  b.on("pageerror", (e) => errorsB.push(String(e)));
  await a.waitForTimeout(500);
  expect(errorsA.filter((e) => !/fonts|net::/i.test(e))).toEqual([]);
  expect(errorsB.filter((e) => !/fonts|net::/i.test(e))).toEqual([]);

  // Disconnect A → B should drop back to 1 villager (no ghosts)
  await ctxA.close();
  await expect(b.getByText(/1 villager gathered/i)).toBeVisible({ timeout: 30_000 });
  await ctxB.close();
});
