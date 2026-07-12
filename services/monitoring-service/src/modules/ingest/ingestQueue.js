const { getChannel, QUEUE_NAME, isRabbitMqEnabled } = require("../../config/rabbitmq");
const { saveSensorReading } = require("./ingestPipeline");
const { recordMqttNacked } = require("./ingestMetrics");

let consumerStarted = false;

async function enqueueSensorReading(job) {
  const ch = await getChannel();
  const body = Buffer.from(JSON.stringify(job));
  const ok = ch.sendToQueue(QUEUE_NAME, body, { persistent: true, contentType: "application/json" });
  if (!ok) {
    throw new Error("RabbitMQ queue penuh — pesan ditolak");
  }
}

async function startIngestConsumer() {
  if (!isRabbitMqEnabled()) return;
  if (consumerStarted) return;

  const ch = await getChannel();
  consumerStarted = true;

  ch.consume(
    QUEUE_NAME,
    async (msg) => {
      if (!msg) return;
      try {
        const job = JSON.parse(msg.content.toString());
        await saveSensorReading(job);
        ch.ack(msg);
      } catch (err) {
        recordMqttNacked();
        console.error("[rabbitmq] gagal proses ingest:", err.message);
        ch.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  console.log(`[rabbitmq] consumer aktif pada queue "${QUEUE_NAME}"`);
}

module.exports = {
  enqueueSensorReading,
  startIngestConsumer,
};
