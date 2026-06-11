const { createClient } = require("redis");

let publisherClient = null;

function getPublisher() {
  if (publisherClient) return publisherClient;

  publisherClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT || 6379),
    },
  });

  publisherClient.on("error", (err) => {
    console.error("[redis-publisher]", err.message);
  });

  return publisherClient;
}

async function publishEvent(channel, payload) {
  try {
    const client = getPublisher();
    if (!client.isOpen) await client.connect();
    await client.publish(channel, JSON.stringify(payload));
  } catch (err) {
    console.error(`[event] gagal publish ${channel}:`, err.message);
  }
}

module.exports = { publishEvent };
