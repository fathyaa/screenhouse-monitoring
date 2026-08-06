const amqp = require("amqplib");

// Topic exchange tunggal untuk SEMUA event antar service. Sengaja satu, bukan
// satu exchange per domain: routing key sudah cukup memisahkan, dan satu
// exchange bikin topologi bisa dibaca sekali lihat di UI manajemen RabbitMQ.
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "shms.events";

// Antrean kerja ingest tidak lewat exchange di atas — isinya bukan "peristiwa
// yang sudah terjadi", melainkan tugas yang harus dikerjakan tepat satu kali
// oleh salah satu replica processing layer.
const INGEST_QUEUE = process.env.RABBITMQ_INGEST_QUEUE || "q.ingest";

// Perintah keluar ke perangkat. Hanya collector yang memegang koneksi MQTT
// (lihat roles/collector.js), jadi role lain menitipkan perintahnya ke sini.
const COMMAND_QUEUE = process.env.RABBITMQ_COMMAND_QUEUE || "q.device.command";

// Penampungan pesan yang gagal permanen. Sengaja queue biasa, BUKAN
// x-dead-letter-exchange pada queue sumber: menambah argumen ke queue yang sudah
// ada bikin assertQueue ditolak PRECONDITION_FAILED (406) sampai queue lama
// dihapus. Consumer mem-publish ke sini secara eksplisit.
const DEAD_QUEUE = process.env.RABBITMQ_DEAD_QUEUE || "q.dead";

const RECONNECT_MS = Number(process.env.RABBITMQ_RECONNECT_MS || 3000);

function brokerUrl() {
  return (
    process.env.RABBITMQ_URL ||
    `amqp://${process.env.RABBITMQ_USER || "screenhouse"}:` +
      `${process.env.RABBITMQ_PASSWORD || "screenhouse"}@` +
      `${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`
  );
}

let connection = null;
let channel = null;
let connectPromise = null;
let closing = false;

// Dijalankan ulang setiap kali channel baru terbentuk, supaya consumer yang
// sudah terdaftar hidup kembali setelah RabbitMQ restart tanpa perlu
// me-restart prosesnya. RabbitMQ sekarang satu-satunya bus — kalau koneksinya
// putus permanen, seluruh sistem diam.
const channelHooks = new Set();

function registerChannelHook(fn) {
  channelHooks.add(fn);
  if (channel) {
    Promise.resolve(fn(channel)).catch((err) =>
      console.error("[rabbitmq] hook channel gagal:", err.message)
    );
  }
}

async function declareBaseTopology(ch) {
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  await ch.assertQueue(INGEST_QUEUE, { durable: true });
  await ch.assertQueue(COMMAND_QUEUE, { durable: true });
  await ch.assertQueue(DEAD_QUEUE, { durable: true });
}

function scheduleReconnect() {
  if (closing) return;
  console.warn(`[rabbitmq] koneksi tertutup — mencoba lagi dalam ${RECONNECT_MS}ms`);
  setTimeout(() => {
    connectRabbitMq().catch((err) =>
      console.error("[rabbitmq] gagal menyambung ulang:", err.message)
    );
  }, RECONNECT_MS);
}

async function establish() {
  // Koneksi dipakai ulang bila masih hidup. Channel bisa ditutup sendiri oleh
  // broker tanpa koneksinya ikut putus (tiap kesalahan protokol berakhir
  // begitu) — kalau di sini selalu memanggil amqp.connect, tiap channel yang
  // mati akan meninggalkan satu koneksi menganggur yang tidak pernah ditutup.
  if (!connection) {
    connection = await amqp.connect(brokerUrl());

    connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
    connection.on("close", () => {
      connection = null;
      channel = null;
      connectPromise = null;
      scheduleReconnect();
    });
  }

  channel = await connection.createChannel();
  await declareBaseTopology(channel);

  // Tanpa handler ini, proses tetap memegang referensi ke channel yang sudah
  // mati dan diam saja — consumer berhenti menerima pesan tanpa jejak di log.
  channel.on("error", (err) => console.error("[rabbitmq] channel error:", err.message));
  channel.on("close", () => {
    if (closing || channel === null) return;
    console.warn("[rabbitmq] channel ditutup broker — membangun ulang");
    channel = null;
    connectPromise = null;
    scheduleReconnect();
  });

  console.log(`[rabbitmq] tersambung — exchange "${EXCHANGE}"`);

  for (const hook of channelHooks) {
    try {
      await hook(channel);
    } catch (err) {
      console.error("[rabbitmq] hook channel gagal:", err.message);
    }
  }

  return channel;
}

async function connectRabbitMq() {
  if (channel) return channel;
  if (!connectPromise) {
    connectPromise = establish().catch((err) => {
      connectPromise = null;
      // Percobaan pertama pun dijadwalkan ulang, bukan cuma koneksi yang putus
      // di tengah jalan. Saat `docker compose up`, service hampir pasti naik
      // sebelum broker siap menerima koneksi — tanpa ini, semuanya mati serentak
      // di detik pertama dan bergantung pada restart policy.
      scheduleReconnect();
      throw err;
    });
  }
  return connectPromise;
}

/**
 * Untuk role yang tetap berguna tanpa broker (mis. API yang melayani query
 * database). Menyambung di latar belakang dan tidak pernah menolak.
 */
function connectRabbitMqInBackground() {
  connectRabbitMq().catch((err) =>
    console.warn("[rabbitmq] belum tersambung, mencoba di latar belakang:", err.message)
  );
}

async function getChannel() {
  if (channel) return channel;
  return connectRabbitMq();
}

/**
 * Channel BARU di atas koneksi yang sama.
 *
 * Wajib dipakai tiap consumer, karena `prefetch` di AMQP berlaku PER CHANNEL,
 * bukan per consumer. Dua consumer yang berbagi satu channel berarti panggilan
 * `prefetch()` terakhir menentukan keduanya — dan itu pernah menurunkan
 * throughput pipeline dari ~250 ke 23 pesan/detik, karena consumer reset metrik
 * (prefetch 1) didaftarkan setelah consumer persistence (prefetch 20) dan
 * mencekik channel yang sama.
 */
async function createChannel() {
  if (!connection) await connectRabbitMq();
  return connection.createChannel();
}

async function closeRabbitMq() {
  closing = true;
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch {
    // abaikan race saat shutdown
  } finally {
    channel = null;
    connection = null;
    connectPromise = null;
  }
}

module.exports = {
  EXCHANGE,
  INGEST_QUEUE,
  COMMAND_QUEUE,
  DEAD_QUEUE,
  connectRabbitMq,
  connectRabbitMqInBackground,
  getChannel,
  createChannel,
  closeRabbitMq,
  registerChannelHook,
};
