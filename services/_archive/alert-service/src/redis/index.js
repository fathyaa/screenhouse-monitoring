const { createClient } = require("redis");

const subscriber = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

const publisher = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

async function connectRedis() {
  await subscriber.connect();

  await publisher.connect();

  console.log(
    "Alert Service Connected to Redis"
  );
}

module.exports = {
  subscriber,
  publisher,
  connectRedis,
};