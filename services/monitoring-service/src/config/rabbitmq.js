const amqp = require("amqplib");

const QUEUE_NAME = process.env.RABBITMQ_INGEST_QUEUE || "sensor-ingest";
const PREFETCH = Number(process.env.RABBITMQ_PREFETCH || 20);

let connection = null;
let channel = null;

function isRabbitMqEnabled() {
  const raw = String(process.env.USE_RABBITMQ ?? "false").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

async function connectRabbitMq() {
  if (!isRabbitMqEnabled()) return null;

  const url =
    process.env.RABBITMQ_URL ||
    `amqp://${process.env.RABBITMQ_USER || "screenhouse"}:${process.env.RABBITMQ_PASSWORD || "screenhouse"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;

  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.prefetch(PREFETCH);

  connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
  connection.on("close", () => {
    console.warn("[rabbitmq] connection closed");
    connection = null;
    channel = null;
  });

  console.log(`[rabbitmq] connected — queue "${QUEUE_NAME}" (prefetch ${PREFETCH})`);
  return channel;
}

async function getChannel() {
  if (!isRabbitMqEnabled()) {
    throw new Error("RabbitMQ disabled (USE_RABBITMQ != true)");
  }
  if (!channel) {
    await connectRabbitMq();
  }
  return channel;
}

async function closeRabbitMq() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch {
    // ignore shutdown races
  } finally {
    channel = null;
    connection = null;
  }
}

module.exports = {
  QUEUE_NAME,
  PREFETCH,
  isRabbitMqEnabled,
  connectRabbitMq,
  getChannel,
  closeRabbitMq,
};
