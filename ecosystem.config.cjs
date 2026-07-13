/**
 * PM2 ecosystem — Face Meet API
 *
 * Usage (from server/):
 *   npm run pm2:dev        # development (1 instance, watch off)
 *   npm run pm2:start      # production
 *   npm run pm2:reload     # zero-downtime reload
 *   npm run pm2:logs       # tail logs
 *
 * Scale horizontally only when SOCKET_IO_REDIS_ADAPTER_ENABLED=1 in .env,
 * then set PM2_INSTANCES=max (or a number) before starting.
 */
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const redisAdapterOn = process.env.SOCKET_IO_REDIS_ADAPTER_ENABLED === "1";
const instances = process.env.PM2_INSTANCES || (redisAdapterOn ? "max" : 1);

module.exports = {
  apps: [
    {
      name: "facemeet-api",
      script: "server.js",
      cwd: __dirname,
      instances,
      exec_mode: instances === 1 || instances === "1" ? "fork" : "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      listen_timeout: 15_000,
      kill_timeout: 10_000,
      wait_ready: true,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "development",
        PORT: 8080,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 8080,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 8080,
      },
      error_file: path.join(__dirname, "logs", "pm2-error.log"),
      out_file: path.join(__dirname, "logs", "pm2-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
