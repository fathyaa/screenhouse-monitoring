const webpush = require("web-push");
const pool = require("../../config/db");

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@screenhouse.local";

  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys belum di-set — push notification nonaktif");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

let pushReady = configureWebPush();

async function upsertSubscription(userId, subscription, userAgent = null) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw Object.assign(new Error("Subscription push tidak valid"), { status: 400 });
  }

  await pool.query(
    `
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, endpoint) DO UPDATE SET
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      updated_at = CURRENT_TIMESTAMP
    `,
    [userId, endpoint, keys.p256dh, keys.auth, userAgent]
  );
}

async function removeSubscription(userId, endpoint) {
  await pool.query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint]
  );
}

async function sendPushToUser(userId, payload) {
  if (!pushReady) return { sent: 0, failed: 0, skipped: true };

  const userRes = await pool.query(
    `SELECT notifications_muted FROM users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows[0]?.notifications_muted) {
    return { sent: 0, failed: 0, skipped: true, muted: true };
  }

  const result = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  if (!result.rows.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  for (const row of result.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [row.endpoint]);
      }
      console.error("[push] send gagal:", err.statusCode ?? err.message);
    }
  }

  return { sent, failed };
}

module.exports = {
  upsertSubscription,
  removeSubscription,
  sendPushToUser,
  isPushConfigured: () => pushReady,
  getVapidPublicKey: () => process.env.VAPID_PUBLIC_KEY ?? null,
};
