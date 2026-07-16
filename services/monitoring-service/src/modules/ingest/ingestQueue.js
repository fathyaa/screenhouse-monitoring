const { getChannel, QUEUE_NAME, isRabbitMqEnabled } = require("../../config/rabbitmq");
const { saveSensorReading } = require("./ingestPipeline");
const { recordMqttNacked } = require("./ingestMetrics");

let consumerStarted = false;

function waitForChannelDrain(ch) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      ch.off("drain", onDrain);
      ch.off("error", onError);
      ch.off("close", onClose);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("RabbitMQ channel closed while waiting for drain"));
    };

    ch.once("drain", onDrain);
    ch.once("error", onError);
    ch.once("close", onClose);
  });
}

async function enqueueSensorReading(job) {
  const ch = await getChannel();
  const body = Buffer.from(JSON.stringify(job));
  const ok = ch.sendToQueue(QUEUE_NAME, body, { persistent: true, contentType: "application/json" });
  if (!ok) {
    await waitForChannelDrain(ch);
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
