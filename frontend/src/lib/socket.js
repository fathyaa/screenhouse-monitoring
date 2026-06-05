import { io } from "socket.io-client";
import { MONITORING_URL } from "../config/api";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(MONITORING_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
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
  getSocket().emit("authenticate", { userId: String(userId) });
}

export default getSocket();
