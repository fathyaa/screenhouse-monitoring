const { sendPushToUser } = require("./pushService");
const { consume } = require("../../shared/events/publisher");

/**
 * LISTENER NOTIFIKASI — Web Push ke perangkat petani.
 *
 * Tinggal di app-service, bukan monitoring-service, karena langganan push milik
 * domain identitas: tabelnya ada di database app, bersama pengguna yang
 * memilikinya. Memindahkannya ke monitoring hanya akan menukar satu batas yang
 * rapi dengan koneksi lintas-database.
 *
 * Aman dijalankan banyak replica: satu peristiwa alert hanya sampai ke satu
 * consumer, dan pengirimannya idempoten per id alert (dipakai sebagai tag
 * notifikasi, jadi kiriman ganda menimpa yang lama alih-alih menumpuk).
 */
function startPushWorker() {
  consume({
    queue: process.env.QUEUE_NOTIF || "q.notif",
    bindings: ["alert.created"],
    handler: async (alert) => {
      const userId = alert.user_id ?? alert.owner_user_id;
      if (!userId) return;

      const screenhouse = alert.screenhouse_name ?? "Screenhouse";
      await sendPushToUser(Number(userId), {
        title: "⚠️ Peringatan Screenhouse",
        body: `${screenhouse}: ${alert.message}`,
        url: "/petani/peringatan",
        tag: `alert-${alert.id}`,
        alertId: alert.id,
      });
    },
  });
}

module.exports = { startPushWorker };
