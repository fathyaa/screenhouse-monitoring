const http = require("http");
const express = require("express");
const cors = require("cors");
const { connectRabbitMq } = require("../config/rabbitmq");
const { consume } = require("../shared/events/eventBus");
const { BINDINGS } = require("../shared/events/routingKeys");
const { attachSocketServer, dispatchEvent } = require("../modules/realtime/socketServer");

// Umur maksimum peristiwa realtime di antrean. Lewat dari ini, isinya sudah
// tidak menggambarkan keadaan sekarang.
const REALTIME_TTL_MS = Number(process.env.REALTIME_TTL_MS || 30000);

/**
 * GATEWAY REALTIME — Socket.IO ke browser petani.
 *
 * Boleh berapa pun replica-nya. Tiap proses membuat queue-nya SENDIRI yang
 * di-bind ke exchange, jadi semua replica menerima semua peristiwa dan
 * masing-masing melayani koneksi yang kebetulan mendarat padanya.
 *
 * Queue-nya sengaja non-durable + auto-delete + ber-TTL, berbeda dari semua
 * queue lain di sistem ini. Kalau dibuat durable, gateway yang mati lima menit
 * akan menumpuk ribuan pembacaan basi, lalu memuntahkan semuanya ke browser
 * begitu hidup lagi — lebih buruk daripada sekadar melewatkannya. Untuk aliran
 * ini, membuang pesan yang tidak ada penerimanya adalah perilaku yang BENAR.
 */
async function start() {
  await connectRabbitMq();

  const app = express();
  app.use(cors());
  app.get("/", (req, res) => res.json({ role: "realtime", status: "ok", pid: process.pid }));

  const server = http.createServer(app);
  const io = attachSocketServer(server);

  consume({
    queue: `${process.env.QUEUE_REALTIME_PREFIX || "q.realtime"}.{instance}`,
    bindings: BINDINGS.REALTIME,
    durable: false,
    autoDelete: true,
    exclusive: true,
    messageTtl: REALTIME_TTL_MS,
    handler: async (payload, msg) => {
      dispatchEvent(io, msg.fields.routingKey, payload);
    },
  });

  const port = Number(process.env.PORT || 3002);
  server.listen(port, () => console.log(`[realtime] Socket.IO di :${port} (TTL ${REALTIME_TTL_MS}ms)`));
}

module.exports = { start };
