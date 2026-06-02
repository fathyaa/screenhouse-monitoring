import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io("http://localhost:3002", {
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