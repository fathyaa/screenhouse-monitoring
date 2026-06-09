const { createClient } = require("redis");

const subscriber = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

subscriber.on("error", (err) => console.error("[app-redis]", err.message));

async function connectRedis() {
  if (!subscriber.isOpen) {
    await subscriber.connect();
    console.log("App Service connected to Redis (push worker)");
  }
}

module.exports = { subscriber, connectRedis };
