let redisClient = null;

const getRedis = async () => {
  if (redisClient) return redisClient;
  if (process.env.REDIS_CACHE_ENABLED === "0") return null;
  try {
    const { createClient } = require("redis");
    const redisConfig = require("../config/redis");
    const url =
      process.env.REDIS_URL ||
      `redis://${redisConfig.password ? `:${redisConfig.password}@` : ""}${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;
    redisClient = createClient({ url });
    redisClient.on("error", (err) =>
      console.warn("[CACHE] Redis error:", err.message)
    );
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn("[CACHE] Redis unavailable:", err.message);
    return null;
  }
};

const cacheGet = async (key) => {
  const client = await getRedis();
  if (!client) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const cacheSet = async (key, value, ttlSec = 300) => {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.setEx(key, ttlSec, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const cacheDel = async (key) => {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    /* ignore */
  }
};

module.exports = { cacheGet, cacheSet, cacheDel };
