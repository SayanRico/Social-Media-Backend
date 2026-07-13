const AuditEvent = require("../models/auditEventModel");

const writeAudit = async ({
  actorId,
  actorRole,
  actorIp,
  action,
  resourceType,
  resourceId,
  beforeState,
  afterState,
  metadata,
}) => {
  try {
    await AuditEvent.create({
      actorId,
      actorRole: actorRole || "unknown",
      actorIp: actorIp || "",
      action,
      resourceType,
      resourceId,
      beforeState,
      afterState,
      metadata,
      correlationId: metadata?.correlationId,
    });
  } catch (err) {
    console.error("[AUDIT] failed to write:", err.message);
  }
};

const auditFromReq = (req, payload) =>
  writeAudit({
    actorId: req.user?._id,
    actorRole: req.user?.adminRole || req.user?.role,
    actorIp: req.ip || req.headers["x-forwarded-for"] || "",
    ...payload,
  });

module.exports = { writeAudit, auditFromReq };
