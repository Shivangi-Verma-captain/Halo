// Live two-client verification (dev-only). Run with:
//   node scripts/verify-live.mjs  (server must be listening on :3001)
import { io } from "socket.io-client";

const URL = process.env.SERVER_URL ?? "http://localhost:3001";
const AVATARS = ["moth", "fox", "owl", "cat", "frog", "hare", "badger", "wren"];

function once(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (data) => {
      clearTimeout(t);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

async function join(socket, name, avatar) {
  const joinedP = once(socket, "joined");
  const stateP = once(socket, "state");
  socket.emit("join", { name, avatar });
  const [joined, state] = await Promise.all([joinedP, stateP]);
  return { joined, state };
}

function track(socket) {
  const box = { latest: null };
  socket.on("state", (s) => {
    box.latest = s;
  });
  return box;
}

function waitFor(box, predicate, timeoutMs = 10000, label = "state") {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const t = setInterval(() => {
      try {
        if (box.latest && predicate(box.latest)) {
          clearInterval(t);
          resolve(box.latest);
        } else if (Date.now() - t0 > timeoutMs) {
          clearInterval(t);
          reject(new Error(`timeout waiting for matching ${label}`));
        }
      } catch { /* keep waiting */ }
    }, 50);
  });
}

const results = [];
function check(label, cond) {
  results.push([cond ? "PASS" : "FAIL", label]);
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
}

const a = io(URL, { transports: ["websocket"] });
const b = io(URL, { transports: ["websocket"] });
await Promise.all([once(a, "connect"), once(b, "connect")]);
const ta = track(a);
const tb = track(b);
check("both sockets connected", true);

// 1. two joins, both see each other
const ra = await join(a, "WrenA", "moth");
check("A joined", ra.joined.playerId.length > 0);
await join(b, "WrenB", "fox");
const bothA = await waitFor(ta, (s) => s.players.length === 2);
const bothB = await waitFor(tb, (s) => s.players.length === 2);
check("A sees 2 players", bothA.players.length === 2);
check("B sees 2 players", bothB.players.length === 2);
check("names visible", bothB.players.some((p) => p.name === "WrenA"));

// 2. movement sync: A moves, B gets players fan-out
const startX = bothA.players.find((p) => p.name === "WrenA").x;
const movedP = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("no players update on B")), 8000);
  b.on("players", (payload) => {
    const pa = payload.players.find((p) => p.name === "WrenA");
    if (pa && Math.abs(pa.x - startX) > 5) {
      clearTimeout(t);
      resolve(pa);
    }
  });
});
a.emit("move", { x: startX + 60, y: 480 });
const moved = await movedP;
check(`movement syncs (WrenA ${startX} -> ${moved.x})`, true);

// 3. duplicate name resolved
const c = io(URL, { transports: ["websocket"] });
await once(c, "connect");
const tc = track(c);
const rc = await join(c, "WrenA", "owl");
check("duplicate name adjusted", rc.joined.nameAdjusted === true && rc.joined.name !== "WrenA");
console.log(`    duplicate resolved to: ${rc.joined.name}`);

// 4. fill to 8, 9th refused
const extras = [];
for (let i = 0; i < 5; i++) {
  const s = io(URL, { transports: ["websocket"] });
  await once(s, "connect");
  await join(s, `Extra${i}`, AVATARS[(i + 3) % 8]);
  extras.push(s);
}
const full = await waitFor(tb, (s) => s.players.length === 8).catch(() => null);
check("8 slots occupied", full?.players.length === 8);
const z = io(URL, { transports: ["websocket"] });
await once(z, "connect");
const errP = once(z, "game-error");
z.emit("join", { name: "TooMany", avatar: "wren" });
const err = await errP;
check(`9th player refused ("${err.message}")`, /full/i.test(err.message));

// 5. disconnect -> no ghost
a.disconnect();
const backTo7 = await waitFor(tb, (s) => s.players.length === 7);
check("disconnect removes player (no ghost)", backTo7.players.length === 7);

for (const s of [...extras, b, c, z]) s.disconnect();

const failed = results.filter(([r]) => r === "FAIL");
console.log(failed.length === 0 ? "\nALL LIVE CHECKS PASSED" : `\n${failed.length} CHECKS FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
