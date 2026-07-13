require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");

const SocketServer = require("./socketServer");
const { attachSocketAuth } = require("./socketServer");
const { attachSocketRedisAdapter } = require("./socketRedisAdapter");
const { setSocketIo } = require("./utils/socketEmitter");
const { initFirebaseAdmin } = require("./config/firebaseAdmin");
const errorHandler = require("./middleware/errorHandler");

mongoose.set("autoIndex", process.env.NODE_ENV !== "production");

const app = express();
const httpServer = http.createServer(app);

/** Mutated after Redis adapter attach — used by /health and shutdown. */
let redisAdapterHandles = { enabled: false };

const frontendOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL || "",
].filter(Boolean);

const corsOptions = {
  origin: frontendOrigins,
  credentials: true,
};

// Middleware order: helmet → cors → json → cookie → rate limit → routes → errors
app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many auth attempts, please try again later." },
});

app.use("/api", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);
app.use("/api/admin_login", authLimiter);
app.use("/api/refresh_token", authLimiter);
app.use("/api/register_admin", authLimiter);

// Health — outside /api rate limit for probes
app.get("/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongo =
    mongoState === 1 ? "up" : mongoState === 2 ? "connecting" : "down";

  const redisUp = Boolean(
    redisAdapterHandles.enabled &&
      redisAdapterHandles.pubClient?.isOpen
  );

  res.status(mongo === "up" ? 200 : 503).json({
    mongo,
    redis: redisUp ? "up" : "down",
    socketAdapter: redisAdapterHandles.enabled ? "redis" : "local",
  });
});

//#region Routes
app.use("/api", require("./routes/authRouter"));
app.use("/api", require("./routes/userRouter"));
app.use("/api", require("./routes/postRouter"));
app.use("/api", require("./routes/commentRouter"));
app.use("/api", require("./routes/adminRouter"));
app.use("/api", require("./routes/notifyRouter"));
app.use("/api", require("./routes/notificationRouter"));
app.use("/api", require("./routes/deviceRouter"));
app.use("/api", require("./routes/firebaseConfigRouter"));
app.use("/api", require("./routes/messageRouter"));
app.use("/api", require("./routes/platformRouter"));
app.use("/api", require("./routes/analyticsRouter"));
app.use("/api", require("./routes/searchRouter"));
app.use("/api", require("./routes/announcementRouter"));
app.use("/api", require("./routes/featureFlagRouter"));
app.use("/api", require("./routes/auditRouter"));
app.use("/api", require("./routes/sessionRouter"));
app.use("/api", require("./routes/mediaRouter"));
//#endregion

app.use(errorHandler);

const io = new Server(httpServer, {
  cors: {
    origin: frontendOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

const bootstrap = async () => {
  const URI = process.env.MONGODB_URL;
  if (!URI) {
    throw new Error("MONGODB_URL is required");
  }

  await mongoose.connect(URI, {
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("Database Connected!!");

  await initFirebaseAdmin();
  redisAdapterHandles = await attachSocketRedisAdapter(io);
  setSocketIo(io);
  attachSocketAuth(io);

  io.on("connection", (socket) => {
    SocketServer(socket, io);
  });

  const port = process.env.PORT || 8080;
  httpServer.listen(port, () => {
    console.log("Listening on ", port);
    if (typeof process.send === "function") {
      process.send("ready");
    }
  });
};

bootstrap().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

const shutdown = async (signal) => {
  if (shutdown.inProgress) return;
  shutdown.inProgress = true;

  console.log(`\n${signal} received — shutting down gracefully`);
  const forceTimer = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  forceTimer.unref?.();

  try {
    await new Promise((resolve) => httpServer.close(resolve));
    await new Promise((resolve) => io.close(resolve));

    if (redisAdapterHandles.pubClient?.isOpen) {
      await redisAdapterHandles.pubClient.close();
    }
    if (redisAdapterHandles.subClient?.isOpen) {
      await redisAdapterHandles.subClient.close();
    }

    await mongoose.connection.close();
    console.log("Shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Shutdown error:", err.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
