const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ msg: "Invalid or expired token" });
  }

  const status = err.status || err.statusCode || 500;
  const payload = { msg: err.message || "Internal server error" };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  return res.status(status).json(payload);
};

module.exports = errorHandler;
