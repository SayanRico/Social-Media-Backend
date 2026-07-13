const ALLOWED_IMAGE_HOSTS = [
  "res.cloudinary.com",
  "cdn.pixabay.com",
  "images.unsplash.com",
];

const validateMediaUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return ALLOWED_IMAGE_HOSTS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
};

const mediaCtrl = {
  /** POST /api/media/validate — server-side URL validation */
  validateUrls: async (req, res, next) => {
    try {
      const { urls } = req.body;
      if (!Array.isArray(urls) || !urls.length) {
        return res.status(400).json({ msg: "urls array required." });
      }

      const results = urls.map((url) => ({
        url,
        valid: validateMediaUrl(url),
      }));

      const allValid = results.every((r) => r.valid);
      if (!allValid) {
        return res.status(400).json({
          msg: "One or more media URLs are not from an allowed host.",
          results,
        });
      }

      res.json({ msg: "All URLs valid.", results });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = mediaCtrl;
module.exports.validateMediaUrl = validateMediaUrl;
