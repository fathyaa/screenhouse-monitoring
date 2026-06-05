const { createClient } = require("redis");

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

const subscriber = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

const publisher = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

redisClient.on("error", (err) => console.log("Redis Error:", err));
subscriber.on("error", (err) => console.log("Redis Subscriber Error:", err));
publisher.on("error", (err) => console.log("Redis Publisher Error:", err));

async function connectRedis() {
  if (!redisClient.isOpen) await redisClient.connect();
  if (!subscriber.isOpen) await subscriber.connect();
  if (!publisher.isOpen) await publisher.connect();
  console.log("Monitoring Service connected to Redis");
}

module.exports = {
  redisClient,
  subscriber,
  publisher,
  connectRedis,
};
