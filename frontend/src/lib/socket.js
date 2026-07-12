import { io } from "socket.io-client";
import { MONITORING_URL } from "../config/api";

let socket = null;

const SOCKET_OPTS = {
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
};

function createSocket() {
  return MONITORING_URL ? io(MONITORING_URL, SOCKET_OPTS) : io(SOCKET_OPTS);
}

/** Hanya buat/konek socket setelah login — hindari spam reconnect di halaman login. */
export function getSocket() {
  if (!localStorage.getItem("token")) return null;

  if (!socket) {
    socket = createSocket();
  }

  if (!socket.connected && !socket.active) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.emit("unauthenticate");
    socket.disconnect();
    socket = null;
  }
}

export function authenticateSocket(userId) {
  if (!userId) return;
  const s = getSocket();
  if (s) s.emit("authenticate", { userId: String(userId) });
}
