require("dotenv").config();

const express = require("express");
const http = require("http");

const { Server } = require("socket.io");

const {
  subscriber,
  connectRedis,
} = require("./redis");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

app.get("/", (req, res) => {
  res.send("Realtime Service Running");
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

async function startServer() {
  await connectRedis();

  subscriber.subscribe(
    "sensor-data-created",
    (message) => {
      console.log("EVENT RECEIVED:");

      const data = JSON.parse(message);

      console.log(data);

      // broadcast ke frontend
        io.emit("sensor-data-created", data);
        console.log("Event broadcasted to frontend");
    }
  );

  subscriber.subscribe(
    "alert-created",
    (message) => {
        console.log(
        "ALERT EVENT RECEIVED"
        );

        const alert = JSON.parse(message);
        const ownerId = alert.user_id;

        if (!ownerId) {
            console.warn("Alert tanpa user_id — tidak di-broadcast");
            return;
        }

        io.to(`user:${ownerId}`).emit("alert-update", alert);

        console.log(`Alert dikirim ke user:${ownerId}`);
    }
);

  const PORT = process.env.PORT || 3002;

  server.listen(PORT, () => {
    console.log(
      `Realtime Service running on port ${PORT}`
    );
  });
}

startServer();