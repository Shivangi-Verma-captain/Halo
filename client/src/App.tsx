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
import { startLocalMystery, localResult, type LocalHuman } from "./game/localMystery";
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
  PlaceGuide,
  LocalWitnessPanel,
} from "./components/Panels";
import type { Interactable } from "./game/VillageScene";

type Panel = "journal" | "tasks" | "chat" | "villagers" | "vote" | "places" | null;

export default function App() {
  const [screen, setScreen] = useState<"landing" | "village">("landing");
  const [localMode, setLocalMode] = useState(false);
  const [localHumans, setLocalHumans] = useState<LocalHuman[]>([]);
  const [localCulprit, setLocalCulprit] = useState("");
  const [localScenario, setLocalScenario] = useState<ReturnType<typeof startLocalMystery>["scenario"] | null>(null);
  const [localRound, setLocalRound] = useState(0);
  const [localTurn, setLocalTurn] = useState(0);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("moth");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const targetPlayersRef = useRef(5);

  const [conn, setConn] = useState("connecting");
  const [myId, setMyId] = useState("");
  const [world, setWorld] = useState<ClientWorldState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [muted, setM] = useState(getMuted());
  const worldRef = useRef<ClientWorldState | null>(null);
  const myIdRef = useRef("");
  worldRef.current = world;
  myIdRef.current = myId;

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
    if (screen !== "village" || localMode) return;
    const socket = getSocket();

    const onConnect = () => {
      setConn("connected");
      // (Re)join on every connect — covers first join + reconnects.
      socket.emit(Events.Join, { name: name.trim(), avatar, targetPlayers: targetPlayersRef.current });
    };
    const onDisconnect = () => {
      setConn("disconnected");
      if (!myIdRef.current) {
        setJoinError("The multiplayer server disconnected before you joined. Check its address and try again.");
        setJoining(false);
        myIdRef.current = "join-error";
        setScreen("landing");
      } else showToast("Lantern dimmed — connection lost. Trying to rekindle…");
    };
    const onConnectError = () => {
      setConn("disconnected");
      if (!myIdRef.current) {
        setJoinError("Could not connect to the multiplayer server. Solo Mystery remains available offline.");
        setJoining(false);
        myIdRef.current = "join-error";
        socket.disconnect();
        setScreen("landing");
      } else showToast("Multiplayer connection lost. Trying to rekindle…");
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
      if (!myIdRef.current) {
        setJoinError(msg);
        setJoining(false);
        myIdRef.current = "join-error";
        getSocket().disconnect();
        setScreen("landing");
      } else {
        sfx.error();
        showToast(msg);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
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
      socket.off("connect_error", onConnectError);
      socket.off(Events.Joined, onJoined);
      socket.off(Events.State, onState);
      socket.off(Events.Players, onPlayers);
      socket.off(Events.ClueFound, onClue);
      socket.off(Events.TaskDone, onTask);
      socket.off(Events.Chat, onChat);
      socket.off(Events.Error, onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, localMode]);

  const join = useCallback((targetPlayers: number) => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setJoinError("Names need 2–16 characters.");
      return;
    }
    setJoining(true);
    setLocalMode(false);
    targetPlayersRef.current = targetPlayers;
    setJoinError(null);
    setConn("connecting");
    myIdRef.current = "";
    setMyId("");
    setWorld(null);
    setScreen("village");
  }, [name, avatar]);

  const beginLocal = useCallback((humans: LocalHuman[]) => {
    const roster = humans.map((p) => ({ ...p, name: p.name.trim() }));
    if (roster.some((p) => p.name.length < 2 || p.name.length > 16)) {
      setJoinError("Each investigator needs a name between 2 and 16 characters.");
      return;
    }
    const nextRound = localRound + 1;
    const local = startLocalMystery(roster, nextRound);
    setLocalHumans(roster);
    setLocalCulprit(local.culpritId);
    setLocalScenario(local.scenario);
    setLocalRound(nextRound);
    setLocalTurn(0);
    setLocalMode(true);
    setMyId(local.world.players[0].id);
    myIdRef.current = local.world.players[0].id;
    setWorld(local.world);
    setPanel(null);
    setAccuseOpen(false);
    setScreen("village");
  }, [localRound]);

  const emitMove = useCallback((x: number, y: number) => {
    if (localMode) {
      setWorld((w) => w ? { ...w, players: w.players.map((p) => p.id === myId ? { ...p, x, y } : p) } : w);
      return;
    }
    try {
      getSocket().emit(Events.Move, { x, y });
    } catch {
      /* offline — will resync on reconnect */
    }
  }, [localMode, myId]);

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
        isAi: !p.connected,
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
    if (localMode) {
      setWorld((w) => {
        if (!w) return w;
        if (nearby.kind === "clue") {
          const clue = w.clues.find((c) => c.id === nearby.id);
          if (!clue || w.cluesTaken[clue.id]) return w;
          sfx.clue();
          showToast(`Clue discovered: ${clue.name}`);
          return { ...w, cluesTaken: { ...w.cluesTaken, [clue.id]: myId }, myClues: [...w.myClues, { ...clue, journalText: clue.description }], players: w.players.map((p) => p.id === myId ? { ...p, cluesFound: [...p.cluesFound, clue.id] } : p) };
        }
        if (w.myTasks.includes(nearby.id)) return w;
        sfx.task();
        showToast("Kind deed done — the village remembers.");
        return { ...w, myTasks: [...w.myTasks, nearby.id], players: w.players.map((p) => p.id === myId ? { ...p, tasksDone: [...p.tasksDone, nearby.id] } : p) };
      });
      return;
    }
    const socket = getSocket();
    if (nearby.kind === "clue") {
      sfx.interact();
      socket.emit(Events.CollectClue, { clueId: nearby.id });
    } else {
      sfx.interact();
      socket.emit(Events.CompleteTask, { taskId: nearby.id });
    }
  }, [nearby, localMode, myId, showToast]);

  const completeTask = useCallback((taskId: string) => {
    if (!localMode) {
      getSocket().emit(Events.CompleteTask, { taskId });
      return;
    }
    const current = worldRef.current;
    const me = current?.players.find((player) => player.id === myId);
    const task = current?.tasks.find((item) => item.id === taskId);
    if (!current || current.phase !== "exploration" || !me || !task || current.myTasks.includes(taskId)) return;
    if (Math.hypot(me.x - task.x, me.y - task.y) > WORLD.interactRadius + 30) {
      showToast("Stand closer to the task before logging it as done.");
      return;
    }
    sfx.task();
    setWorld({ ...current, myTasks: [...current.myTasks, taskId], players: current.players.map((player) => player.id === myId ? { ...player, tasksDone: [...player.tasksDone, taskId] } : player) });
    showToast("Kind deed done — the village remembers.");
  }, [localMode, myId, showToast]);

  // Keyboard shortcut: E to interact, J/T/C/V to toggle panels.
  useEffect(() => {
    if (screen !== "village") return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "Tab" && localMode && localHumans.length > 1) {
        e.preventDefault();
        const next = (localTurn + 1) % localHumans.length;
        setLocalTurn(next);
        setMyId(`local-human-${next}`);
        showToast(`${localHumans[next].name}'s turn — pass the keyboard.`);
      }
      if (e.key === "e" || e.key === "E") doInteract();
      if (e.key === "j" || e.key === "J") setPanel((p) => (p === "journal" ? null : "journal"));
      if (e.key === "t" || e.key === "T") setPanel((p) => (p === "tasks" ? null : "tasks"));
      if (e.key === "c" || e.key === "C") setPanel((p) => (p === "chat" ? null : "chat"));
      if (e.key === "v" || e.key === "V") setPanel((p) => (p === "villagers" ? null : "villagers"));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen, doInteract, localMode, localHumans, localTurn, showToast]);

  if (screen === "landing") {
    return (
      <div className="app">
        <Landing
          name={name}
          setName={setName}
          avatar={avatar}
          setAvatar={setAvatar}
          onJoin={join}
          onSolo={() => beginLocal([{ name: name.trim(), avatar }])}
          onSmallGroup={beginLocal}
          joining={joining}
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
          {localMode ? <span className="local-badge">Local · no server</span> : <ConnectionDot status={conn} />}
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
          {!localMode && <button
            className={panel === "chat" ? "active" : ""}
            onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))}
          >Talk</button>}
          <button
            className={panel === "villagers" ? "active" : ""}
            onClick={() => setPanel((p) => (p === "villagers" ? null : "villagers"))}
          >
            {localMode ? "Ask Villagers" : "Villagers"}
          </button>
          <button className={panel === "places" ? "active" : ""} onClick={() => setPanel((p) => p === "places" ? null : "places")}>Places</button>
          {world?.phase === "voting" && (
            <button
              className={panel === "vote" ? "active" : ""}
              onClick={() => setPanel((p) => (p === "vote" ? null : "vote"))}
            >
              Vote
            </button>
          )}
          {localMode && world?.phase === "exploration" && <button onClick={() => setWorld((w) => w ? { ...w, phase: "discussion" } : w)}>Finish Investigation</button>}
          {localMode && world?.phase === "discussion" && <button onClick={() => setAccuseOpen(true)}>Make Accusation</button>}
          {localMode && localHumans.length > 1 && <button onClick={() => { const next = (localTurn + 1) % localHumans.length; setLocalTurn(next); setMyId(`local-human-${next}`); showToast(`${localHumans[next].name}'s turn — pass the keyboard.`); }}>Pass Turn · {localHumans[(localTurn + 1) % localHumans.length].name}</button>}
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
              if (!localMode) getSocket().disconnect();
              setScreen("landing");
              setWorld(null);
              setMyId("");
              setLocalMode(false);
              setAccuseOpen(false);
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

      {world?.phase === "lobby" && !localMode && (
        <div className="lobby-bar">
          <span>
            {world.players.filter((p) => p.connected).length} connected · target {world.targetPlayers} · {world.players.filter((p) => p.ready).length} ready
          </span>
          {world.players.filter((p) => p.connected).length < world.targetPlayers && <span className="muted">Waiting for {world.targetPlayers - world.players.filter((p) => p.connected).length} more human{world.targetPlayers - world.players.filter((p) => p.connected).length === 1 ? "" : "s"}.</span>}
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
          <button className="join-btn small" onClick={() => getSocket().emit(Events.StartRound)} disabled={!world.players.find((p) => p.id === myId)?.isHost || world.players.filter((p) => p.connected).length < world.targetPlayers}>
            {world.players.find((p) => p.id === myId)?.isHost ? `Begin with ${world.targetPlayers}` : "Waiting for host"}
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
            onComplete={completeTask}
          />
        )}
        {world && panel === "chat" && !localMode && (
          <Discussion
            messages={world.messages}
            myId={myId}
            onSend={(text) => getSocket().emit(Events.SendMessage, { text })}
          />
        )}
        {world && panel === "villagers" && (localMode ? <LocalWitnessPanel world={world} /> : <PlayerList world={world} myId={myId} />)}
        {world && panel === "places" && <PlaceGuide onClose={() => setPanel(null)} />}
        {world && panel === "vote" && !localMode && (
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
            onPlayAgain={() => localMode && localHumans.length ? beginLocal(localHumans) : getSocket().emit(Events.PlayAgain)}
            onLobby={() => { if (localMode) { setScreen("landing"); setWorld(null); setLocalMode(false); setPanel(null); setAccuseOpen(false); setMyId(""); myIdRef.current = ""; } else getSocket().emit(Events.BackToLobby); }}
          />
        </div>
      )}
      {localMode && accuseOpen && world && world.phase === "discussion" && (
        <div className="overlay"><div className="panel accusation"><h2>Who took the moon?</h2><p>Choose the villager your evidence points to.</p><ul className="vote-list">{world.players.filter((p) => !p.connected).map((p) => <li key={p.id}><span>{p.name}</span><button className="small-btn" onClick={() => { if (!localScenario) return; setWorld((w) => w ? localResult(w, localCulprit, p.id, localScenario) : w); setAccuseOpen(false); }}>Accuse</button></li>)}</ul><button className="ghost-btn" onClick={() => setAccuseOpen(false)}>Keep investigating</button></div></div>
      )}
    </div>
  );
}
