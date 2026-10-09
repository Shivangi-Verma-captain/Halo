import { AVATARS, type AvatarId } from "@moon/shared";

interface Props {
  name: string;
  setName: (v: string) => void;
  avatar: AvatarId;
  setAvatar: (v: AvatarId) => void;
  onJoin: () => void;
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
  joining,
  error,
  serverOk,
  onlineCount,
}: Props) {
  const nameValid = name.trim().length >= 2 && name.trim().length <= 16;

  return (
    <div className="landing">
      <div className="landing-moon" aria-hidden="true">
        <div className="landing-moon-glow" />
        <div className="landing-moon-hole h1" />
        <div className="landing-moon-hole h2" />
        <div className="landing-moon-hole h3" />
      </div>
      <p className="eyebrow">A cozy village mystery · up to 8 villagers</p>
      <h1 className="title">
        WHO STOLE
        <br />
        THE MOON?
      </h1>
      <p className="subtitle">
        The moon has vanished from the twilight sky. Wander the village, gather
        clues, lend a paw with small tasks — then gather round and name the culprit.
      </p>

      <div className="landing-card">
        <label className="field-label" htmlFor="name-input">
          Your villager name
        </label>
        <input
          id="name-input"
          className="name-input"
          value={name}
          maxLength={16}
          placeholder="e.g. Wren"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nameValid && !joining) onJoin();
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

        <button
          className="join-btn"
          onClick={onJoin}
          disabled={!nameValid || joining || serverOk === false}
        >
          {joining ? "Knocking on the village gate…" : "Join Village"}
        </button>

        {error && (
          <p className="field-hint error" role="alert">
            {error}
          </p>
        )}
        {serverOk === false && (
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
