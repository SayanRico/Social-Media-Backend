require("dotenv").config();

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Users = require("../models/userModel");

/**
 * One-time admin bootstrap. Prefer this over any HTTP bootstrap endpoint.
 * Creates an admin only when none exist, then exits.
 *
 * Env:
 *   INITIAL_ADMIN_EMAIL (required)
 *   INITIAL_ADMIN_PASSWORD (required)
 *   INITIAL_ADMIN_USERNAME (optional, default admin)
 *   INITIAL_ADMIN_NAME (preferred) or INITIAL_ADMIN_FULLNAME
 */
const seedAdmin = async () => {
  const uri = process.env.MONGODB_URL;
  if (!uri) {
    console.error("MONGODB_URL is required");
    process.exit(1);
  }

  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const username = (process.env.INITIAL_ADMIN_USERNAME || "admin")
    .toLowerCase()
    .replace(/ /g, "");
  const fullname =
    process.env.INITIAL_ADMIN_NAME ||
    process.env.INITIAL_ADMIN_FULLNAME ||
    "Admin";

  if (!email || !password) {
    console.error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("INITIAL_ADMIN_PASSWORD must be at least 6 characters");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      useCreateIndex: true,
      useFindAndModify: false,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingAdmins = await Users.countDocuments({ role: "admin" });
    if (existingAdmins > 0) {
      console.log("Admin already exists — seed skipped.");
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await Users.create({
      fullname,
      username,
      email,
      password: passwordHash,
      gender: "male",
      role: "admin",
      adminRole: "super_admin",
      status: "active",
      tokenVersion: 0,
    });

    console.log(`Initial admin created: ${email} (${username})`);
    process.exit(0);
  } catch (err) {
    console.error("seed:admin failed:", err.message);
    process.exit(1);
  }
};

seedAdmin();
