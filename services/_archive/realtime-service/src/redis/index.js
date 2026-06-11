const { createClient } = require("redis");

const subscriber = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

subscriber.on("error", (err) => {
  console.log("Redis Error:", err);
});

async function connectRedis() {
  await subscriber.connect();

  console.log("Realtime Service Connected to Redis");
}

module.exports = {
  subscriber,
  connectRedis,
};