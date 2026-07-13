const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "moderator",
  "support",
  "analyst",
  "read_only",
];

const PERMISSIONS = {
  super_admin: ["*"],
  admin: [
    "users.read",
    "users.update",
    "users.ban",
    "users.suspend",
    "content.read",
    "content.delete",
    "moderation.read",
    "moderation.update",
    "analytics.read",
    "audit.read",
    "announcements.manage",
    "flags.manage",
    "integrations.manage",
    "health.read",
  ],
  moderator: [
    "users.read",
    "users.suspend",
    "content.read",
    "content.delete",
    "moderation.read",
    "moderation.update",
    "audit.read",
  ],
  support: ["users.read", "audit.read"],
  analyst: ["analytics.read", "users.read", "content.read"],
  read_only: [
    "users.read",
    "content.read",
    "moderation.read",
    "analytics.read",
    "audit.read",
    "health.read",
  ],
};

const hasPermission = (adminRole, permission) => {
  const perms = PERMISSIONS[adminRole] || [];
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;
  const [module] = permission.split(".");
  return perms.includes(`${module}.*`);
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  const role = req.user.adminRole || "admin";
  if (!hasPermission(role, permission)) {
    return res.status(403).json({ msg: "Insufficient permissions" });
  }
  next();
};

module.exports = {
  ADMIN_ROLES,
  PERMISSIONS,
  hasPermission,
  requirePermission,
};
