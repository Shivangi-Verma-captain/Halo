import { io, type Socket } from "socket.io-client";
import { Events } from "@moon/shared";

function serverUrl(): string {
  // VITE_SERVER_URL wins (production). In local dev the Vite proxy serves
  // same-origin /socket.io, so default to window origin.
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  if (env?.VITE_SERVER_URL) return env.VITE_SERVER_URL;
  return window.location.origin;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(serverUrl(), {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    withCredentials: true,
  });
  return socket;
}

export { Events };
export type { Socket };
