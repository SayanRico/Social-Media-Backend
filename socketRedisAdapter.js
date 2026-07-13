const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const redisConfig = require("./config/redis");

const ADAPTER_ENABLED = process.env.SOCKET_IO_REDIS_ADAPTER_ENABLED !== "0";

const buildClient = () => {
  const url = process.env.REDIS_URL;
  if (url) {
    return createClient({ url });
  }

  return createClient({
    socket: {
      host: redisConfig.host,
      port: redisConfig.port,
      connectTimeout: 3000,
    },
    password: redisConfig.password,
    database: redisConfig.db,
  });
};

const attachSocketRedisAdapter = async (io) => {
  if (!ADAPTER_ENABLED) {
    return { enabled: false, reason: "disabled_by_env" };
  }

  const pubClient = buildClient();
  const subClient = pubClient.duplicate();

  pubClient.on("error", (error) => {
    console.warn("[socket:adapter] publisher error:", error?.message || error);
  });
  subClient.on("error", (error) => {
    console.warn("[socket:adapter] subscriber error:", error?.message || error);
  });

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.info("[socket:adapter] Redis adapter enabled");
    return {
      enabled: true,
      pubClient,
      subClient,
    };
  } catch (error) {
    console.warn(
      "[socket:adapter] unavailable, continuing without cross-node room adapter:",
      error?.message || error
    );
    try {
      if (pubClient.isOpen) await pubClient.close();
    } catch (_) {}
    try {
      if (subClient.isOpen) await subClient.close();
    } catch (_) {}

    return {
      enabled: false,
      reason: error?.message || "adapter_init_failed",
    };
  }
};

module.exports = {
  attachSocketRedisAdapter,
};
