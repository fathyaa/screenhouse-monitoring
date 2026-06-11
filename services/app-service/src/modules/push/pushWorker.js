const { sendPushToUser } = require("./pushService");

async function startPushWorker(subscriber) {
  await subscriber.subscribe("alert-created", async (message) => {
    try {
      const alert = JSON.parse(message);
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
    } catch (err) {
      console.error("[push-worker]", err.message);
    }
  });

  console.log("Push worker listening on Redis channel alert-created");
}

module.exports = { startPushWorker };
