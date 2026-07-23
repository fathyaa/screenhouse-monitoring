const { Server } = require("socket.io");
const { buildClientCapabilities } = require("../../shared/actuatorCapabilities");

// Log broadcast per-pesan dimatikan default (hot path saat throughput tinggi);
// set SOCKET_DEBUG=true untuk mengaktifkan lagi.
const DEBUG = process.env.SOCKET_DEBUG === "true";

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
      // Sertakan kapabilitas aktuator seperti endpoint daftar alert (alertController)
      // supaya frontend bisa menilai "ditangani otomatis" dengan benar untuk alert
      // realtime juga — mis. gh01 yang aktuator otomatisnya dimatikan.
      io.to(`user:${ownerId}`).emit("alert-update", {
        ...alert,
        capabilities: buildClientCapabilities(alert.screenhouse_id),
      });
      console.log(`Alert dikirim ke user:${ownerId}`);
    } catch (err) {
      console.error("[socket] alert-created:", err.message);
    }
  });

  subscriber.subscribe("alert-resolved", (message) => {
    try {
      const alert = JSON.parse(message);
      const ownerId = alert.user_id;
      if (!ownerId) return;
      io.to(`user:${ownerId}`).emit("alert-resolved", {
        ...alert,
        capabilities: buildClientCapabilities(alert.screenhouse_id),
      });
      console.log(`Alert resolved ke user:${ownerId}`);
    } catch (err) {
      console.error("[socket] alert-resolved:", err.message);
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

  subscriber.subscribe("sensor-update", (message) => {
    try {
      const data = JSON.parse(message);
      const ownerId = data.user_id;
      if (!ownerId) {
        console.warn("Sensor update tanpa user_id — tidak di-broadcast");
        return;
      }
      io.to(`user:${ownerId}`).emit("sensor-update", data);
      if (DEBUG) console.log(`Sensor update ke user:${ownerId} (SH ${data.screenhouse_id})`);
    } catch (err) {
      console.error("[socket] sensor-update:", err.message);
    }
  });

  console.log("Socket.IO attached — listening for alert-created, alert-resolved, actuator-updated, sensor-update");
  return io;
}

module.exports = { attachSocketServer };
