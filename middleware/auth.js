const Users = require("../models/userModel");
const jwt = require("jsonwebtoken");

const tokenVersionMatches = (decoded, user) => {
  const tokenVer = Number(decoded.tokenVersion ?? 0);
  const userVer = Number(user.tokenVersion ?? 0);
  return tokenVer === userVer;
};

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ msg: "You are not authorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({ msg: "Invalid or expired token" });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({ msg: "You are not authorized" });
    }

    const user = await Users.findOne({ _id: decoded.id }).select("-password");

    if (!user) {
      return res.status(401).json({ msg: "User does not exist" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ msg: "Account is disabled" });
    }

    if (
      user.status === "suspended" &&
      user.suspendedUntil &&
      user.suspendedUntil > new Date()
    ) {
      return res.status(403).json({
        msg: `Account suspended until ${user.suspendedUntil.toISOString()}`,
      });
    }

    if (
      user.status === "suspended" &&
      user.suspendedUntil &&
      user.suspendedUntil <= new Date()
    ) {
      user.status = "active";
      user.suspendedUntil = null;
      await user.save();
    }

    if (!tokenVersionMatches(decoded, user)) {
      return res.status(401).json({ msg: "Token invalidated. Please login again." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

module.exports = auth;
module.exports.tokenVersionMatches = tokenVersionMatches;
