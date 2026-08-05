const { EXCHANGE, getChannel, registerChannelHook } = require("../../config/rabbitmq");

/**
 * Routing key yang diterbitkan app-service. Harus sama persis dengan daftar di
 * monitoring-service/src/shared/events/routingKeys.js — konsumennya listener
 * alert, yang menyimpan salinan ambang & registry di database monitoring supaya
 * evaluasi tidak perlu lintas database.
 */
const RK = {
  CONFIG_THRESHOLD: "config.threshold",
  CONFIG_REGISTRY: "config.registry",
};

/**
 * Terbitkan peristiwa perubahan katalog.
 *
 * Kegagalan sengaja hanya dicatat, tidak dilempar: perubahan ambang sudah commit
 * di database app sebelum ini dipanggil, dan menggagalkan request HTTP hanya
 * karena broker sedang bermasalah akan membingungkan admin yang perubahannya
 * sebenarnya tersimpan. Konsekuensinya, salinan di sisi monitoring bisa
 * tertinggal sampai penyuntingan berikutnya — itu tebusan yang disadari.
 */
async function publishEvent(routingKey, payload) {
  try {
    const ch = await getChannel();
    ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: "application/json",
    });
  } catch (err) {
    console.error(`[event] gagal publish ${routingKey}:`, err.message);
  }
}

/**
 * Daftarkan consumer yang dipasang ulang otomatis tiap channel baru terbentuk.
 * Dipakai listener notifikasi.
 */
function consume({ queue, bindings = [], prefetch = 10, handler }) {
  registerChannelHook(async (ch) => {
    await ch.assertQueue(queue, { durable: true });
    for (const key of bindings) await ch.bindQueue(queue, EXCHANGE, key);
    await ch.prefetch(prefetch);

    await ch.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          await handler(JSON.parse(msg.content.toString()), msg);
          ch.ack(msg);
        } catch (err) {
          console.error(`[bus] "${queue}" gagal memproses:`, err.message);
          // Notifikasi bukan sumber kebenaran — mengulang selamanya hanya
          // memacetkan antrean. Dibuang setelah dicatat.
          ch.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    console.log(`[bus] consumer "${queue}" ← ${bindings.join(", ")}`);
  });
}

module.exports = { publishEvent, consume, RK };
