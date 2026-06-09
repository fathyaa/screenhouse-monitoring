const { Server } = require("socket.io");

function attachSocketServer(httpServer, subscriber) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("Frontend connected:", socket.id);

    socket.on("authenticate", ({ userId }) => {
      if (!userId) return;
      const room = `user:${userId}`;
      if (socket.data.userId) {
        socket.leave(`user:${socket.data.userId}`);
      }
      socket.join(room);
      socket.data.userId = String(userId);
      console.log(`Socket ${socket.id} joined ${room}`);
    });

    socket.on("unauthenticate", () => {
      if (socket.data.userId) {
        socket.leave(`user:${socket.data.userId}`);
        delete socket.data.userId;
      }
    });

    socket.on("disconnect", () => {
      console.log("Frontend disconnected:", socket.id);
    });
  });

  subscriber.subscribe("alert-created", (message) => {
    try {
      const alert = JSON.parse(message);
      const ownerId = alert.user_id;
      if (!ownerId) {
        console.warn("Alert tanpa user_id — tidak di-broadcast");
        return;
      }
      io.to(`user:${ownerId}`).emit("alert-update", alert);
      console.log(`Alert dikirim ke user:${ownerId}`);
    } catch (err) {
      console.error("[socket] alert-created:", err.message);
    }
  });

  subscriber.subscribe("actuator-updated", (message) => {
    try {
      const data = JSON.parse(message);
      const ownerId = data.user_id;
      if (ownerId) {
        io.to(`user:${ownerId}`).emit("actuator-update", data);
        console.log(`Actuator update ke user:${ownerId}`);
      }
    } catch (err) {
      console.error("[socket] actuator-updated:", err.message);
    }
  });

  console.log("Socket.IO attached — listening for alert-created, actuator-updated");
  return io;
}

module.exports = { attachSocketServer };
