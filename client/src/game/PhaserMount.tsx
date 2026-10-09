import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { WORLD } from "@moon/shared";
import { VillageScene, type Interactable, type RemotePlayer } from "./VillageScene";

interface Props {
  myId: string;
  players: RemotePlayer[];
  interactables: Interactable[];
  onMove: (x: number, y: number) => void;
  onStep: () => void;
}

export default function PhaserMount({ myId, players, interactables, onMove, onStep }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<VillageScene | null>(null);
  const cbRef = useRef({ onMove, onStep });
  cbRef.current = { onMove, onStep };

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const scene = new VillageScene();
    scene.setMoveCallback((x, y) => cbRef.current.onMove(x, y));
    scene.setStepCallback(() => cbRef.current.onStep());
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: Math.min(window.innerWidth, 1280),
      height: Math.min(window.innerHeight - 140, 800),
      backgroundColor: "#1a1b3a",
      physics: { default: "arcade", arcade: { debug: false } },
      scene: [scene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;

    // Keep world-bounds camera sane on resize
    const onResize = () => {
      game.scale.resize(Math.min(window.innerWidth, 1600), Math.min(window.innerHeight - 120, 1000));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Push identity + player sync (cheap: only when props change)
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    // Scene may not be created yet on first frames — retry briefly.
    let tries = 0;
    const t = setInterval(() => {
      const sc = sceneRef.current;
      if (!sc || !sc.scene.isActive("village")) {
        if (++tries > 40) clearInterval(t);
        return;
      }
      clearInterval(t);
      sc.setIdentity(myId);
      sc.syncPlayers(players);
      sc.setInteractables(interactables);
    }, 100);
    // Also try immediately in case scene is ready
    try {
      if (s.scene.isActive("village")) {
        clearInterval(t);
        s.setIdentity(myId);
        s.syncPlayers(players);
        s.setInteractables(interactables);
      }
    } catch {
      /* scene not ready yet; interval covers it */
    }
    return () => clearInterval(t);
  }, [myId, players, interactables]);

  return (
    <div
      ref={hostRef}
      className="phaser-host"
      aria-label="Explorable village"
      style={{ width: "100%", height: `min(72vh, ${WORLD.height}px)` }}
    />
  );
}
