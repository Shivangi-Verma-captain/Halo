import { useEffect, useState } from "react";
import type { ChatMessage, ClientWorldState, Phase } from "@moon/shared";

export function ConnectionDot({ status }: { status: string }) {
  const color =
    status === "connected" ? "#8fd6b4" : status === "connecting" ? "#f2c572" : "#e88ca0";
  const label =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting…"
        : "Disconnected";
  return (
    <span className="conn" title={label} aria-label={`Connection: ${label}`}>
      <span className="conn-dot" style={{ background: color }} />
      {label}
    </span>
  );
}

export function PlaceGuide({ onClose }: { onClose: () => void }) {
  const base = import.meta.env.BASE_URL;
  const places = [
    { title: "Village Square", image: "village-square.webp", text: "Return to the lantern-lit fountain at the heart of the village." },
    { title: "Moon Observatory", image: "moon-observatory.webp", text: "Follow the star chart clues to the telescope on the hill." },
    { title: "Enchanted Forest", image: "forest-shrine.webp", text: "The trail beyond the cottages holds signs of a hurried passage." },
  ];
  return <div className="panel place-guide"><div className="place-guide-head"><div><h2>Places around the village</h2><p className="muted">Walk the Phaser map to reach each landmark. These scenes are location previews; clues still need to be found in the world.</p></div><button className="small-btn" onClick={onClose}>Close</button></div><div className="place-grid">{places.map((place) => <article className="place-card" key={place.title}><img src={`${base}assets/scenes/${place.image}`} alt={`${place.title} storybook scene`} /><div><h3>{place.title}</h3><p>{place.text}</p></div></article>)}</div></div>;
}

export function LocalWitnessPanel({ world }: { world: ClientWorldState }) {
  const found = new Set(world.myClues.map((clue) => clue.id));
  const witnesses = [
    { clue: "star-chart", name: "Pip the Baker", text: "I saw the observatory chart glowing late into the night. Someone had marked the moon's path more than once." },
    { clue: "violet-fabric", name: "Fern the Gardener", text: "A violet thread was caught on the garden thorns. It looked freshly torn." },
    { clue: "lantern-oil", name: "Bell the Clockkeeper", text: "The clocktower lamp burned much brighter than usual around midnight." },
    { clue: "torn-letter", name: "Wren the Librarian", text: "Someone asked whether the night could be borrowed. They did not take kindly to my answer." },
    { clue: "footprint", name: "Moss the Caretaker", text: "There was moon-dust by the fountain after midnight. I heard hurried steps heading uphill." },
    { clue: "pocket-watch", name: "Tock the Clockmaker", text: "A watch stopped at midnight. Its owner was close to the tower lamp." },
    { clue: "muddy-boot", name: "Rue the Florist", text: "The garden mud was dragged back toward the square in a hurry." },
    { clue: "moon-crumb", name: "Lumen the Moth Keeper", text: "I found a tiny piece of moonlight beside the fountain. It was still warm." },
  ].filter((witness) => found.has(witness.clue));
  return <div className="panel"><h3>Ask the villagers</h3>{witnesses.length ? <ul className="witness-list">{witnesses.map((w) => <li key={w.clue}><strong>{w.name}</strong><p>“{w.text}”</p></li>)}</ul> : <p className="muted">The villagers are willing to talk, but they need something concrete to react to. Find a clue first.</p>}</div>;
}

export function PhaseBanner({
  phase,
  endsAt,
  round,
  youAreCulprit,
}: {
  phase: Phase;
  endsAt: number | null;
  round: number;
  youAreCulprit: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
  const text: Record<Phase, string> = {
    lobby: "Gathering villagers…",
    exploration: "Explore — find clues, lend a paw",
    discussion: "Discuss — what did you see?",
    voting: "Vote — who stole the moon?",
    results: "The truth, by lantern-light",
  };
  return (
    <div className="phase-banner" role="status">
      <strong>
        {round > 0 ? `Round ${round} · ` : ""}
        {text[phase]}
      </strong>
      {secs != null && (
        <span className="phase-timer">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
      )}
      {youAreCulprit && phase !== "lobby" && phase !== "results" && (
        <span className="culprit-whisper">(You feel the moonlight heavy in your pockets…)</span>
      )}
    </div>
  );
}

export function PlayerList({ world, myId }: { world: ClientWorldState; myId: string }) {
  return (
    <div className="panel players-panel">
      <h3>Villagers ({world.players.length}/8)</h3>
      <ul>
        {world.players.map((p) => (
          <li key={p.id} className={p.id === myId ? "me" : ""}>
            <span className="p-name">{p.name}</span>
            {p.id === myId && <span className="p-tag">you</span>}
            {world.phase === "lobby" && (
              <span className="p-tag">{p.ready ? "ready" : "…"}</span>
            )}
            <span className="p-meta">
              🔍{p.cluesFound.length} · ✓{p.tasksDone.length}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Journal({ world }: { world: ClientWorldState }) {
  if (world.myClues.length === 0)
    return (
      <div className="panel">
        <h3>Evidence Journal</h3>
        <p className="muted">No clues yet. Follow the golden glimmers in the village.</p>
      </div>
    );
  return (
    <div className="panel">
      <h3>Evidence Journal ({world.myClues.length})</h3>
      <ul className="journal-list">
        {world.myClues.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>
            <span className="muted"> · {c.location}</span>
            <p>{c.description}</p>
          </li>
        ))}
      </ul>
      {Object.keys(world.cluesTaken).length > 0 && (
        <p className="muted small">
          Found across the village: {Object.keys(world.cluesTaken).length} clue
          {Object.keys(world.cluesTaken).length === 1 ? "" : "s"} discovered.
        </p>
      )}
    </div>
  );
}

export function TaskPanel({
  world,
  onComplete,
}: {
  world: ClientWorldState;
  onComplete: (id: string) => void;
}) {
  if (world.tasks.length === 0)
    return (
      <div className="panel">
        <h3>Village Tasks</h3>
        <p className="muted">Tasks appear when the round begins.</p>
      </div>
    );
  return (
    <div className="panel">
      <h3>Village Tasks</h3>
      <ul className="journal-list">
        {world.tasks.map((t) => {
          const done = world.myTasks.includes(t.id);
          return (
            <li key={t.id} className={done ? "done" : ""}>
              <strong>{t.name}</strong>
              <span className="muted"> · {t.location}</span>
              <p>{done ? t.rewardText : t.description}</p>
              {!done && (
                <button className="small-btn" onClick={() => onComplete(t.id)}>
                  Log as done (stand close)
                </button>
              )}
              {done && <span className="p-tag">done</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Discussion({
  messages,
  myId,
  onSend,
}: {
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="panel chat-panel">
      <h3>Discussion</h3>
      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <p className="muted">Quiet… share what you found near the fountain.</p>
        )}
        {messages.map((m) => (
          <p key={m.id} className={m.playerId === myId ? "me" : ""}>
            <strong>{m.name}: </strong>
            {m.text}
          </p>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onSend(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something… (Enter to send)"
          aria-label="Discussion message"
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export function Voting({
  world,
  myId,
  onVote,
}: {
  world: ClientWorldState;
  myId: string;
  onVote: (id: string) => void;
}) {
  const me = world.players.find((p) => p.id === myId);
  const myVote = me ? world.votes[myId] : undefined;
  const counts = new Map<string, number>();
  for (const t of Object.values(world.votes)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return (
    <div className="panel">
      <h3>Vote — who stole the moon?</h3>
      {myVote ? (
        <p>
          You voted for{" "}
          <strong>{world.players.find((p) => p.id === myVote)?.name ?? "…"}</strong>. The
          lanterns are being counted…
        </p>
      ) : (
        <ul className="vote-list">
          {world.players
            .filter((p) => p.id !== myId)
            .map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className="muted small">
                  {counts.get(p.id) ?? 0} vote{(counts.get(p.id) ?? 0) === 1 ? "" : "s"}
                </span>
                <button className="small-btn" onClick={() => onVote(p.id)}>
                  Vote
                </button>
              </li>
            ))}
        </ul>
      )}
      <p className="muted small">
        {Object.keys(world.votes).length}/{world.players.length} votes cast. One vote each —
        no take-backs, just like village gossip.
      </p>
    </div>
  );
}

export function Results({
  world,
  onPlayAgain,
  onLobby,
}: {
  world: ClientWorldState;
  onPlayAgain: () => void;
  onLobby: () => void;
}) {
  const r = world.result;
  if (!r) return null;
  return (
    <div className="panel results">
      <h2>{r.villagersWin ? "The village sees through the night!" : "The culprit slips away…"}</h2>
      <p className="scenario-title">{r.scenarioTitle}</p>
      <p>
        The culprit was <strong>{r.culpritName}</strong>.
      </p>
      <p>{r.solutionText}</p>
      <p className="muted">Motive: {r.motive}</p>
      <h4>How it could be solved</h4>
      <ul>
        {r.reasoning.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <div className="results-btns">
        <button className="join-btn" onClick={onPlayAgain}>
          New Mystery
        </button>
        <button className="ghost-btn" onClick={onLobby}>
          Back to Village Square
        </button>
      </div>
    </div>
  );
}
