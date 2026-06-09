const {
  upsertSubscription,
  removeSubscription,
  getVapidPublicKey,
  isPushConfigured,
} = require("./pushService");

async function getVapidKey(req, res) {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ message: "Push notification belum dikonfigurasi di server" });
  }
  res.json({ publicKey });
}

async function subscribePush(req, res) {
  try {
    if (!isPushConfigured()) {
      return res.status(503).json({ message: "Push notification belum dikonfigurasi di server" });
    }

    await upsertSubscription(
      req.user.id,
      req.body,
      req.headers["user-agent"] ?? null
    );
    res.status(201).json({ message: "Subscription push tersimpan" });
  } catch (err) {
    console.error("[push/subscribe]", err);
    res.status(err.status || 500).json({ message: err.message || "Internal server error" });
  }
}

async function unsubscribePush(req, res) {
  try {
    const { endpoint } = req.body ?? {};
    if (!endpoint) {
      return res.status(400).json({ message: "endpoint wajib diisi" });
    }
    await removeSubscription(req.user.id, endpoint);
    res.json({ message: "Subscription push dihapus" });
  } catch (err) {
    console.error("[push/unsubscribe]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { getVapidKey, subscribePush, unsubscribePush };
