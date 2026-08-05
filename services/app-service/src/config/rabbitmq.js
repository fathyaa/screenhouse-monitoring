const amqp = require("amqplib");

// Harus sama persis dengan monitoring-service (src/config/rabbitmq.js).
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "shms.events";
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

const channelHooks = new Set();

function registerChannelHook(fn) {
  channelHooks.add(fn);
  if (channel) {
    Promise.resolve(fn(channel)).catch((err) =>
      console.error("[rabbitmq] hook channel gagal:", err.message)
    );
  }
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
  connection = await amqp.connect(brokerUrl());
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
  connection.on("close", () => {
    connection = null;
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
      // Percobaan pertama pun dijadwalkan ulang: saat `docker compose up`,
      // service hampir pasti naik sebelum broker siap menerima koneksi.
      scheduleReconnect();
      throw err;
    });
  }
  return connectPromise;
}

/**
 * Untuk role yang tetap berguna tanpa broker (REST API). Menyambung di latar
 * belakang dan tidak pernah menolak.
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
  connectRabbitMq,
  connectRabbitMqInBackground,
  getChannel,
  closeRabbitMq,
  registerChannelHook,
};
