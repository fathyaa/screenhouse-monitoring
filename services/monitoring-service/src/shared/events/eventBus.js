const os = require("os");
const {
  EXCHANGE,
  DEAD_QUEUE,
  getChannel,
  createChannel,
  registerChannelHook,
} = require("../../config/rabbitmq");
const { isTransientError } = require("../../modules/ingest/transientError");

// Jeda sebelum pesan dikembalikan ke queue saat infrastruktur sedang down.
// Tanpa ini, pesan pertama dalam prefetch berputar secepat CPU sanggup dan
// membanjiri log selama Postgres mati.
const RETRY_BACKOFF_MS = Number(process.env.RABBITMQ_RETRY_BACKOFF_MS || 2000);
const RETRY_LOG_INTERVAL_MS = Number(process.env.RABBITMQ_RETRY_LOG_INTERVAL_MS || 5000);

const lastRetryLogAt = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Penanda unik per proses — dipakai menamai queue privat tiap replica. */
function instanceTag() {
  return `${os.hostname()}-${process.pid}`;
}

function waitForDrain(ch) {
  return new Promise((resolve, reject) => {
    const onDrain = () => {
      ch.removeListener("error", onError);
      resolve();
    };
    const onError = (err) => {
      ch.removeListener("drain", onDrain);
      reject(err);
    };
    ch.once("drain", onDrain);
    ch.once("error", onError);
  });
}

/**
 * Terbitkan satu peristiwa ke exchange. Persisten, jadi peristiwa selamat dari
 * restart broker selama queue tujuannya durable.
 */
async function publishEvent(routingKey, payload) {
  const ch = await getChannel();
  const ok = ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: "application/json",
    timestamp: Date.now(),
  });
  if (!ok) await waitForDrain(ch);
}

/** Kirim tugas ke antrean kerja (bukan peristiwa) — dikerjakan tepat satu consumer. */
async function sendToQueue(queue, payload) {
  const ch = await getChannel();
  const ok = ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: "application/json",
  });
  if (!ok) await waitForDrain(ch);
}

/**
 * Pesan gagal permanen dipindah ke dead-letter queue, bukan dibuang.
 * Publish dulu baru ack: kalau proses mati di antara keduanya, hasilnya duplikat
 * di dead-letter queue — jauh lebih baik daripada data hilang.
 */
async function moveToDeadLetter(ch, msg, err, source) {
  const raw = msg.content.toString();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  const body = Buffer.from(
    JSON.stringify({
      failedAt: new Date().toISOString(),
      source,
      routingKey: msg.fields?.routingKey ?? null,
      error: err?.message ?? String(err),
      errorCode: err?.code ?? null,
      payload,
    })
  );

  const ok = ch.sendToQueue(DEAD_QUEUE, body, {
    persistent: true,
    contentType: "application/json",
  });
  if (!ok) await waitForDrain(ch);

  ch.ack(msg);
  console.error(`[bus] "${source}" → ${DEAD_QUEUE}: ${err?.message ?? err}`);
}

/**
 * Kegagalan infrastruktur: pesan dikembalikan ke queue apa adanya, tanpa batas
 * percobaan. Selama Postgres/RabbitMQ bermasalah, queue depth naik — itu memang
 * sinyal yang diharapkan, dan tidak ada pembacaan sensor yang hilang.
 */
async function requeueAfterBackoff(ch, msg, err, source) {
  const now = Date.now();
  if (now - (lastRetryLogAt.get(source) ?? 0) >= RETRY_LOG_INTERVAL_MS) {
    lastRetryLogAt.set(source, now);
    console.warn(`[bus] "${source}" infrastruktur bermasalah, pesan dikembalikan: ${err?.message ?? err}`);
  }
  await sleep(RETRY_BACKOFF_MS);
  ch.nack(msg, false, true);
}

async function handleFailure(ch, msg, err, source) {
  try {
    if (isTransientError(err)) {
      await requeueAfterBackoff(ch, msg, err, source);
    } else {
      await moveToDeadLetter(ch, msg, err, source);
    }
  } catch (handlingErr) {
    // Channel ikut bermasalah (mis. RabbitMQ restart). Jangan ack — pesan yang
    // belum di-ack otomatis kembali jadi ready saat channel ditutup.
    console.error(`[bus] "${source}" gagal menangani error:`, handlingErr.message);
  }
}

/**
 * Daftarkan consumer. Dipasang ulang otomatis setiap channel baru terbentuk,
 * jadi pemanggil cukup memanggilnya sekali saat boot.
 *
 * @param {object}   spec
 * @param {string}   spec.queue      nama queue; `{instance}` diganti penanda proses
 * @param {string[]} spec.bindings   routing key yang di-bind ke exchange (kosong = queue kerja murni)
 * @param {boolean}  spec.durable    false untuk aliran yang boleh hilang (realtime)
 * @param {boolean}  spec.autoDelete hapus queue saat consumer terakhir pergi
 * @param {number}   spec.messageTtl buang pesan yang lebih tua dari ini (ms)
 * @param {number}   spec.prefetch   jumlah pesan in-flight per consumer
 * @param {Function} spec.handler    async (payload, msg) => void
 */
function consume({
  queue,
  bindings = [],
  durable = true,
  autoDelete = false,
  exclusive = false,
  messageTtl = null,
  prefetch = Number(process.env.RABBITMQ_PREFETCH || 20),
  handler,
}) {
  const queueName = queue.replace("{instance}", instanceTag());

  // Hook dipicu tiap koneksi/channel bersama terbentuk ulang, tapi channel yang
  // dikirimkannya sengaja TIDAK dipakai: tiap consumer butuh channel sendiri
  // karena prefetch berlaku per channel. Berbagi channel membuat consumer
  // dengan prefetch kecil mencekik consumer lain di proses yang sama.
  registerChannelHook(async () => {
    const ch = await createChannel();
    ch.on("error", (err) => console.error(`[bus] channel "${queueName}" error:`, err.message));

    const args = {};
    if (messageTtl) args["x-message-ttl"] = messageTtl;

    await ch.assertQueue(queueName, { durable, autoDelete, exclusive, arguments: args });
    for (const key of bindings) {
      await ch.bindQueue(queueName, EXCHANGE, key);
    }
    await ch.prefetch(prefetch);

    await ch.consume(
      queueName,
      async (msg) => {
        if (!msg) return;
        try {
          await handler(JSON.parse(msg.content.toString()), msg);
          ch.ack(msg);
        } catch (err) {
          await handleFailure(ch, msg, err, queueName);
        }
      },
      { noAck: false }
    );

    const bindLabel = bindings.length ? bindings.join(", ") : "(queue kerja)";
    console.log(`[bus] consumer "${queueName}" ← ${bindLabel} (prefetch ${prefetch})`);
  });
}

module.exports = { publishEvent, sendToQueue, consume, instanceTag };
