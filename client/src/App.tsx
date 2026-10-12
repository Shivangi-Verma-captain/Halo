import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Events,
  WORLD,
  type AvatarId,
  type ChatMessage,
  type ClientWorldState,
  type PlayerPublic,
} from "@moon/shared";
import { getSocket } from "./socket";
import { setMuted, isMuted as getMuted, sfx } from "./sound";
import { initializeFirebaseAnalytics } from "./firebase";
import PhaserMount from "./game/PhaserMount";
import Landing from "./components/Landing";
import {
  ConnectionDot,
  Discussion,
  Journal,
  PhaseBanner,
  PlayerList,
  Results,
  TaskPanel,
  Voting,
} from "./components/Panels";
import type { Interactable } from "./game/VillageScene";

type Panel = "journal" | "tasks" | "chat" | "villagers" | "vote" | null;

export default function App() {
  const [screen, setScreen] = useState<"landing" | "village">("landing");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("moth");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const [conn, setConn] = useState("connecting");
  const [myId, setMyId] = useState("");
  const [world, setWorld] = useState<ClientWorldState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [muted, setM] = useState(getMuted());
  const worldRef = useRef<ClientWorldState | null>(null);
  worldRef.current = world;

  useEffect(() => {
    void initializeFirebaseAnalytics();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((t) => (t === msg ? null : t));
    }, 3200);
  }, []);

  // Landing health check (so "server unavailable" is explicit, not a hang).
  useEffect(() => {
    if (screen !== "landing") return;
    let cancelled = false;
    const base =
      (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL ??
      window.location.origin;
    fetch(`${base}/health`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setServerOk(true);
        setOnlineCount(typeof j.players === "number" ? j.players : null);
      })
      .catch(() => {
        if (!cancelled) setServerOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [screen]);

  // Socket lifecycle — attach once when entering village.
  useEffect(() => {
    if (screen !== "village") return;
    const socket = getSocket();

    const onConnect = () => {
      setConn("connected");
      // (Re)join on every connect — covers first join + reconnects.
      socket.emit(Events.Join, { name: name.trim(), avatar });
    };
    const onDisconnect = () => {
      setConn("disconnected");
      showToast("Lantern dimmed — connection lost. Trying to rekindle…");
    };
    const onJoined = (payload: { playerId: string; name: string; nameAdjusted?: boolean }) => {
      setMyId(payload.playerId);
      setJoining(false);
      setJoinError(null);
      if (payload.nameAdjusted) {
        showToast(`That name was taken — you joined as “${payload.name}”.`);
      }
    };
    const onState = (state: ClientWorldState) => {
      const prev = worldRef.current;
      setWorld(state);
      if (prev && prev.phase !== state.phase) {
        sfx.phase();
        if (state.phase === "voting") setPanel("vote");
        if (state.phase === "discussion") setPanel("chat");
        if (state.phase === "results") {
          const win = state.result?.villagersWin;
          if (win) sfx.win();
          else sfx.lose();
          setPanel(null);
        }
      }
    };
    const onPlayers = (payload: { players: PlayerPublic[] }) => {
      // Lightweight position fan-out: merge into world without clobbering
      // phase/clue data. If full state hasn't arrived yet, skip.
      setWorld((w) => (w ? { ...w, players: payload.players } : w));
    };
    const onClue = (payload: { clueId: string; journal: ClientWorldState["myClues"]; finder?: string }) => {
      sfx.clue();
      showToast(
        payload.finder
          ? `Clue discovered: ${payload.journal.find((c) => c.id === payload.clueId)?.name ?? payload.clueId}`
          : "Clue recorded in your journal.",
      );
      setWorld((w) => (w ? { ...w, myClues: payload.journal } : w));
    };
    const onTask = () => {
      sfx.task();
      showToast("Kind deed done — the village remembers.");
    };
    const onChat = (msg: ChatMessage) => {
      setWorld((w) => (w ? { ...w, messages: [...w.messages.slice(-99), msg] } : w));
    };
    const onErr = (payload: { message?: string }) => {
      const msg = payload?.message ?? "Something rustled in the dark.";
      // Join-phase errors return to landing messaging; in-game = toast.
      if (!myId) {
        setJoinError(msg);
        setJoining(false);
      } else {
        sfx.error();
        showToast(msg);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(Events.Joined, onJoined);
    socket.on(Events.State, onState);
    socket.on(Events.Players, onPlayers);
    socket.on(Events.ClueFound, onClue);
    socket.on(Events.TaskDone, onTask);
    socket.on(Events.Chat, onChat);
    socket.on(Events.Error, onErr);

    if (socket.connected) onConnect();
    else {
      setConn("connecting");
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(Events.Joined, onJoined);
      socket.off(Events.State, onState);
      socket.off(Events.Players, onPlayers);
      socket.off(Events.ClueFound, onClue);
      socket.off(Events.TaskDone, onTask);
      socket.off(Events.Chat, onChat);
      socket.off(Events.Error, onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const join = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setJoinError("Names need 2–16 characters.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    setConn("connecting");
    setScreen("village");
  }, [name, avatar]);

  const emitMove = useCallback((x: number, y: number) => {
    try {
      getSocket().emit(Events.Move, { x, y });
    } catch {
      /* offline — will resync on reconnect */
    }
  }, []);

  const emitStep = useCallback(() => {
    sfx.step();
  }, []);

  const players = useMemo(
    () =>
      (world?.players ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        x: p.x,
        y: p.y,
      })),
    [world],
  );

  const interactables: Interactable[] = useMemo(() => {
    if (!world) return [];
    const clues: Interactable[] = world.clues.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      kind: "clue" as const,
      taken: Boolean(world.cluesTaken[c.id]),
    }));
    const tasks: Interactable[] = world.tasks.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      kind: "task" as const,
      done: world.myTasks.includes(t.id),
    }));
    return [...clues, ...tasks];
  }, [world]);

  // Nearest interactable for the E-prompt.
  const nearby = useMemo(() => {
    if (!world || !myId) return null;
    const me = world.players.find((p) => p.id === myId);
    if (!me) return null;
    let best: { id: string; kind: "clue" | "task"; label: string; dist: number } | null = null;
    for (const c of world.clues) {
      if (world.cluesTaken[c.id]) continue;
      const d = Math.hypot(me.x - c.x, me.y - c.y);
      if (d < WORLD.interactRadius && (!best || d < best.dist)) {
        best = { id: c.id, kind: "clue", label: c.name, dist: d };
      }
    }
    for (const t of world.tasks) {
      if (world.myTasks.includes(t.id)) continue;
      const d = Math.hypot(me.x - t.x, me.y - t.y);
      if (d < WORLD.interactRadius && (!best || d < best.dist)) {
        best = { id: t.id, kind: "task", label: t.name, dist: d };
      }
    }
    return best;
  }, [world, myId]);

  const doInteract = useCallback(() => {
    if (!nearby) return;
    const socket = getSocket();
    if (nearby.kind === "clue") {
      sfx.interact();
      socket.emit(Events.CollectClue, { clueId: nearby.id });
    } else {
      sfx.interact();
      socket.emit(Events.CompleteTask, { taskId: nearby.id });
    }
  }, [nearby]);

  // Keyboard shortcut: E to interact, J/T/C/V to toggle panels.
  useEffect(() => {
    if (screen !== "village") return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "e" || e.key === "E") doInteract();
      if (e.key === "j" || e.key === "J") setPanel((p) => (p === "journal" ? null : "journal"));
      if (e.key === "t" || e.key === "T") setPanel((p) => (p === "tasks" ? null : "tasks"));
      if (e.key === "c" || e.key === "C") setPanel((p) => (p === "chat" ? null : "chat"));
      if (e.key === "v" || e.key === "V") setPanel((p) => (p === "villagers" ? null : "villagers"));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen, doInteract]);

  if (screen === "landing") {
    return (
      <div className="app">
        <Landing
          name={name}
          setName={setName}
          avatar={avatar}
          setAvatar={setAvatar}
          onJoin={join}
          joining={false}
          error={joinError}
          serverOk={serverOk}
          onlineCount={onlineCount}
        />
      </div>
    );
  }

  return (
    <div className="app game">
      <header className="hud-top">
        <div className="hud-title">
          <strong>Who Stole the Moon?</strong>
          <ConnectionDot status={conn} />
        </div>
        <div className="hud-btns">
          <button
            className={panel === "journal" ? "active" : ""}
            onClick={() => {
              setPanel((p) => (p === "journal" ? null : "journal"));
            }}
            aria-pressed={panel === "journal"}
          >
            Journal{world && world.myClues.length > 0 ? ` (${world.myClues.length})` : ""}
          </button>
          <button
            className={panel === "tasks" ? "active" : ""}
            onClick={() => setPanel((p) => (p === "tasks" ? null : "tasks"))}
          >
            Tasks
          </button>
          <button
            className={panel === "chat" ? "active" : ""}
            onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))}
          >
            Talk
          </button>
          <button
            className={panel === "villagers" ? "active" : ""}
            onClick={() => setPanel((p) => (p === "villagers" ? null : "villagers"))}
          >
            Villagers
          </button>
          {world?.phase === "voting" && (
            <button
              className={panel === "vote" ? "active" : ""}
              onClick={() => setPanel((p) => (p === "vote" ? null : "vote"))}
            >
              Vote
            </button>
          )}
          <button
            onClick={() => {
              const m = !muted;
              setMuted(m);
              setM(m);
            }}
            aria-pressed={muted}
            title="Mute sounds"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={() => {
              getSocket().disconnect();
              setScreen("landing");
              setWorld(null);
              setMyId("");
              setJoining(false);
            }}
          >
            Leave
          </button>
        </div>
      </header>

      {world && (
        <PhaseBanner
          phase={world.phase}
          endsAt={world.phaseEndsAt}
          round={world.round}
          youAreCulprit={world.youAreCulprit}
        />
      )}

      {world?.phase === "lobby" && (
        <div className="lobby-bar">
          <span>
            {world.players.length} villager{world.players.length === 1 ? "" : "s"} gathered ·{" "}
            {world.players.filter((p) => p.ready).length} ready
          </span>
          {(() => {
            const me = world.players.find((p) => p.id === myId);
            return (
              <>
                <button
                  onClick={() => getSocket().emit(Events.SetReady, { ready: true })}
                  disabled={Boolean(me?.ready)}
                >
                  {me?.ready ? "Ready ✓" : "Ready"}
                </button>
                <button
                  className="ghost-btn"
                  onClick={() => getSocket().emit(Events.SetReady, { ready: false })}
                >
                  Not yet
                </button>
              </>
            );
          })()}
          <button className="join-btn small" onClick={() => getSocket().emit(Events.StartRound)}>
            Begin the Night
          </button>
        </div>
      )}

      <main className="stage">
        <PhaserMount
          myId={myId}
          players={players}
          interactables={interactables}
          onMove={emitMove}
          onStep={emitStep}
        />
        {nearby && world?.phase === "exploration" && (
          <button className="interact-prompt" onClick={doInteract}>
            {nearby.kind === "clue" ? "Investigate" : "Help out"}: {nearby.label}{" "}
            <kbd>E</kbd>
          </button>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        {joining && !myId && <div className="toast">Joining the village…</div>}
      </main>

      <aside className={`drawer${panel ? " open" : ""}`} aria-hidden={!panel}>
        {world && panel === "journal" && <Journal world={world} />}
        {world && panel === "tasks" && (
          <TaskPanel
            world={world}
            onComplete={(id) => getSocket().emit(Events.CompleteTask, { taskId: id })}
          />
        )}
        {world && panel === "chat" && (
          <Discussion
            messages={world.messages}
            myId={myId}
            onSend={(text) => getSocket().emit(Events.SendMessage, { text })}
          />
        )}
        {world && panel === "villagers" && <PlayerList world={world} myId={myId} />}
        {world && panel === "vote" && (
          <Voting world={world} myId={myId} onVote={(id) => getSocket().emit(Events.Vote, { targetId: id })} />
        )}
      </aside>

      {world && world.phase === "discussion" && panel === null && (
        <div className="bottom-sheet">
          <Discussion
            messages={world.messages}
            myId={myId}
            onSend={(text) => getSocket().emit(Events.SendMessage, { text })}
          />
        </div>
      )}

      {world?.phase === "results" && (
        <div className="overlay">
          <Results
            world={world}
            onPlayAgain={() => getSocket().emit(Events.PlayAgain)}
            onLobby={() => getSocket().emit(Events.BackToLobby)}
          />
        </div>
      )}
    </div>
  );
}
