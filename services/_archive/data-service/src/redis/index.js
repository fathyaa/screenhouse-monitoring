const { createClient } = require("redis");

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

redisClient.on("error", (err) => {
  console.log("Redis Error:", err);
});

async function connectRedis() {
  await redisClient.connect();

  console.log("Connected to Redis");
}

module.exports = {
  redisClient,
  connectRedis,
};