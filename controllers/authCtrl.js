const Users = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { refreshTokenCookieOptions } = require("../utils/cookieOptions");
const { validatePassword } = require("../utils/passwordPolicy");
const { trackEvent } = require("../utils/analyticsTracker");
const { auditFromReq } = require("../utils/auditLogger");
const Session = require("../models/sessionModel");

const issueTokens = (user) => {
  const payload = {
    id: user._id,
    tokenVersion: Number(user.tokenVersion || 0),
  };
  return {
    access_token: createAccessToken(payload),
    refresh_token: createRefreshToken(payload),
    refreshFamily: crypto.randomBytes(16).toString("hex"),
  };
};

const recordSession = async (userId, refreshFamily, req) => {
  try {
    await Session.create({
      user: userId,
      refreshFamily,
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || "",
      userAgent: req?.headers?.["user-agent"] || "",
      lastActive: new Date(),
    });
  } catch {
    /* non-fatal */
  }
};

const bumpTokenVersion = async (userId) => {
  const user = await Users.findOneAndUpdate(
    { _id: userId },
    { $inc: { tokenVersion: 1 } },
    { new: true }
  );
  return user;
};

const authCtrl = {
  register: async (req, res, next) => {
    try {
      const { fullname, username, email, password, gender } = req.body;

      if (!fullname || !username || !email || !password) {
        return res.status(400).json({ msg: "Missing required fields." });
      }

      let newUserName = username.toLowerCase().replace(/ /g, "");

      const user_name = await Users.findOne({ username: newUserName });
      if (user_name) {
        return res.status(400).json({ msg: "This username is already taken." });
      }

      const user_email = await Users.findOne({ email });
      if (user_email) {
        return res
          .status(400)
          .json({ msg: "This email is already registered." });
      }

      const pwdErr = validatePassword(password);
      if (pwdErr) {
        return res.status(400).json({ msg: pwdErr });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const newUser = new Users({
        fullname,
        username: newUserName,
        email,
        password: passwordHash,
        gender,
        role: "user",
        status: "active",
        tokenVersion: 0,
      });

      await newUser.save();

      const { access_token, refresh_token, refreshFamily } = issueTokens(newUser);
      res.cookie("refreshtoken", refresh_token, refreshTokenCookieOptions());
      await recordSession(newUser._id, refreshFamily, req);
      await trackEvent({ userId: newUser._id, event: "register", req });

      const userDoc = { ...newUser._doc };
      delete userDoc.password;

      return res.json({
        msg: "Registered Successfully!",
        access_token,
        user: userDoc,
      });
    } catch (err) {
      return next(err);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body;

      const user = await Users.findOne({ _id: req.user._id });

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Your password is wrong." });
      }

      const pwdErr = validatePassword(newPassword);
      if (pwdErr) {
        return res.status(400).json({ msg: pwdErr });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Invalidate all existing sessions
      const updated = await Users.findOneAndUpdate(
        { _id: req.user._id },
        { password: newPasswordHash, $inc: { tokenVersion: 1 } },
        { new: true }
      );

      const { access_token, refresh_token } = issueTokens(updated);
      res.cookie("refreshtoken", refresh_token, refreshTokenCookieOptions());

      res.json({
        msg: "Password updated successfully.",
        access_token,
      });
    } catch (err) {
      return next(err);
    }
  },

  registerAdmin: async (req, res, next) => {
    try {
      const { fullname, username, email, password, gender } = req.body;

      if (!fullname || !username || !email || !password) {
        return res.status(400).json({ msg: "Missing required fields." });
      }

      let newUserName = username.toLowerCase().replace(/ /g, "");

      const user_name = await Users.findOne({ username: newUserName });
      if (user_name) {
        return res.status(400).json({ msg: "This username is already taken." });
      }

      const user_email = await Users.findOne({ email });
      if (user_email) {
        return res
          .status(400)
          .json({ msg: "This email is already registered." });
      }

      if (password.length < 6) {
        return res
          .status(400)
          .json({ msg: "Password must be at least 6 characters long." });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const newUser = new Users({
        fullname,
        username: newUserName,
        email,
        password: passwordHash,
        gender,
        role: "admin",
        adminRole: req.body.adminRole || "admin",
        status: "active",
        tokenVersion: 0,
      });

      await newUser.save();

      await auditFromReq(req, {
        action: "admin.register",
        resourceType: "user",
        resourceId: newUser._id,
      });

      res.json({ msg: "Admin Registered Successfully." });
    } catch (err) {
      return next(err);
    }
  },

  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await Users.findOne({ email, role: "user" }).populate(
        "followers following",
        "-password"
      );

      if (!user) {
        return res.status(400).json({ msg: "Email or Password is incorrect." });
      }

      if (user.status === "banned") {
        return res.status(403).json({ msg: "Account is disabled." });
      }

      if (
        user.status === "suspended" &&
        user.suspendedUntil &&
        user.suspendedUntil > new Date()
      ) {
        return res.status(403).json({ msg: "Account is temporarily suspended." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Email or Password is incorrect." });
      }

      const { access_token, refresh_token, refreshFamily } = issueTokens(user);
      res.cookie("refreshtoken", refresh_token, refreshTokenCookieOptions());
      await recordSession(user._id, refreshFamily, req);
      await trackEvent({ userId: user._id, event: "login", req });

      const userDoc = { ...user._doc };
      delete userDoc.password;

      res.json({
        msg: "Logged in  Successfully!",
        access_token,
        user: userDoc,
      });
    } catch (err) {
      return next(err);
    }
  },

  adminLogin: async (req, res, next) => {
    try {
      const { email, password, totpCode } = req.body;

      const user = await Users.findOne({ email, role: "admin" });

      if (!user) {
        return res.status(400).json({ msg: "Email or Password is incorrect." });
      }

      if (user.status === "banned") {
        return res.status(403).json({ msg: "Account is disabled." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Email or Password is incorrect." });
      }

      if (user.totpEnabled) {
        if (!totpCode) {
          return res.status(401).json({ msg: "2FA code required.", requires2FA: true });
        }
        let speakeasy;
        try {
          speakeasy = require("speakeasy");
        } catch {
          return res.status(500).json({ msg: "2FA not available. Install speakeasy." });
        }
        const valid = speakeasy.totp.verify({
          secret: user.totpSecret,
          encoding: "base32",
          token: String(totpCode),
          window: 1,
        });
        if (!valid) {
          return res.status(401).json({ msg: "Invalid 2FA code." });
        }
      }

      const { access_token, refresh_token, refreshFamily } = issueTokens(user);
      res.cookie("refreshtoken", refresh_token, refreshTokenCookieOptions());
      await recordSession(user._id, refreshFamily, req);
      await trackEvent({ userId: user._id, event: "admin_login", req });
      await auditFromReq(req, {
        action: "admin.login",
        resourceType: "user",
        resourceId: user._id,
      });

      const userDoc = { ...user._doc };
      delete userDoc.password;
      delete userDoc.totpSecret;

      res.json({
        msg: "Logged in  Successfully!",
        access_token,
        user: userDoc,
      });
    } catch (err) {
      return next(err);
    }
  },

  logout: async (req, res, next) => {
    try {
      res.clearCookie("refreshtoken", { path: "/api/refresh_token" });
      return res.json({ msg: "Logged out Successfully." });
    } catch (err) {
      return next(err);
    }
  },

  /** Invalidate JWTs on every device for the current user. */
  logoutAll: async (req, res, next) => {
    try {
      await bumpTokenVersion(req.user._id);
      res.clearCookie("refreshtoken", { path: "/api/refresh_token" });
      return res.json({ msg: "Logged out from all devices." });
    } catch (err) {
      return next(err);
    }
  },

  generateAccessToken: async (req, res, next) => {
    try {
      const rf_token = req.cookies.refreshtoken;

      if (!rf_token) {
        return res.status(401).json({ msg: "Please login again." });
      }

      jwt.verify(
        rf_token,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, result) => {
          try {
            if (err) {
              return res.status(401).json({ msg: "Please login again." });
            }

            const user = await Users.findById(result.id)
              .select("-password")
              .populate("followers following", "-password");

            if (!user) {
              return res.status(401).json({ msg: "User does not exist." });
            }

            if (user.status === "banned") {
              return res.status(403).json({ msg: "Account is disabled." });
            }

            const tokenVer = Number(result.tokenVersion ?? 0);
            const userVer = Number(user.tokenVersion ?? 0);
            if (tokenVer !== userVer) {
              return res
                .status(401)
                .json({ msg: "Token invalidated. Please login again." });
            }

            const { access_token, refresh_token } = issueTokens(user);
            res.cookie("refreshtoken", refresh_token, refreshTokenCookieOptions());
            return res.json({ access_token, user });
          } catch (innerErr) {
            return next(innerErr);
          }
        }
      );
    } catch (err) {
      return next(err);
    }
  },

  /** POST /api/admin/2fa/setup — generate TOTP secret */
  setup2FA: async (req, res, next) => {
    try {
      let speakeasy;
      try {
        speakeasy = require("speakeasy");
      } catch {
        return res.status(500).json({ msg: "Run: npm install speakeasy" });
      }
      const secret = speakeasy.generateSecret({
        name: `FaceMeet (${req.user.email})`,
      });
      await Users.findByIdAndUpdate(req.user._id, {
        totpSecret: secret.base32,
        totpEnabled: false,
      });
      res.json({
        msg: "Scan QR secret in authenticator app, then verify.",
        otpauthUrl: secret.otpauth_url,
        base32: secret.base32,
      });
    } catch (err) {
      return next(err);
    }
  },

  /** POST /api/admin/2fa/verify — enable 2FA */
  verify2FA: async (req, res, next) => {
    try {
      const { code } = req.body;
      const user = await Users.findById(req.user._id);
      if (!user?.totpSecret) {
        return res.status(400).json({ msg: "Run setup first." });
      }
      let speakeasy;
      try {
        speakeasy = require("speakeasy");
      } catch {
        return res.status(500).json({ msg: "speakeasy not installed" });
      }
      const valid = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: "base32",
        token: String(code),
        window: 1,
      });
      if (!valid) return res.status(400).json({ msg: "Invalid code." });

      await Users.findByIdAndUpdate(req.user._id, { totpEnabled: true });
      await auditFromReq(req, { action: "admin.2fa_enable", resourceType: "user", resourceId: user._id });
      res.json({ msg: "2FA enabled." });
    } catch (err) {
      return next(err);
    }
  },

  updateNotificationPreferences: async (req, res, next) => {
    try {
      const prefs = req.body;
      const user = await Users.findByIdAndUpdate(
        req.user._id,
        { notificationPreferences: { ...req.user.notificationPreferences, ...prefs } },
        { new: true }
      ).select("-password -totpSecret");
      res.json({ msg: "Preferences updated.", user });
    } catch (err) {
      return next(err);
    }
  },
};

const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });
};

const createRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "30d",
  });
};

module.exports = authCtrl;
module.exports.bumpTokenVersion = bumpTokenVersion;
