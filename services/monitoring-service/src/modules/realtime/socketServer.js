const { Server } = require("socket.io");
const { buildClientCapabilities } = require("../../shared/actuatorCapabilities");
const { RK } = require("../../shared/events/routingKeys");

// Log broadcast per-pesan dimatikan default (hot path saat throughput tinggi);
// set SOCKET_DEBUG=true untuk mengaktifkan lagi.
const DEBUG = process.env.SOCKET_DEBUG === "true";

/**
 * Gateway realtime. Tidak menyentuh database sama sekali — ia hanya menerima
 * peristiwa yang sudah lengkap dan meneruskannya ke room `user:{id}`.
 *
 * Bisa dijalankan berapa pun replica-nya tanpa adapter Socket.IO tambahan:
 * tiap proses punya queue sendiri yang di-bind ke exchange, jadi semua replica
 * menerima semua peristiwa dan masing-masing melayani koneksi miliknya. Yang
 * dibutuhkan di depan hanyalah sticky session di load balancer.
 */
function attachSocketServer(httpServer) {
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

  console.log("Socket.IO siap — menunggu peristiwa dari bus");
  return io;
}

/** Arahkan satu peristiwa dari bus ke room pemiliknya. */
function dispatchEvent(io, routingKey, payload) {
  switch (routingKey) {
    case RK.SENSOR_PERSISTED: {
      // Payload realtime sudah dirakit listener persistence — gateway tidak
      // perlu query apa pun untuk melengkapinya.
      const data = payload.realtime;
      const ownerId = data?.user_id;
      if (!ownerId) {
        console.warn("Sensor update tanpa user_id — tidak di-broadcast");
        return;
      }
      io.to(`user:${ownerId}`).emit("sensor-update", data);
      if (DEBUG) console.log(`Sensor update ke user:${ownerId} (SH ${data.screenhouse_id})`);
      return;
    }

    case RK.ALERT_CREATED: {
      const ownerId = payload.user_id;
      if (!ownerId) {
        console.warn("Alert tanpa user_id — tidak di-broadcast");
        return;
      }
      // Sertakan kapabilitas aktuator seperti endpoint daftar alert (alertController)
      // supaya frontend bisa menilai "ditangani otomatis" dengan benar untuk alert
      // realtime juga — mis. gh01 yang aktuator otomatisnya dimatikan.
      io.to(`user:${ownerId}`).emit("alert-update", {
        ...payload,
        capabilities: buildClientCapabilities(payload.screenhouse_id),
      });
      console.log(`Alert dikirim ke user:${ownerId}`);
      return;
    }

    case RK.ALERT_RESOLVED: {
      const ownerId = payload.user_id;
      if (!ownerId) return;
      io.to(`user:${ownerId}`).emit("alert-resolved", {
        ...payload,
        capabilities: buildClientCapabilities(payload.screenhouse_id),
      });
      console.log(`Alert resolved ke user:${ownerId}`);
      return;
    }

    case RK.ACTUATOR_UPDATED: {
      const ownerId = payload.user_id;
      if (!ownerId) return;
      io.to(`user:${ownerId}`).emit("actuator-update", payload);
      console.log(`Actuator update ke user:${ownerId}`);
      return;
    }

    default:
      if (DEBUG) console.log("[socket] routing key tak dikenal:", routingKey);
  }
}

module.exports = { attachSocketServer, dispatchEvent };
