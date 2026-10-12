import { expect, test, type Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import { Events, type ClientWorldState } from "@moon/shared";

test.setTimeout(90_000);

// Two REAL browser sessions share one village. Requires backend :3001 and
// frontend :5173 running (see README).
async function join(page: Page, name: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/villager name/i).fill(name);
  await page.getByRole("radio", { name: /classic multiplayer/i }).click();
  await page.getByRole("button", { name: /join classic lobby/i }).click();
}

interface SocketPlayer { socket: Socket; states: ClientWorldState[]; errors: string[] }
async function joinSocketPlayer(url: string, name: string, avatar: string, targetPlayers: number): Promise<SocketPlayer> {
  const socket = io(url, { transports: ["websocket"], reconnection: false });
  const states: ClientWorldState[] = [];
  const errors: string[] = [];
  socket.on(Events.State, (state: ClientWorldState) => states.push(state));
  socket.on(Events.Error, (error: { message?: string }) => errors.push(error.message ?? "unknown server error"));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.disconnect(); reject(new Error(`Timed out joining as ${name}`)); }, 10_000);
    const onJoinError = (error: { message?: string }) => { clearTimeout(timeout); socket.disconnect(); reject(new Error(error.message)); };
    socket.once("connect", () => socket.emit(Events.Join, { name, avatar, targetPlayers }));
    socket.once(Events.Joined, () => { clearTimeout(timeout); socket.off(Events.Error, onJoinError); resolve({ socket, states, errors }); });
    socket.on(Events.Error, onJoinError);
    socket.once("connect_error", (error) => { clearTimeout(timeout); reject(error); });
  });
}

function waitForWorld(player: SocketPlayer, predicate: (state: ClientWorldState) => boolean, label: string) {
  const alreadyReceived = player.states.find(predicate);
  if (alreadyReceived) return Promise.resolve(alreadyReceived);
  return new Promise<ClientWorldState>((resolve, reject) => {
    const timeout = setTimeout(() => { player.socket.off(Events.State, check); const last = player.states.at(-1); reject(new Error(`Timed out waiting for ${label}; last state was ${last?.phase}/${last?.targetPlayers} with ${last?.players.length} players (${last?.players.map((p) => p.name).join(",")}); server error: ${player.errors.at(-1) ?? "none"}`)); }, 10_000);
    const check = (state: ClientWorldState) => {
      if (!predicate(state)) return;
      clearTimeout(timeout);
      player.socket.off(Events.State, check);
      resolve(state);
    };
    player.socket.on(Events.State, check);
  });
}

test("two real browser clients synchronize in the classic lobby", async ({ browser }) => {
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
  await a.getByRole("radio", { name: /classic multiplayer/i }).click();
  await a.getByLabel("Human players to start").selectOption("8");
  await a.getByRole("button", { name: /join classic lobby/i }).click();
  await join(b, "WrenB");

  // The host can choose the full eight-seat target; two humans cannot start it.
  await expect(a.getByText(/2 connected/i)).toBeVisible({ timeout: 30_000 });
  await expect(b.getByText(/2 connected/i)).toBeVisible({ timeout: 30_000 });
  await expect(a.getByRole("button", { name: "Begin with 8" })).toBeDisabled();
  await expect(b.getByRole("button", { name: "Waiting for host" })).toBeDisabled();

  // Movement and the roster reach the second browser through the real server.
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

  // Disconnect A → B's authoritative roster removes that player (no ghosts).
  await ctxA.close();
  await expect(b.getByText("WrenA")).toHaveCount(0, { timeout: 30_000 });
  await ctxB.close();
});

test("five real Socket.IO clients enforce host-only starts and receive one private thief role", async () => {
  // This integration check requires a fresh, isolated server because the game
  // intentionally keeps one shared lobby alive across browser connections.
  test.skip(!process.env.MOON_TEST_SOCKET_SERVER, "set MOON_TEST_SOCKET_SERVER to an isolated test server");
  const url = process.env.MOON_TEST_SOCKET_SERVER!;
  const players: SocketPlayer[] = [];
  const avatars = ["moth", "fox", "owl", "cat", "frog"];
  try {
    players.push(await joinSocketPlayer(url, "Host", avatars[0], 5));
    for (let i = 1; i < 5; i++) players.push(await joinSocketPlayer(url, `Guest${i}`, avatars[i], 5));
    await Promise.all(players.map((player) => waitForWorld(player, (state) => state.phase === "lobby" && state.players.length === 5, "five-player lobby sync")));

    expect(players[0].states.at(-1)?.targetPlayers).toBe(5);

    const deniedNonHost = new Promise<{ message?: string }>((resolve) => players[1].socket.once(Events.Error, resolve));
    players[1].socket.emit(Events.StartRound);
    expect((await deniedNonHost).message).toMatch(/only the room host/i);

    const starts = players.map((player) => waitForWorld(player, (state) => state.phase === "exploration", "exploration start"));
    players[0].socket.emit(Events.StartRound);
    const states = await Promise.all(starts);
    expect(states.filter((state) => state.youAreCulprit)).toHaveLength(1);
    for (const state of states) {
      expect(state).not.toHaveProperty("culpritId");
      expect(state.scenarioTitle).toBeNull();
    }
  } finally {
    players.forEach(({ socket }) => socket.disconnect());
  }
});

test("solo mystery renders and reaches an accusation with multiplayer endpoints blocked", async ({ page }) => {
  await page.route("**/health", (route) => route.abort());
  await page.route("**/socket.io/**", (route) => route.abort());
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/villager name/i).fill("Moon Scout");
  await page.getByRole("button", { name: "Begin Mystery" }).click();
  await expect(page.getByText("Local · no server")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Explore — find clues" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Places" }).click();
  await expect(page.locator(".place-card img")).toHaveCount(3);
  const loadedScenes = await page.locator(".place-card img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0));
  expect(loadedScenes).toBe(true);
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /Investigate: Unusual Footprint/i }).click();
  await page.getByRole("button", { name: /Journal/ }).click();
  await expect(page.getByText("Unusual Footprint", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Ask Villagers/i }).click();
  await expect(page.getByText(/moon-dust by the fountain/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish Investigation" })).toBeVisible();
  await page.getByRole("button", { name: "Finish Investigation" }).click();
  await page.getByRole("button", { name: "Make Accusation" }).click();
  await expect(page.getByRole("heading", { name: "Who took the moon?" })).toBeVisible();
  const suspects = page.locator(".accusation .vote-list button");
  await expect(suspects).toHaveCount(7);
  await suspects.first().click();
  await expect(page.getByRole("heading", { name: /village sees through|culprit slips away/i })).toBeVisible();
  await expect(page.getByText(/The culprit was/)).toBeVisible();
  await expect(page.getByText("The culprit was Moon Scout")).toHaveCount(0);
  await page.getByRole("button", { name: "New Mystery" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Round 2 · Explore — find clues" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("small group starts locally with named human turns and AI villagers", async ({ page }) => {
  await page.route("**/health", (route) => route.abort());
  for (const count of [2, 3, 4]) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/villager name/i).fill("Aster");
    await page.getByRole("radio", { name: /small group/i }).click();
    await page.getByLabel("Local human investigators").selectOption(String(count));
    const names = ["Rowan", "Bramble", "Clover"];
    for (let index = 2; index <= count; index++) await page.getByLabel(`Investigator ${index}`).fill(names[index - 2]);
    await page.getByRole("button", { name: "Create Local Group" }).click();
    await expect(page.getByText("Local · no server")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pass Turn/ })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByText("Rowan's turn — pass the keyboard.")).toBeVisible();
    await page.getByRole("button", { name: /Ask Villagers/i }).click();
    await expect(page.getByText(/need something concrete to react to/)).toBeVisible();
    await page.getByRole("button", { name: "Finish Investigation" }).click();
    await page.getByRole("button", { name: "Make Accusation" }).click();
    await expect(page.locator(".accusation .vote-list button")).toHaveCount(8 - count);
  }
});
