import { AVATARS, type AvatarId } from "@moon/shared";
import { useState } from "react";
import type { LocalHuman } from "../game/localMystery";

interface Props {
  name: string;
  setName: (v: string) => void;
  avatar: AvatarId;
  setAvatar: (v: AvatarId) => void;
  onJoin: (targetPlayers: number) => void;
  onSolo: () => void;
  onSmallGroup: (humans: LocalHuman[]) => void;
  joining: boolean;
  error: string | null;
  serverOk: boolean | null;
  onlineCount: number | null;
}

export default function Landing({
  name,
  setName,
  avatar,
  setAvatar,
  onJoin,
  onSolo,
  onSmallGroup,
  joining,
  error,
  serverOk,
  onlineCount,
}: Props) {
  const [mode, setMode] = useState<"solo" | "small" | "classic">("solo");
  const [groupSize, setGroupSize] = useState(2);
  const [groupNames, setGroupNames] = useState(["", ""]);
  const [classicTarget, setClassicTarget] = useState(5);
  const nameValid = name.trim().length >= 2 && name.trim().length <= 16;
  const submit = () => {
    if (mode === "solo") onSolo();
    else if (mode === "small") onSmallGroup(groupNames.slice(0, groupSize).map((n, i) => ({ name: i === 0 ? name.trim() : n.trim(), avatar: i === 0 ? avatar : AVATARS.filter((item) => item.id !== avatar)[i - 1].id })));
    else onJoin(classicTarget);
  };

  return (
    <div className="landing">
      <div className="landing-art" aria-hidden="true" />
      <div className="landing-moon" aria-hidden="true">
        <div className="landing-moon-glow" />
        <div className="landing-moon-hole h1" />
        <div className="landing-moon-hole h2" />
        <div className="landing-moon-hole h3" />
      </div>
      <p className="eyebrow">A storybook mystery for up to eight</p>
      <h1 className="title">
        WHO STOLE
        <br />
        THE MOON?
      </h1>
      <p className="subtitle">The moon has vanished from the twilight sky. Choose how your village will investigate.</p>

      <div className="landing-card">
        <p className="field-label">Choose your game</p>
        <div className="mode-grid" role="radiogroup" aria-label="Game mode">
          <button className={`mode-card${mode === "solo" ? " selected" : ""}`} role="radio" aria-checked={mode === "solo"} onClick={() => setMode("solo")}>
            <strong>Solo Mystery</strong><span>1 human · 7 AI villagers</span><small>Investigate offline and accuse an AI suspect.</small>
          </button>
          <button className={`mode-card${mode === "small" ? " selected" : ""}`} role="radio" aria-checked={mode === "small"} onClick={() => setMode("small")}>
            <strong>Small Group</strong><span>2–4 local humans · AI fills to 8</span><small>Pass the keyboard between investigators. No server required.</small>
          </button>
          <button className={`mode-card${mode === "classic" ? " selected" : ""}`} role="radio" aria-checked={mode === "classic"} onClick={() => setMode("classic")}>
            <strong>Classic Multiplayer</strong><span>5–8 connected humans</span><small>Online room, hidden human Moon Thief, server required.</small>
          </button>
        </div>
        <label className="field-label" htmlFor="name-input">
          {mode === "small" ? "First investigator's name" : "Your villager name"}
        </label>
        <input
          id="name-input"
          className="name-input"
          value={name}
          maxLength={16}
          placeholder="e.g. Wren"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nameValid && !joining) submit();
          }}
          autoComplete="off"
        />
        {!nameValid && name.length > 0 && (
          <p className="field-hint error" role="alert">
            Names need 2–16 characters: letters, numbers, spaces.
          </p>
        )}

        <p className="field-label" id="avatar-label">
          Choose your villager
        </p>
        <div className="avatar-grid" role="radiogroup" aria-labelledby="avatar-label">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={avatar === a.id}
              className={`avatar-pick${avatar === a.id ? " selected" : ""}`}
              onClick={() => setAvatar(a.id)}
              title={a.name}
            >
              <span
                className="avatar-dot"
                style={{ background: a.coat, borderColor: a.trim }}
              />
              <span className="avatar-name">{a.name}</span>
            </button>
          ))}
        </div>

        {mode === "small" && (
          <div className="group-setup">
            <label className="field-label" htmlFor="group-size">Local human investigators</label>
            <select id="group-size" value={groupSize} onChange={(e) => { const n = Number(e.target.value); setGroupSize(n); setGroupNames((names) => Array.from({ length: n }, (_, i) => names[i] ?? "")); }}>
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n} investigators</option>)}
            </select>
            {Array.from({ length: groupSize - 1 }, (_, i) => <label className="field-label" key={i}>Investigator {i + 2}<input className="name-input" value={groupNames[i + 1] ?? ""} maxLength={16} placeholder={`Name ${i + 2}`} onChange={(e) => setGroupNames((names) => { const next = [...names]; next[i + 1] = e.target.value; return next; })} /></label>)}
            <p className="field-hint">During play, press Tab to pass control to the next named investigator.</p>
          </div>
        )}
        {mode === "classic" && (
          <div className="group-setup">
            <label className="field-label" htmlFor="classic-count">Human players to start</label>
            <select id="classic-count" value={classicTarget} onChange={(e) => setClassicTarget(Number(e.target.value))}>
              {[5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} connected humans</option>)}
            </select>
            <p className="field-hint">The server waits for that many real people; the first player is host, and one human is the hidden thief.</p>
          </div>
        )}

        <button
          className="join-btn"
          onClick={submit}
          disabled={mode === "solo" ? !nameValid : mode === "small" ? !nameValid || groupNames.slice(1, groupSize).some((n) => n.trim().length < 2) : !nameValid || joining || serverOk === false}
        >
          {mode === "solo" ? "Begin Mystery" : mode === "small" ? "Create Local Group" : joining ? "Knocking on the village gate…" : "Join Classic Lobby"}
        </button>

        {error && (
          <p className="field-hint error" role="alert">
            {error}
          </p>
        )}
          {mode === "classic" && serverOk === false && (
          <p className="field-hint error" role="alert">
            The village server is unreachable. Is it running on{" "}
            {import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001"}?
          </p>
        )}
        {serverOk === true && (
          <p className="field-hint ok">
            {onlineCount != null
              ? `Lanterns lit — ${onlineCount} villager${onlineCount === 1 ? "" : "s"} about.`
              : "Lanterns lit — the village is awake."}
          </p>
        )}
        <p className="field-hint">
          Move with <kbd>WASD</kbd> or <kbd>←↑↓→</kbd>. Walk into a glowing marker and press the
          prompt to investigate.
        </p>
      </div>
    </div>
  );
}
